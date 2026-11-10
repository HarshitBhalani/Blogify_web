const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { User } = require('./models');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-only-secret-change-me');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
if (!process.env.JWT_SECRET) {
  console.warn('[AUTH] JWT_SECRET not set, using a development-only secret');
}

const COOKIE_NAME = 'blogify_session';
const SESSION_DAYS = 30;

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d`, algorithm: 'HS256' });

// The session lives in an httpOnly cookie, so page JavaScript (and any XSS) cannot read it.
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

const setSession = (res, user) => {
  res.cookie(COOKIE_NAME, signToken(user), { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
};

const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  bookmarks: (user.bookmarks || []).map(String),
});

const readToken = (req) => (req.cookies && req.cookies[COOKIE_NAME]) || null;

// Attaches req.user when a valid token is sent; never rejects.
const optionalAuth = async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = await User.findById(payload.sub);
  } catch (error) {
    req.user = null;
  }
  return next();
};

const requireAuth = async (req, res, next) => {
  await optionalAuth(req, res, () => {});
  if (!req.user) return res.status(401).json({ message: 'Please log in first' });
  return next();
};

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many login attempts. Try again in 15 minutes.' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', authLimiter, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (password.length > 128) return res.status(400).json({ message: 'Password is too long' });
    if (name.length > 60) return res.status(400).json({ message: 'Name is too long' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists' });

    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
    setSession(res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Could not create account' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email });
    const ok = user && (await bcrypt.compare(req.body.password || '', user.passwordHash));
    if (!ok) return res.status(401).json({ message: 'Wrong email or password' });
    setSession(res, user);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Could not log in' });
  }
});

// Returns user: null instead of 401 so the app can check the session without console errors.
router.get('/me', optionalAuth, (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
});

module.exports = { router, optionalAuth, requireAuth, publicUser };

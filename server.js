// Node's resolver can't use the router's IPv6 link-local DNS (fe80::1) for SRV lookups on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { backfillSlugs } = require('./server/models');
const auth = require('./server/auth');
const blogs = require('./server/blogs');
const ai = require('./server/ai');
const seo = require('./server/seo');

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

// ================= MIDDLEWARE =================
app.use(cors({
  origin: isProd
    ? ['https://blogify-web-szk9.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// CSRF guard: browsers will not let another site add this custom header to a request,
// so any write request without it did not come from our own frontend.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'blogify') {
    return res.status(403).json({ message: 'Request blocked' });
  }
  return next();
});

// ================= MONGODB =================
mongoose.connection.on('connected', () => console.log('[OK] Connected to MongoDB'));
mongoose.connection.on('error', (err) => console.log('[ERROR] MongoDB error:', err.message));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => backfillSlugs())
  .catch((err) => console.log('[ERROR] MongoDB connection failed:', err.message));

// ================= API =================
// Rate limits per IP. Login/signup (30 per 15 min) and AI (20 per min) have stricter limits in their routers.
const tooMany = { message: 'Too many requests. Please slow down and try again shortly.' };
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: tooMany }));
// Writes (posts, comments, likes, bookmarks) get a tighter cap to stop spam.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/ai/') || req.path.startsWith('/auth/'),
}));

app.use('/api/auth', auth.router);
app.use('/api/ai', ai.router);
app.use('/api', blogs.router);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongoConnected: mongoose.connection.readyState === 1,
    groqConfigured: !!process.env.GROQ_API_KEY,
  });
});

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// ================= SEO + REACT =================
app.use(seo.router);
app.get('/post/:slug', seo.renderIndex);
app.use(express.static(path.join(__dirname, 'client/build'), { index: false }));
app.get('*', seo.renderIndex, (req, res) => res.status(404).send('Client build not found. Run npm run build.'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

// ================= KEEP ALIVE (RENDER FREE FIX) =================
const RENDER_URL = 'https://blogify-web-szk9.onrender.com';

const keepAlive = () => {
  if (!isProd) {
    console.log('Keep-alive disabled (development mode)');
    return;
  }
  setInterval(async () => {
    try {
      const response = await fetch(`${RENDER_URL}/api/health`);
      console.log(`[OK] Keep-alive ping: ${response.status}`);
    } catch (error) {
      console.error('[ERROR] Keep-alive failed:', error.message);
    }
  }, 14 * 60 * 1000);
};

app.listen(PORT, () => {
  console.log(`[START] Server running on port ${PORT}`);
  console.log(`[AI] Groq configured: ${!!process.env.GROQ_API_KEY}`);
  keepAlive();
});

import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../lib/auth';
import { usePageMeta } from '../lib/hooks';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  usePageMeta(isLogin ? 'Log in' : 'Create an account');
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state && location.state.from) || '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  const validate = () => {
    const errs = {};
    if (!isLogin && !name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Password is required';
    else if (!isLogin && password.length < 8) errs.password = 'Password must be at least 8 characters';
    return errs;
  };

  // Clears a field's error as soon as the user edits it.
  const onChange = (setter, key) => (event) => {
    setter(event.target.value);
    if (fieldErrors[key]) setFieldErrors((f) => ({ ...f, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      const first = document.getElementById(Object.keys(errs)[0]);
      if (first) first.focus();
      return;
    }
    setBusy(true);
    try {
      const u = isLogin ? await login(email, password) : await register(name, email, password);
      toast.success(isLogin ? `Welcome back, ${u.name}` : `Account created. Welcome, ${u.name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="narrow-page">
      <h1 className="page-title">{isLogin ? 'Log in' : 'Create your account'}</h1>
      <p className="muted">
        {isLogin ? 'Write, save drafts and keep track of posts you like.' : 'You need an account to write posts and use the AI drafting tools.'}
      </p>

      <form className="auth-form" onSubmit={submit} noValidate>
        {!isLogin && (
          <div className="field">
            <label htmlFor="name">
              Name <span className="req" aria-hidden="true">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={onChange(setName, 'name')}
              autoComplete="name"
              required
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="name-error" className="field-error">
                {fieldErrors.name}
              </p>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="email">
            Email <span className="req" aria-hidden="true">*</span>
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={onChange(setEmail, 'email')}
            autoComplete="email"
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="field-error">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">
            Password <span className="req" aria-hidden="true">*</span>
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={onChange(setPassword, 'password')}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={8}
            required
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password ? (
            <p id="password-error" className="field-error">
              {fieldErrors.password}
            </p>
          ) : (
            !isLogin && <small className="hint">At least 8 characters.</small>
          )}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? 'Please wait...' : isLogin ? 'Log in' : 'Create account'}
        </Button>
      </form>

      <p className="muted auth-switch">
        {isLogin ? 'New here? ' : 'Already have an account? '}
        <Link to={isLogin ? '/register' : '/login'} state={location.state} className="text-link">
          {isLogin ? 'Create an account' : 'Log in'}
        </Link>
      </p>
    </main>
  );
}

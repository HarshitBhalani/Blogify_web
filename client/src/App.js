import React from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import './App.css';
import { useAuth } from './lib/auth';
import { useTheme } from './lib/hooks';
import { Button } from './components/ui/button';
import Home from './pages/Home';
import Post from './pages/Post';
import Editor from './pages/Editor';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';

function Header({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand" aria-label="Blogify home">
          <img src="/blogify_favicon_transparent.png" alt="" className="brand-logo" />
          <span className="brand-name">Blogify</span>
        </Link>
        <nav className="site-nav">
          {user && (
            <NavLink to="/me" className="nav-link">
              My posts
            </NavLink>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} aria-hidden="true"></i>
          </button>
          {user ? (
            <>
              <button
                type="button"
                className="nav-link"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Log out
              </button>
              <Button size="sm" onClick={() => navigate('/write')}>
                Write
              </Button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">
                Log in
              </NavLink>
              <Button size="sm" onClick={() => navigate('/register')}>
                Sign up
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <span className="brand-name">Blogify</span>
      <span className="footer-links">
        <a href="/rss.xml">RSS</a>
        <a href="/sitemap.xml">Sitemap</a>
      </span>
    </footer>
  );
}

export default function App() {
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header theme={theme} toggleTheme={toggleTheme} />
      <div id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:slug" element={<Post />} />
          <Route path="/write" element={<Editor />} />
          <Route path="/edit/:slug" element={<Editor />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/me" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
      <Toaster position="bottom-right" theme={theme} closeButton toastOptions={{ className: 'toast' }} />
    </div>
  );
}

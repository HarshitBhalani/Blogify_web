import { useEffect, useState } from 'react';

const DEFAULT_TITLE = 'Blogify';
const DEFAULT_DESC = 'Blogify - draft blog posts with AI, finish them in your own voice.';

const setMeta = (selector, attr, value) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    const [, key, name] = selector.match(/\[(name|property)="([^"]+)"\]/);
    el.setAttribute(key, name);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

// Keeps the tab title and share meta tags in sync with the current page.
export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} · Blogify` : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESC;
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', title || DEFAULT_TITLE);
    setMeta('meta[property="og:description"]', 'content', desc);
  }, [title, description]);
}

const THEME_KEY = 'blogify.theme';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (error) {
      // ignore
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // ignore
    }
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

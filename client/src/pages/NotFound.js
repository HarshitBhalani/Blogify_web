import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/hooks';

export default function NotFound() {
  usePageMeta('Page not found');
  return (
    <main className="narrow-page center">
      <p className="eyebrow">404</p>
      <h1 className="page-title">This page does not exist</h1>
      <p className="muted">The post may have been deleted, or the link has a typo.</p>
      <Link to="/" className="text-link">
        Back to all posts
      </Link>
    </main>
  );
}

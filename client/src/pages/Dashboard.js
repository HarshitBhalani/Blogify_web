import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePageMeta } from '../lib/hooks';
import { Button } from '../components/ui/button';
import PostList from '../components/PostList';

const TABS = [
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
  { key: 'saved', label: 'Saved' },
];

export default function Dashboard() {
  usePageMeta('My posts');
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('published');
  const [mine, setMine] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([api('/me/posts'), api('/me/bookmarks')])
      .then(([posts, bookmarks]) => {
        setMine(posts);
        setSaved(bookmarks);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (ready && !user) return <Navigate to="/login" state={{ from: '/me' }} replace />;

  const lists = {
    published: mine.filter((p) => p.status !== 'draft'),
    draft: mine.filter((p) => p.status === 'draft'),
    saved,
  };
  const current = lists[tab];

  const empty = {
    published: 'You have not published anything yet.',
    draft: 'No drafts. Unfinished posts you save show up here.',
    saved: 'Posts you save while reading show up here.',
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{user ? user.name : ''}</h1>
          <p className="muted">
            {lists.published.length} published · {lists.draft.length} drafts · {saved.length} saved
          </p>
        </div>
        <Button onClick={() => navigate('/write')}>New post</Button>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} <span className="chip-count">{lists[t.key].length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton-list">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      ) : current.length === 0 ? (
        <div className="empty-state">
          <p>{empty[tab]}</p>
        </div>
      ) : (
        <PostList
          posts={current}
          showStatus
          linkFor={tab === 'draft' ? (post) => `/edit/${post.slug}` : undefined}
        />
      )}
    </main>
  );
}

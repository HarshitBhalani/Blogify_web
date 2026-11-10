import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePageMeta } from '../lib/hooks';
import { Button } from '../components/ui/button';
import { Byline, Cover, PostCard } from '../components/PostCard';

export default function Home() {
  usePageMeta('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') || '';
  const [query, setQuery] = useState(params.get('q') || '');
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/tags')
      .then((data) => setTags(Array.isArray(data) ? data : []))
      .catch(() => setTags([]));
  }, []);

  // Debounced search so the list updates while typing without a request per key.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const qs = new URLSearchParams();
      if (tag) qs.set('tag', tag);
      if (query.trim()) qs.set('q', query.trim());
      setError('');
      api(`/blogs?${qs.toString()}`, { signal: controller.signal })
        .then((data) => setPosts(Array.isArray(data) ? data : []))
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setPosts([]);
            setError(err.message || 'Could not load posts. Is the server running?');
          }
        })
        .finally(() => setLoading(false));
    }, query ? 250 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tag, query]);

  const selectTag = (next) => {
    const p = new URLSearchParams(params);
    if (next && next !== tag) p.set('tag', next);
    else p.delete('tag');
    setParams(p, { replace: true });
  };

  const startWriting = () => navigate(user ? '/write' : '/register');
  const filtered = Boolean(tag || query.trim());
  const [featured, ...rest] = posts;
  // Sidebar: most liked posts after the lead story, topped up with the latest ones.
  const popular = [...rest].sort((a, b) => b.likesCount - a.likesCount).slice(0, 4);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const searchBox = (
    <label className="search">
      <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
      <input
        type="search"
        placeholder="Search posts"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search posts"
      />
    </label>
  );

  const topics = tags.length > 0 && (
    <nav className="topics" aria-label="Topics">
      <button type="button" className={`topic ${!tag ? 'is-active' : ''}`} onClick={() => selectTag('')}>
        All
      </button>
      {tags.map((t) => (
        <button
          key={t.tag}
          type="button"
          className={`topic ${tag === t.tag ? 'is-active' : ''}`}
          onClick={() => selectTag(t.tag)}
          aria-pressed={tag === t.tag}
        >
          {t.tag}
        </button>
      ))}
    </nav>
  );

  const emptyState = (
    <div className="empty-state">
      {filtered ? (
        <>
          <p>No posts match this search.</p>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setQuery('');
              selectTag('');
            }}
          >
            Clear filters
          </button>
        </>
      ) : (
        <>
          <p>Nothing published yet.</p>
          <Button onClick={startWriting}>Write the first post</Button>
        </>
      )}
    </div>
  );

  return (
    <main className="home">
      <header className="masthead">
        <div>
          <p className="masthead-date">{today}</p>
          <h1 className="masthead-title">{tag ? `#${tag}` : 'Stories worth finishing'}</h1>
          <p className="masthead-sub">
            {tag ? 'Posts filed under this topic.' : 'Essays, notes and how-tos from writers who start with an AI draft and finish by hand.'}
          </p>
        </div>
        <div className="masthead-actions">
          {searchBox}
          <Button onClick={startWriting}>
            <i className="fas fa-pen-nib" aria-hidden="true"></i> Write
          </Button>
        </div>
      </header>

      {topics}

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <div className="skeleton-list" aria-label="Loading posts">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        emptyState
      ) : filtered ? (
        <section className="section" aria-label="Results">
          <p className="section-label">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </p>
          <div className="card-grid">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className={`lead ${popular.length ? '' : 'lead-solo'}`} aria-label="Top stories">
            <article className="lead-story">
              <Link to={`/post/${featured.slug}`} className="lead-link">
                <Cover post={featured} className="lead-cover" />
                {featured.tags && featured.tags[0] && <span className="kicker">{featured.tags[0]}</span>}
                <span className="lead-title">{featured.title}</span>
                {featured.excerpt && <span className="lead-excerpt">{featured.excerpt}</span>}
              </Link>
              <Byline post={featured} size={32} />
            </article>

            {popular.length > 0 && (
              <aside className="lead-aside">
                <p className="section-label">Popular</p>
                <ol className="ranked">
                  {popular.map((post, i) => (
                    <li key={post.id}>
                      <span className="rank">{String(i + 1).padStart(2, '0')}</span>
                      <Link to={`/post/${post.slug}`} className="ranked-link">
                        <span className="ranked-title">{post.title}</span>
                        <span className="ranked-meta">
                          {post.author} · {post.readingTime} min
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {!user && (
                  <div className="write-cta">
                    <p className="write-cta-title">Have something to say?</p>
                    <p>Give Blogify a title and get an outline and first draft. Then rewrite it your way.</p>
                    <Link to="/register" className="text-link">
                      Create a free account <i className="fas fa-arrow-right" aria-hidden="true"></i>
                    </Link>
                  </div>
                )}
              </aside>
            )}
          </section>

          {rest.length > 0 && (
            <section className="section" aria-labelledby="latest-heading">
              <h2 id="latest-heading" className="section-label">
                Latest
              </h2>
              <div className="card-grid">
                {rest.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

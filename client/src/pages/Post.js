import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePageMeta } from '../lib/hooks';
import { formatDate, renderMarkdown } from '../lib/markdown';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { TagList } from '../components/PostList';
import { Avatar, Byline } from '../components/PostCard';
import NotFound from './NotFound';

function TableOfContents({ toc }) {
  const [active, setActive] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    toc.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ul>
        {toc.map((item) => (
          <li key={item.id} className={`toc-l${item.level} ${active === item.id ? 'is-active' : ''}`}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Comments({ post }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api(`/blogs/${post.id}/comments`).then(setComments).catch(() => setComments([]));
  }, [post.id, user]);

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const comment = await api(`/blogs/${post.id}/comments`, { method: 'POST', body: { body } });
      setComments((list) => [...list, comment]);
      setBody('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    try {
      await api(`/comments/${id}`, { method: 'DELETE' });
      setComments((list) => list.filter((c) => c.id !== id));
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <section className="comments" aria-labelledby="comments-heading">
      <h2 id="comments-heading">
        {comments.length ? `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}` : 'Comments'}
      </h2>

      {comments.length === 0 && <p className="muted">No comments yet.</p>}
      <ul className="comment-list">
        {comments.map((c) => (
          <li key={c.id} className="comment">
            <div className="comment-head">
              <Avatar name={c.author} size={24} />
              <strong>{c.author}</strong>
              <span className="muted">{formatDate(c.createdAt)}</span>
              {c.canDelete && (
                <button type="button" className="link-danger" onClick={() => remove(c.id)}>
                  Delete
                </button>
              )}
            </div>
            <p>{c.body}</p>
          </li>
        ))}
      </ul>

      {user ? (
        <form onSubmit={submit} className="comment-form">
          <label htmlFor="comment-body" className="sr-only">
            Write a comment
          </label>
          <Textarea
            id="comment-body"
            rows="3"
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add to the discussion"
          />
          <Button type="submit" size="sm" disabled={sending || !body.trim()}>
            {sending ? 'Posting...' : 'Post comment'}
          </Button>
        </form>
      ) : (
        <p className="muted">
          <Link to="/login" className="text-link">
            Log in
          </Link>{' '}
          to join the discussion.
        </p>
      )}
    </section>
  );
}

export default function Post() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    setStatus('loading');
    api(`/blogs/${encodeURIComponent(slug)}`)
      .then((data) => {
        setPost(data);
        setStatus('ok');
        window.scrollTo({ top: 0 });
      })
      .catch((error) => setStatus(error.status === 404 ? 'missing' : 'error'));
  }, [slug, user]);

  const rendered = useMemo(() => (post ? renderMarkdown(post.content, post.title) : { html: '', toc: [] }), [post]);
  usePageMeta(post ? post.title : 'Loading', post ? post.description : '');

  const requireLogin = () => {
    toast('Log in to do that', { action: { label: 'Log in', onClick: () => navigate('/login') } });
  };

  const toggleLike = async () => {
    if (!user) return requireLogin();
    const res = await api(`/blogs/${post.id}/like`, { method: 'POST' }).catch((e) => toast.error(e.message));
    if (res) setPost((p) => ({ ...p, liked: res.liked, likesCount: res.likesCount }));
    return undefined;
  };

  const toggleBookmark = async () => {
    if (!user) return requireLogin();
    const res = await api(`/blogs/${post.id}/bookmark`, { method: 'POST' }).catch((e) => toast.error(e.message));
    if (res) {
      setPost((p) => ({ ...p, bookmarked: res.bookmarked }));
      toast.success(res.bookmarked ? 'Saved to your bookmarks' : 'Removed from bookmarks');
    }
    return undefined;
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: post.title, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch (error) {
      toast.error('Could not copy the link');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api(`/blogs/${post.id}`, { method: 'DELETE' });
      toast.success('Post deleted');
      navigate('/me');
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (status === 'loading') {
    return (
      <main className="article-page">
        <div className="skeleton-title" />
        <div className="skeleton-row" />
      </main>
    );
  }
  if (status === 'missing') return <NotFound />;
  if (status === 'error') {
    return (
      <main className="article-page">
        <p className="form-error">Could not load this post. Check that the server is running and try again.</p>
      </main>
    );
  }

  const hasToc = rendered.toc.length >= 3;

  return (
    <main className={`article-layout ${hasToc ? 'has-toc' : ''}`}>
      <article className="article">
        {post.status === 'draft' && (
          <p className="draft-banner">
            This is a draft. Only you can see it.{' '}
            <Link to={`/edit/${post.slug}`} className="text-link">
              Continue editing
            </Link>
          </p>
        )}

        <header className="article-header">
          <TagList tags={post.tags} />
          <h1 className="article-title">{post.title}</h1>
          {post.description && <p className="article-dek">{post.description}</p>}
          <div className="article-byline">
            <Byline post={post} size={40} />
            {post.updatedAt && post.publishedAt && new Date(post.updatedAt) - new Date(post.publishedAt) > 60000 && (
              <span className="muted">Updated {formatDate(post.updatedAt)}</span>
            )}
          </div>
        </header>

        {post.coverImage && <img className="article-cover" src={post.coverImage} alt="" />}

        <div className="prose" dangerouslySetInnerHTML={{ __html: rendered.html }} />

        <div className="article-actions">
          <div className="action-group">
            <button
              type="button"
              className={`action-btn ${post.liked ? 'is-on' : ''}`}
              onClick={toggleLike}
              aria-pressed={post.liked}
            >
              <i className={`${post.liked ? 'fas' : 'far'} fa-heart`} aria-hidden="true"></i>
              {post.likesCount > 0 ? post.likesCount : 'Like'}
            </button>
            <button
              type="button"
              className={`action-btn ${post.bookmarked ? 'is-on' : ''}`}
              onClick={toggleBookmark}
              aria-pressed={post.bookmarked}
            >
              <i className={`${post.bookmarked ? 'fas' : 'far'} fa-bookmark`} aria-hidden="true"></i>
              {post.bookmarked ? 'Saved' : 'Save'}
            </button>
            <button type="button" className="action-btn" onClick={share}>
              <i className="fas fa-link" aria-hidden="true"></i>
              Share
            </button>
          </div>
          {post.canEdit && (
            <div className="action-group">
              <Button variant="outline" size="sm" onClick={() => navigate(`/edit/${post.slug}`)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="danger" onClick={remove}>
                Delete
              </Button>
            </div>
          )}
        </div>

        {post.status !== 'draft' && <Comments post={post} />}
      </article>

      {hasToc && (
        <aside className="article-aside">
          <TableOfContents toc={rendered.toc} />
        </aside>
      )}
    </main>
  );
}

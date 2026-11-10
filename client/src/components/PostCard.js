import React from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/markdown';

const hue = (text = '') => {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
};

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

export function Avatar({ name, size = 28 }) {
  return (
    <span className="avatar" style={{ '--h': hue(name), width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Byline({ post, size = 28 }) {
  return (
    <span className="byline">
      <Avatar name={post.author} size={size} />
      <span className="byline-text">
        <span className="byline-name">{post.author}</span>
        <span className="byline-meta">
          {formatDate(post.publishedAt || post.createdAt)} · {post.readingTime} min read
        </span>
      </span>
    </span>
  );
}

// Posts without a cover get a quiet coloured block with their first tag, so the grid stays even.
export function Cover({ post, className = '' }) {
  if (post.coverImage) {
    return <img className={`cover ${className}`} src={post.coverImage} alt="" loading="lazy" />;
  }
  return (
    <span className={`cover cover-fallback ${className}`} style={{ '--h': hue(post.title) }} aria-hidden="true">
      <span>{post.tags && post.tags[0] ? post.tags[0] : post.title.slice(0, 1)}</span>
    </span>
  );
}

export function PostCard({ post, onTag }) {
  return (
    <article className="card">
      <Link to={`/post/${post.slug}`} className="card-link">
        <Cover post={post} />
        <span className="card-body">
          {post.tags && post.tags[0] && <span className="kicker">{post.tags[0]}</span>}
          <span className="card-title">{post.title}</span>
          {post.excerpt && <span className="card-excerpt">{post.excerpt}</span>}
        </span>
      </Link>
      <div className="card-foot">
        <Byline post={post} size={26} />
        {post.likesCount > 0 && (
          <span className="card-likes" title={`${post.likesCount} likes`}>
            <i className="far fa-heart" aria-hidden="true"></i> {post.likesCount}
          </span>
        )}
      </div>
    </article>
  );
}

export function FeaturedCard({ post }) {
  return (
    <article className="featured">
      <Link to={`/post/${post.slug}`} className="featured-link">
        <Cover post={post} className="featured-cover" />
        <span className="featured-body">
          <span className="kicker">Latest{post.tags && post.tags[0] ? ` · ${post.tags[0]}` : ''}</span>
          <span className="featured-title">{post.title}</span>
          {post.excerpt && <span className="featured-excerpt">{post.excerpt}</span>}
          <Byline post={post} size={32} />
        </span>
      </Link>
    </article>
  );
}

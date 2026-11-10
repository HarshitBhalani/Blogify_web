import React from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/markdown';

export function PostMeta({ post, showStatus = false }) {
  return (
    <span className="post-meta">
      {showStatus && post.status === 'draft' && <span className="status-pill">Draft</span>}
      <span>{post.author}</span>
      <span className="sep" aria-hidden="true">·</span>
      <span>{formatDate(post.publishedAt || post.createdAt)}</span>
      <span className="sep" aria-hidden="true">·</span>
      <span>{post.readingTime} min read</span>
    </span>
  );
}

export function TagList({ tags, onTag }) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className="tag-list">
      {tags.map((tag) =>
        onTag ? (
          <button key={tag} type="button" className="tag" onClick={() => onTag(tag)}>
            #{tag}
          </button>
        ) : (
          <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`} className="tag">
            #{tag}
          </Link>
        )
      )}
    </span>
  );
}

export function PostRow({ post, showStatus = false, linkTo }) {
  const to = linkTo || `/post/${post.slug}`;
  return (
    <li className="post-row">
      <Link to={to} className="post-row-link">
        {post.coverImage && <img className="post-row-cover" src={post.coverImage} alt="" loading="lazy" />}
        <span className="post-row-body">
          <PostMeta post={post} showStatus={showStatus} />
          <span className="post-row-title">{post.title || 'Untitled'}</span>
          {post.excerpt && <span className="post-row-excerpt">{post.excerpt}</span>}
        </span>
      </Link>
      {post.tags && post.tags.length > 0 && <TagList tags={post.tags} />}
    </li>
  );
}

export default function PostList({ posts, showStatus = false, linkFor }) {
  return (
    <ul className="post-list">
      {posts.map((post) => (
        <PostRow key={post.id} post={post} showStatus={showStatus} linkTo={linkFor ? linkFor(post) : undefined} />
      ))}
    </ul>
  );
}

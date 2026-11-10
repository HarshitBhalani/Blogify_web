const express = require('express');
const mongoose = require('mongoose');
const { Blog, Comment, User, uniqueSlug } = require('./models');
const { optionalAuth, requireAuth } = require('./auth');

const router = express.Router();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const stripMarkdown = (text = '') =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const readingTime = (content = '') => Math.max(1, Math.round(stripMarkdown(content).split(' ').filter(Boolean).length / 220));

const cleanTags = (tags) => {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return [...new Set(list.map((t) => String(t).trim().toLowerCase().replace(/[^a-z0-9- ]/g, '').replace(/\s+/g, '-')).filter(Boolean))].slice(0, 6);
};

const cleanUrl = (url = '') => {
  const value = String(url).trim();
  return /^https?:\/\//i.test(value) ? value.slice(0, 1000) : '';
};

// Only the owner may edit or delete a post. Posts from before accounts existed have no owner,
// so nobody can change them until they are assigned with `npm run claim-posts -- <email>`.
const canEdit = (blog, user) => Boolean(user && blog.owner) && String(blog.owner._id || blog.owner) === String(user._id);

const authorName = (blog) => (blog.owner && blog.owner.name) || blog.author || 'Anonymous';

const serialize = (blog, user, { full = false } = {}) => {
  const out = {
    id: blog._id.toString(),
    slug: blog.slug,
    title: blog.title,
    description: blog.description,
    excerpt: (blog.description || stripMarkdown(blog.content)).slice(0, 220),
    coverImage: blog.coverImage || '',
    tags: blog.tags || [],
    status: blog.status || 'published',
    author: authorName(blog),
    ownerId: blog.owner ? String(blog.owner._id || blog.owner) : null,
    readingTime: readingTime(blog.content),
    likesCount: (blog.likes || []).length,
    liked: Boolean(user) && (blog.likes || []).some((id) => String(id) === String(user._id)),
    bookmarked: Boolean(user) && (user.bookmarks || []).some((id) => String(id) === String(blog._id)),
    canEdit: canEdit(blog, user),
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
    publishedAt: blog.publishedAt || blog.createdAt,
  };
  if (full) {
    out.content = blog.content;
    out.contentType = blog.contentType || 'markdown';
  }
  return out;
};

const PUBLISHED = { status: { $ne: 'draft' } };

const findBySlugOrId = (key) => {
  const or = [{ slug: key }];
  if (mongoose.isValidObjectId(key)) or.push({ _id: key });
  return Blog.findOne({ $or: or }).populate('owner', 'name');
};

// ---------- Lists ----------
router.get('/blogs', optionalAuth, wrap(async (req, res) => {
  const filter = { ...PUBLISHED };
  if (req.query.tag) filter.tags = String(req.query.tag).toLowerCase();
  if (req.query.q) {
    const q = String(req.query.q).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }, { author: new RegExp(q, 'i') }];
  }
  const blogs = await Blog.find(filter).sort({ publishedAt: -1, createdAt: -1 }).limit(100).populate('owner', 'name');
  res.json(blogs.map((b) => serialize(b, req.user)));
}));

router.get('/tags', wrap(async (req, res) => {
  const tags = await Blog.aggregate([
    { $match: PUBLISHED },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 20 },
  ]);
  res.json(tags.map((t) => ({ tag: t._id, count: t.count })));
}));

router.get('/me/posts', requireAuth, wrap(async (req, res) => {
  const blogs = await Blog.find({ owner: req.user._id }).sort({ updatedAt: -1 }).populate('owner', 'name');
  res.json(blogs.map((b) => serialize(b, req.user)));
}));

router.get('/me/bookmarks', requireAuth, wrap(async (req, res) => {
  const blogs = await Blog.find({ _id: { $in: req.user.bookmarks }, ...PUBLISHED }).populate('owner', 'name');
  res.json(blogs.map((b) => serialize(b, req.user)));
}));

// ---------- Single post ----------
router.get('/blogs/:key', optionalAuth, wrap(async (req, res) => {
  const blog = await findBySlugOrId(req.params.key);
  if (!blog || (blog.status === 'draft' && !canEdit(blog, req.user))) {
    return res.status(404).json({ message: 'Post not found' });
  }
  return res.json(serialize(blog, req.user, { full: true }));
}));

router.post('/blogs', requireAuth, wrap(async (req, res) => {
  const { title, description, content } = req.body;
  const status = req.body.status === 'draft' ? 'draft' : 'published';
  if (!title || !title.trim()) return res.status(400).json({ message: 'Title is required' });
  if (status === 'published' && (!content || !content.trim())) {
    return res.status(400).json({ message: 'Write some content before publishing' });
  }

  const blog = await Blog.create({
    title: title.trim(),
    slug: await uniqueSlug(title),
    description: (description || '').trim(),
    content: content || '',
    contentType: 'markdown',
    coverImage: cleanUrl(req.body.coverImage),
    tags: cleanTags(req.body.tags),
    status,
    owner: req.user._id,
    author: req.user.name,
    publishedAt: status === 'published' ? new Date() : undefined,
  });
  await blog.populate('owner', 'name');
  return res.status(201).json(serialize(blog, req.user, { full: true }));
}));

router.put('/blogs/:id', requireAuth, wrap(async (req, res) => {
  const blog = await findBySlugOrId(req.params.id);
  if (!blog) return res.status(404).json({ message: 'Post not found' });
  if (!canEdit(blog, req.user)) return res.status(403).json({ message: 'You can only edit your own posts' });

  const { title, description, content } = req.body;
  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ message: 'Title is required' });
    blog.title = title.trim();
  }
  if (description !== undefined) blog.description = description.trim();
  if (content !== undefined) blog.content = content;
  if (req.body.coverImage !== undefined) blog.coverImage = cleanUrl(req.body.coverImage);
  if (req.body.tags !== undefined) blog.tags = cleanTags(req.body.tags);
  if (req.body.status === 'draft' || req.body.status === 'published') {
    if (req.body.status === 'published' && !blog.content.trim()) {
      return res.status(400).json({ message: 'Write some content before publishing' });
    }
    if (req.body.status === 'published' && !blog.publishedAt) blog.publishedAt = new Date();
    blog.status = req.body.status;
  }
  blog.contentType = 'markdown';
  blog.updatedAt = Date.now();
  await blog.save();
  return res.json(serialize(blog, req.user, { full: true }));
}));

router.delete('/blogs/:id', requireAuth, wrap(async (req, res) => {
  const blog = await findBySlugOrId(req.params.id);
  if (!blog) return res.status(404).json({ message: 'Post not found' });
  if (!canEdit(blog, req.user)) return res.status(403).json({ message: 'You can only delete your own posts' });
  await Promise.all([
    blog.deleteOne(),
    Comment.deleteMany({ blog: blog._id }),
    User.updateMany({ bookmarks: blog._id }, { $pull: { bookmarks: blog._id } }),
  ]);
  return res.json({ message: 'Post deleted' });
}));

// ---------- Likes & bookmarks ----------
router.post('/blogs/:id/like', requireAuth, wrap(async (req, res) => {
  const blog = await findBySlugOrId(req.params.id);
  if (!blog) return res.status(404).json({ message: 'Post not found' });
  const liked = blog.likes.some((id) => String(id) === String(req.user._id));
  const updated = await Blog.findByIdAndUpdate(
    blog._id,
    liked ? { $pull: { likes: req.user._id } } : { $addToSet: { likes: req.user._id } },
    { new: true }
  );
  return res.json({ liked: !liked, likesCount: updated.likes.length });
}));

router.post('/blogs/:id/bookmark', requireAuth, wrap(async (req, res) => {
  const blog = await findBySlugOrId(req.params.id);
  if (!blog) return res.status(404).json({ message: 'Post not found' });
  const has = req.user.bookmarks.some((id) => String(id) === String(blog._id));
  await User.updateOne({ _id: req.user._id }, has ? { $pull: { bookmarks: blog._id } } : { $addToSet: { bookmarks: blog._id } });
  return res.json({ bookmarked: !has });
}));

// ---------- Comments ----------
const serializeComment = (c, user, blog) => ({
  id: c._id.toString(),
  body: c.body,
  author: (c.user && c.user.name) || 'Deleted user',
  createdAt: c.createdAt,
  canDelete: Boolean(user) && (String(c.user && c.user._id) === String(user._id) || canEdit(blog, user)),
});

router.get('/blogs/:id/comments', optionalAuth, wrap(async (req, res) => {
  const blog = await findBySlugOrId(req.params.id);
  if (!blog) return res.status(404).json({ message: 'Post not found' });
  const comments = await Comment.find({ blog: blog._id }).sort({ createdAt: 1 }).populate('user', 'name');
  return res.json(comments.map((c) => serializeComment(c, req.user, blog)));
}));

router.post('/blogs/:id/comments', requireAuth, wrap(async (req, res) => {
  const blog = await findBySlugOrId(req.params.id);
  if (!blog || blog.status === 'draft') return res.status(404).json({ message: 'Post not found' });
  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ message: 'Comment cannot be empty' });
  const comment = await Comment.create({ blog: blog._id, user: req.user._id, body: body.slice(0, 2000) });
  await comment.populate('user', 'name');
  return res.status(201).json(serializeComment(comment, req.user, blog));
}));

router.delete('/comments/:id', requireAuth, wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Comment not found' });
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  const blog = await Blog.findById(comment.blog);
  const allowed = String(comment.user) === String(req.user._id) || (blog && canEdit(blog, req.user));
  if (!allowed) return res.status(403).json({ message: 'Not allowed' });
  await comment.deleteOne();
  return res.json({ message: 'Comment deleted' });
}));

module.exports = { router, stripMarkdown, PUBLISHED };

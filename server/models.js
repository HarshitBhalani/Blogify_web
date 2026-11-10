const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Blog' }],
  },
  { timestamps: true }
);

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, unique: true, sparse: true, index: true },
  description: { type: String, default: '' },
  content: { type: String, default: '' },
  contentType: { type: String, enum: ['markdown', 'html', 'plain'], default: 'markdown' },
  coverImage: { type: String, default: '' },
  tags: [{ type: String, lowercase: true, trim: true }],
  // Posts created before accounts existed have no status field; treat them as published.
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  author: { type: String, default: 'Anonymous' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  publishedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const commentSchema = new mongoose.Schema(
  {
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Blog = mongoose.model('Blog', blogSchema);
const Comment = mongoose.model('Comment', commentSchema);

const slugify = (text = '') =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';

const uniqueSlug = async (title, excludeId) => {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Blog.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
};

// Give older posts a slug so every post has a shareable URL.
const backfillSlugs = async () => {
  const missing = await Blog.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] });
  for (const blog of missing) {
    // eslint-disable-next-line no-await-in-loop
    blog.slug = await uniqueSlug(blog.title, blog._id);
    blog.publishedAt = blog.publishedAt || blog.createdAt;
    // eslint-disable-next-line no-await-in-loop
    await blog.save();
  }
  if (missing.length) console.log(`[DB] Added slugs to ${missing.length} existing posts`);
};

module.exports = { User, Blog, Comment, slugify, uniqueSlug, backfillSlugs };

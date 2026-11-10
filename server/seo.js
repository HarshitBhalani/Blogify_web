const fs = require('fs');
const path = require('path');
const express = require('express');
const { Blog } = require('./models');
const { PUBLISHED, stripMarkdown } = require('./blogs');

const router = express.Router();
const INDEX_HTML = path.join(__dirname, '..', 'client', 'build', 'index.html');

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const siteUrl = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const base = siteUrl(req);
    const posts = await Blog.find(PUBLISHED).select('slug updatedAt').sort({ updatedAt: -1 }).limit(5000);
    const urls = [
      `<url><loc>${base}/</loc></url>`,
      ...posts.map((p) => `<url><loc>${base}/post/${esc(p.slug)}</loc><lastmod>${new Date(p.updatedAt).toISOString()}</lastmod></url>`),
    ];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
  } catch (error) {
    next(error);
  }
});

router.get('/rss.xml', async (req, res, next) => {
  try {
    const base = siteUrl(req);
    const posts = await Blog.find(PUBLISHED).sort({ publishedAt: -1, createdAt: -1 }).limit(30).populate('owner', 'name');
    const items = posts
      .map((p) => `<item><title>${esc(p.title)}</title><link>${base}/post/${esc(p.slug)}</link><guid>${base}/post/${esc(p.slug)}</guid><pubDate>${new Date(p.publishedAt || p.createdAt).toUTCString()}</pubDate><author>${esc((p.owner && p.owner.name) || p.author || 'Anonymous')}</author><description>${esc(p.description || stripMarkdown(p.content).slice(0, 300))}</description></item>`)
      .join('');
    res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Blogify</title><link>${base}</link><description>Latest posts on Blogify</description>${items}</channel></rss>`);
  } catch (error) {
    next(error);
  }
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${siteUrl(req)}/sitemap.xml\n`);
});

// Social crawlers do not run JavaScript, so post pages get their meta tags filled in on the server.
const renderIndex = async (req, res, next) => {
  if (!fs.existsSync(INDEX_HTML)) return next();
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  try {
    const blog = req.params.slug ? await Blog.findOne({ slug: req.params.slug, ...PUBLISHED }) : null;
    if (blog) {
      const base = siteUrl(req);
      const description = (blog.description || stripMarkdown(blog.content)).slice(0, 200);
      const tags = [
        `<meta property="og:type" content="article" />`,
        `<meta property="og:title" content="${esc(blog.title)}" />`,
        `<meta property="og:description" content="${esc(description)}" />`,
        `<meta property="og:url" content="${base}/post/${esc(blog.slug)}" />`,
        `<meta name="twitter:card" content="${blog.coverImage ? 'summary_large_image' : 'summary'}" />`,
        blog.coverImage ? `<meta property="og:image" content="${esc(blog.coverImage)}" />` : '',
        `<link rel="canonical" href="${base}/post/${esc(blog.slug)}" />`,
      ].join('\n    ');
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(blog.title)} · Blogify</title>`)
        .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`)
        .replace('</head>', `    ${tags}\n  </head>`);
    }
  } catch (error) {
    console.error('[SEO] meta render failed:', error.message);
  }
  return res.send(html);
};

module.exports = { router, renderIndex };

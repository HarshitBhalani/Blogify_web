import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const slugifyHeading = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Markdown -> sanitized HTML, plus a list of h2/h3 headings for the table of contents.
export function renderMarkdown(markdown = '', title = '') {
  const raw = marked.parse(markdown || '', { gfm: true, breaks: true });
  const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });

  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html');
  const root = doc.body.firstChild;

  // AI drafts often repeat the post title as an H1; the page already shows it.
  const first = root.firstElementChild;
  if (first && first.tagName === 'H1' && title && new RegExp(`^\\s*${escapeRegExp(title.trim())}\\s*$`, 'i').test(first.textContent)) {
    first.remove();
  }

  const toc = [];
  const used = new Set();
  root.querySelectorAll('h2, h3').forEach((h) => {
    let id = slugifyHeading(h.textContent) || 'section';
    let n = 2;
    while (used.has(id)) {
      id = `${slugifyHeading(h.textContent)}-${n}`;
      n += 1;
    }
    used.add(id);
    h.id = id;
    toc.push({ id, text: h.textContent, level: h.tagName === 'H2' ? 2 : 3 });
  });

  root.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  return { html: root.innerHTML, toc };
}

export const stripMarkdown = (text = '') =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const wordCount = (text = '') => stripMarkdown(text).split(' ').filter(Boolean).length;

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

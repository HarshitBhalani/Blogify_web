import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, streamText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePageMeta } from '../lib/hooks';
import { renderMarkdown, wordCount } from '../lib/markdown';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

const EMPTY = { title: '', description: '', content: '', tags: '', coverImage: '' };

const REWRITE_ACTIONS = [
  { key: 'shorter', label: 'Shorter' },
  { key: 'longer', label: 'Longer' },
  { key: 'clearer', label: 'Clearer' },
  { key: 'casual', label: 'Casual' },
  { key: 'formal', label: 'Formal' },
  { key: 'grammar', label: 'Fix grammar' },
];

const backupKey = (slug) => `blogify.draft.${slug || 'new'}`;

const readBackup = (slug) => {
  try {
    return JSON.parse(localStorage.getItem(backupKey(slug)) || 'null');
  } catch (error) {
    return null;
  }
};

const writeBackup = (slug, fields) => {
  try {
    localStorage.setItem(backupKey(slug), JSON.stringify({ ...fields, savedAt: Date.now() }));
  } catch (error) {
    // storage unavailable
  }
};

const clearBackup = (slug) => {
  try {
    localStorage.removeItem(backupKey(slug));
  } catch (error) {
    // ignore
  }
};

const sameFields = (a, b) => Object.keys(EMPTY).every((k) => (a[k] || '') === (b[k] || ''));

const toFields = (post) => ({
  title: post.title || '',
  description: post.description || '',
  content: post.content || '',
  tags: (post.tags || []).join(', '),
  coverImage: post.coverImage || '',
});

export default function Editor() {
  const { slug } = useParams();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const isEdit = Boolean(slug);

  const [fields, setFields] = useState(EMPTY);
  const [saved, setSaved] = useState(EMPTY); // last version stored on the server
  const [post, setPost] = useState(null);
  const [loadState, setLoadState] = useState(isEdit ? 'loading' : 'ok');
  const [backup, setBackup] = useState(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('write');
  const [errors, setErrors] = useState({});

  // AI state
  const [tone, setTone] = useState('conversational');
  const [audience, setAudience] = useState('general');
  const [length, setLength] = useState('medium');
  const [outline, setOutline] = useState('');
  const [aiBusy, setAiBusy] = useState(''); // '', 'outline', 'draft', 'rewrite', 'suggest'
  const [suggestions, setSuggestions] = useState(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const streamAbort = useRef(null);
  const contentRef = useRef(null);

  usePageMeta(isEdit ? `Editing: ${fields.title || 'post'}` : 'New post');

  const dirty = !sameFields(fields, saved);
  const set = (key) => (event) => {
    const { value } = event.target;
    setFields((f) => ({ ...f, [key]: value }));
    // Clear a field's error as soon as the writer fixes it.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  // Load the post being edited, then offer any newer unsaved local copy.
  useEffect(() => {
    if (!user) return;
    if (!isEdit) {
      const local = readBackup(null);
      if (local && !sameFields(local, EMPTY)) setBackup(local);
      return;
    }
    setLoadState('loading');
    api(`/blogs/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!data.canEdit) {
          setLoadState('forbidden');
          return;
        }
        const f = toFields(data);
        setPost(data);
        setFields(f);
        setSaved(f);
        setLoadState('ok');
        const local = readBackup(slug);
        if (local && local.savedAt > new Date(data.updatedAt).getTime() && !sameFields(local, f)) setBackup(local);
      })
      .catch((error) => setLoadState(error.status === 404 ? 'missing' : 'error'));
  }, [slug, isEdit, user]);

  // Autosave to this browser so nothing is lost if the tab closes.
  useEffect(() => {
    if (loadState !== 'ok' || backup || !dirty) return undefined;
    const t = setTimeout(() => writeBackup(post ? post.slug : null, fields), 600);
    return () => clearTimeout(t);
  }, [fields, dirty, loadState, backup, post]);

  useEffect(() => {
    const warn = (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => () => streamAbort.current && streamAbort.current.abort(), []);

  const save = useCallback(
    async (status) => {
      // Title is always required; content only when publishing. Cover must be a web link if given.
      const errs = {};
      if (!fields.title.trim()) errs.title = 'Title is required';
      if (status === 'published' && !fields.content.trim()) errs.content = 'Write some content before publishing';
      if (fields.coverImage.trim() && !/^https?:\/\/\S+$/i.test(fields.coverImage.trim())) {
        errs.coverImage = 'Enter a full link starting with https://';
      }
      setErrors(errs);
      if (Object.keys(errs).length) {
        const firstId = { title: 'post-title', content: 'post-content', coverImage: 'post-cover' }[Object.keys(errs)[0]];
        if (errs.content && view === 'preview') setView('write');
        requestAnimationFrame(() => {
          const el = document.getElementById(firstId);
          if (el) {
            el.focus();
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        });
        toast.error(Object.values(errs)[0]);
        return;
      }
      setSaving(true);
      try {
        const body = { ...fields, status };
        const result = post
          ? await api(`/blogs/${post.id}`, { method: 'PUT', body })
          : await api('/blogs', { method: 'POST', body });
        const f = toFields(result);
        clearBackup(post ? post.slug : null);
        clearBackup(result.slug);
        setPost(result);
        setFields(f);
        setSaved(f);
        if (status === 'published') {
          toast.success(post && post.status === 'published' ? 'Changes published' : 'Post published');
          navigate(`/post/${result.slug}`);
        } else {
          toast.success('Draft saved');
          if (!isEdit) navigate(`/edit/${result.slug}`, { replace: true });
        }
      } catch (error) {
        toast.error(error.message);
      } finally {
        setSaving(false);
      }
    },
    [fields, post, isEdit, navigate, view]
  );

  // Ctrl/Cmd + S saves without publishing.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!saving) save(post && post.status === 'published' ? 'published' : 'draft');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, saving, post]);

  // ---------- AI ----------
  const aiError = (error) => {
    if (error.name === 'AbortError') return;
    toast.error(error.message || 'The AI request failed');
  };

  const getOutline = async () => {
    if (!fields.title.trim()) return toast.error('Write a title first');
    setAiBusy('outline');
    try {
      const data = await api('/ai/outline', { method: 'POST', body: { title: fields.title, tone, audience } });
      setOutline(data.outline);
    } catch (error) {
      aiError(error);
    } finally {
      setAiBusy('');
    }
    return undefined;
  };

  // Settings used for the most recent AI draft, and the text it produced.
  // While the writer has not edited that text, changing a setting redrafts it straight away.
  const lastDraft = useRef(null);

  const writeDraft = async (useOutline, { settings, outlineText, skipConfirm = false } = {}) => {
    if (!fields.title.trim()) return toast.error('Write a title first');
    if (!skipConfirm && fields.content.trim() && !window.confirm('Replace the current content with a new AI draft?')) {
      return undefined;
    }
    const params = settings || { tone, audience, length };
    const usedOutline = outlineText !== undefined ? outlineText : useOutline ? outline : '';
    const before = lastDraft.current && skipConfirm ? lastDraft.current.before : fields.content;
    const controller = new AbortController();
    streamAbort.current = controller;
    lastDraft.current = { params, outline: usedOutline, text: '', before, streaming: true };
    setAiBusy('draft');
    setFields((f) => ({ ...f, content: '' }));
    if (view === 'write') setView('split');
    try {
      const text = await streamText(
        '/ai/draft',
        { title: fields.title, outline: usedOutline, ...params },
        (partial) => {
          lastDraft.current.text = partial;
          setFields((f) => ({ ...f, content: partial }));
        },
        controller.signal
      );
      lastDraft.current = { ...lastDraft.current, text, streaming: false };
      if (useOutline) setOutline('');
      toast.success('Draft ready. Change tone, audience or length to redraft it.');
    } catch (error) {
      if (error.name === 'AbortError') {
        // A restart (setting changed mid-stream) aborts quietly; the new draft takes over.
        if (!controller.restarted) {
          lastDraft.current = { ...lastDraft.current, streaming: false };
          toast('Stopped. Kept what was written so far.');
        }
      } else {
        lastDraft.current = null;
        setFields((f) => ({ ...f, content: before }));
        aiError(error);
      }
    } finally {
      if (streamAbort.current === controller) {
        streamAbort.current = null;
        setAiBusy('');
      }
    }
    return undefined;
  };

  // Redraft instantly when a setting changes, as long as the current text is still the AI's
  // untouched draft (or a draft is streaming). Edited text is never replaced silently.
  useEffect(() => {
    const last = lastDraft.current;
    if (!last) return undefined;
    const settings = { tone, audience, length };
    const changed = Object.keys(settings).some((k) => settings[k] !== last.params[k]);
    if (!changed) return undefined;
    const untouched = last.streaming || fields.content === last.text;
    if (!untouched) return undefined;

    const t = setTimeout(() => {
      if (streamAbort.current) {
        streamAbort.current.restarted = true;
        streamAbort.current.abort();
        streamAbort.current = null;
      }
      writeDraft(false, { settings, outlineText: last.outline, skipConfirm: true });
    }, 300);
    return () => clearTimeout(t);
    // Only setting changes should trigger this; content is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tone, audience, length]);

  const draftEdited =
    lastDraft.current &&
    !lastDraft.current.streaming &&
    fields.content !== lastDraft.current.text &&
    ['tone', 'audience', 'length'].some((k) => ({ tone, audience, length })[k] !== lastDraft.current.params[k]);

  const selectedText = fields.content.slice(selection.start, selection.end);
  const hasSelection = selectedText.trim().length >= 10 && view !== 'preview';

  const rewrite = async (action) => {
    const { start, end } = selection;
    const original = fields.content;
    setAiBusy('rewrite');
    try {
      const data = await api('/ai/rewrite', { method: 'POST', body: { text: original.slice(start, end), action } });
      const next = original.slice(0, start) + data.text + original.slice(end);
      setFields((f) => ({ ...f, content: next }));
      setSelection({ start, end: start + data.text.length });
      requestAnimationFrame(() => {
        const el = contentRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(start, start + data.text.length);
        }
      });
      toast.success('Selection rewritten', {
        action: { label: 'Undo', onClick: () => setFields((f) => ({ ...f, content: original })) },
      });
    } catch (error) {
      aiError(error);
    } finally {
      setAiBusy('');
    }
  };

  const suggest = async () => {
    setAiBusy('suggest');
    try {
      const data = await api('/ai/suggest', { method: 'POST', body: { title: fields.title, content: fields.content } });
      setSuggestions(data);
    } catch (error) {
      aiError(error);
    } finally {
      setAiBusy('');
    }
  };

  const addTags = (tags) => {
    const current = fields.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const merged = [...new Set([...current, ...tags.map((t) => t.toLowerCase())])].slice(0, 6);
    setFields((f) => ({ ...f, tags: merged.join(', ') }));
  };

  const trackSelection = (event) => {
    setSelection({ start: event.target.selectionStart, end: event.target.selectionEnd });
  };

  const preview = useMemo(() => renderMarkdown(fields.content, fields.title).html, [fields.content, fields.title]);
  const words = wordCount(fields.content);

  // ---------- Guards ----------
  if (ready && !user) return <Navigate to="/login" state={{ from: isEdit ? `/edit/${slug}` : '/write' }} replace />;
  if (loadState === 'loading' || !ready) {
    return (
      <main className="editor-page">
        <div className="skeleton-title" />
      </main>
    );
  }
  if (loadState !== 'ok') {
    const msg = {
      forbidden: 'You can only edit your own posts.',
      missing: 'This post does not exist.',
      error: 'Could not load this post.',
    }[loadState];
    return (
      <main className="narrow-page center">
        <p>{msg}</p>
        <Link to="/" className="text-link">
          Back to posts
        </Link>
      </main>
    );
  }

  const isPublished = post && post.status === 'published';
  const busy = Boolean(aiBusy);

  return (
    <main className="editor-page">
      <div className="editor-bar">
        <Link to={post ? (isPublished ? `/post/${post.slug}` : '/me') : '/'} className="text-link">
          <i className="fas fa-arrow-left" aria-hidden="true"></i> Back
        </Link>
        <span className="save-state" aria-live="polite">
          {saving ? 'Saving...' : dirty ? 'Unsaved changes · backed up in this browser' : post ? 'All changes saved' : ''}
        </span>
        <div className="editor-bar-actions">
          {!isPublished && (
            <Button variant="outline" size="sm" onClick={() => save('draft')} disabled={saving || busy}>
              Save draft
            </Button>
          )}
          {isPublished && (
            <Button variant="outline" size="sm" onClick={() => save('draft')} disabled={saving || busy} title="Hide from readers">
              Unpublish
            </Button>
          )}
          <Button size="sm" onClick={() => save('published')} disabled={saving || busy}>
            {isPublished ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      {backup && (
        <div className="notice">
          <span>You have unsaved changes from {new Date(backup.savedAt).toLocaleString()}.</span>
          <span className="notice-actions">
            <Button
              size="sm"
              onClick={() => {
                setFields({ ...EMPTY, ...backup });
                setBackup(null);
              }}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearBackup(post ? post.slug : null);
                setBackup(null);
              }}
            >
              Discard
            </Button>
          </span>
        </div>
      )}

      <label htmlFor="post-title" className="title-label">
        Title <span className="req" aria-hidden="true">*</span>
        <span className="sr-only">(required)</span>
      </label>
      <textarea
        id="post-title"
        className={`title-input ${errors.title ? 'is-invalid' : ''}`}
        rows={1}
        value={fields.title}
        onChange={set('title')}
        placeholder="Post title"
        maxLength={200}
        aria-invalid={Boolean(errors.title)}
        aria-describedby={errors.title ? 'title-error' : undefined}
        onInput={(e) => {
          e.target.style.height = 'auto';
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
      />
      {errors.title && (
        <p id="title-error" className="field-error title-error">
          {errors.title}
        </p>
      )}

      <section className="ai-panel" aria-label="AI drafting">
        <div className="ai-row">
          <span className="ai-label">AI draft</span>
          <label className="select">
            <span className="sr-only">Tone</span>
            <select value={tone} onChange={(e) => setTone(e.target.value)} disabled={busy && aiBusy !== 'draft'}>
              <option value="conversational">Conversational</option>
              <option value="professional">Professional</option>
              <option value="playful">Playful</option>
              <option value="technical">Technical</option>
            </select>
          </label>
          <label className="select">
            <span className="sr-only">Audience</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} disabled={busy && aiBusy !== 'draft'}>
              <option value="beginner">For beginners</option>
              <option value="general">For everyone</option>
              <option value="expert">For experts</option>
            </select>
          </label>
          <label className="select">
            <span className="sr-only">Length</span>
            <select value={length} onChange={(e) => setLength(e.target.value)} disabled={busy && aiBusy !== 'draft'}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </label>
          <span className="ai-actions">
            <Button variant="outline" size="sm" onClick={getOutline} disabled={busy || !fields.title.trim()}>
              {aiBusy === 'outline' ? 'Thinking...' : 'Outline first'}
            </Button>
            {aiBusy === 'draft' ? (
              <Button variant="secondary" size="sm" onClick={() => streamAbort.current && streamAbort.current.abort()}>
                <i className="fas fa-stop" aria-hidden="true"></i> Stop
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => writeDraft(false)} disabled={busy || !fields.title.trim()}>
                Write draft
              </Button>
            )}
          </span>
        </div>
        {!fields.title.trim() && <p className="hint">Add a title to use the AI tools.</p>}
        {aiBusy === 'draft' && <p className="hint">Drafting... change tone, audience or length to restart with the new setting.</p>}
        {draftEdited && !busy && (
          <p className="hint">
            You edited the draft, so it was not replaced automatically.{' '}
            <button
              type="button"
              className="text-link"
              onClick={() => writeDraft(false, { outlineText: lastDraft.current.outline })}
            >
              Redraft with these settings
            </button>
          </p>
        )}

        {outline && (
          <div className="outline-box">
            <label htmlFor="outline" className="field-label">
              Outline <span className="muted">edit, reorder or delete sections before drafting</span>
            </label>
            <Textarea id="outline" className="mono" rows={8} value={outline} onChange={(e) => setOutline(e.target.value)} />
            <div className="row-end">
              <Button variant="ghost" size="sm" onClick={() => setOutline('')} disabled={busy}>
                Discard
              </Button>
              <Button size="sm" onClick={() => writeDraft(true)} disabled={busy}>
                Write draft from this outline
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="editor-tabs" role="tablist" aria-label="Editor view">
        <span className="tabs-label">
          Content <span className="req" aria-hidden="true">*</span>
        </span>
        {[
          ['write', 'Write'],
          ['preview', 'Preview'],
          ['split', 'Side by side'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={`tab ${view === key ? 'is-active' : ''} ${key === 'split' ? 'hide-sm' : ''}`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
        <span className="word-count">{words} words · {Math.max(1, Math.round(words / 220))} min read</span>
      </div>

      <div className={`rewrite-bar ${hasSelection ? 'is-visible' : ''}`} aria-hidden={!hasSelection}>
        <span className="muted">Rewrite selection:</span>
        {REWRITE_ACTIONS.map((a) => (
          <button key={a.key} type="button" className="chip" onClick={() => rewrite(a.key)} disabled={busy || !hasSelection}>
            {a.label}
          </button>
        ))}
        {aiBusy === 'rewrite' && <span className="muted">Rewriting...</span>}
      </div>

      <div className={`editor-panes view-${view}`}>
        {view !== 'preview' && (
          <div className="pane">
            <label htmlFor="post-content" className="sr-only">
              Content in Markdown (required to publish)
            </label>
            <textarea
              id="post-content"
              ref={contentRef}
              className={`content-input ${errors.content ? 'is-invalid' : ''}`}
              aria-invalid={Boolean(errors.content)}
              aria-describedby={errors.content ? 'content-error' : undefined}
              value={fields.content}
              onChange={set('content')}
              onSelect={trackSelection}
              placeholder={'Write in Markdown.\n\n## A section heading\n\nA paragraph. **Bold**, _italic_, [a link](https://example.com).\n\n- a list item'}
              readOnly={aiBusy === 'draft' || aiBusy === 'rewrite'}
              spellCheck
            />
          </div>
        )}
        {view !== 'write' && (
          <div className="pane pane-preview">
            {fields.content.trim() ? (
              <div className="prose" dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <p className="muted">The preview appears here as you write.</p>
            )}
          </div>
        )}
      </div>
      {errors.content && (
        <p id="content-error" className="field-error">
          {errors.content}
        </p>
      )}

      <section className="details" aria-labelledby="details-heading">
        <div className="details-head">
          <h2 id="details-heading">Post details</h2>
          <Button variant="outline" size="sm" onClick={suggest} disabled={busy || (!fields.title.trim() && !fields.content.trim())}>
            {aiBusy === 'suggest' ? 'Thinking...' : 'Suggest title, summary and tags'}
          </Button>
        </div>

        {suggestions && (
          <div className="suggestions">
            {suggestions.titles.length > 0 && (
              <div>
                <p className="field-label">Title ideas</p>
                <div className="chip-wrap">
                  {suggestions.titles.map((t) => (
                    <button key={t} type="button" className="chip chip-lg" onClick={() => setFields((f) => ({ ...f, title: t }))}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {suggestions.summary && (
              <div>
                <p className="field-label">Summary</p>
                <p className="suggestion-text">{suggestions.summary}</p>
                <button type="button" className="text-link" onClick={() => setFields((f) => ({ ...f, description: suggestions.summary }))}>
                  Use this summary
                </button>
              </div>
            )}
            {suggestions.tags.length > 0 && (
              <div>
                <p className="field-label">Tags</p>
                <div className="chip-wrap">
                  {suggestions.tags.map((t) => (
                    <button key={t} type="button" className="chip" onClick={() => addTags([t])}>
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button type="button" className="text-link" onClick={() => setSuggestions(null)}>
              Hide suggestions
            </button>
          </div>
        )}

        <div className="details-grid">
          <div className="field span-2">
            <label htmlFor="post-summary">Summary</label>
            <Textarea
              id="post-summary"
              rows={2}
              value={fields.description}
              onChange={set('description')}
              maxLength={300}
              placeholder="One or two sentences shown in the post list and in link previews."
            />
          </div>
          <div className="field">
            <label htmlFor="post-tags">Tags</label>
            <Input id="post-tags" value={fields.tags} onChange={set('tags')} placeholder="react, career, productivity" />
            <small className="hint">Comma separated, up to 6.</small>
          </div>
          <div className="field">
            <label htmlFor="post-cover">Cover image URL</label>
            <Input
              id="post-cover"
              type="url"
              value={fields.coverImage}
              onChange={set('coverImage')}
              placeholder="https://..."
              aria-invalid={Boolean(errors.coverImage)}
              aria-describedby={errors.coverImage ? 'cover-error' : undefined}
            />
            {errors.coverImage ? (
              <p id="cover-error" className="field-error">
                {errors.coverImage}
              </p>
            ) : (
              <small className="hint">Optional. Paste a link to an image (for example from Unsplash).</small>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

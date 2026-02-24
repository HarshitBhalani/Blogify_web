import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { Alert, AlertDescription } from './components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Toaster, toast } from 'sonner';
import { marked } from 'marked';

const APP_NAME = 'Blogify';

const App = () => {
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [showBlogDetail, setShowBlogDetail] = useState(false);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGenerateSuccess, setAIGenerateSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    author: '',
    contentType: 'markdown',
  });

  const apiURL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api';
  const blogsSectionRef = useRef(null);

  const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString();
  };

  const stripMarkdown = (text = '') =>
    text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/[#>*_~-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content: '',
      author: '',
      contentType: 'markdown',
    });
    setIsGeneratingAI(false);
    setAIGenerateSuccess(false);
    setSaveError('');
  };

  const fetchBlogs = useCallback(async ({ firstLoad = false } = {}) => {
    if (firstLoad) setLoading(true);

    try {
      setPageError('');
      const response = await fetch(`${apiURL}/blogs`);
      if (!response.ok) {
        throw new Error(`Failed to fetch blogs (${response.status})`);
      }

      const data = await response.json();
      setBlogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching blogs:', error);
      setPageError('Unable to load blogs right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [apiURL]);

  useEffect(() => {
    fetchBlogs({ firstLoad: true });
  }, [fetchBlogs]);

  const escapeHTML = (unsafeText) =>
    unsafeText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const convertMarkdownToHTML = (markdown, title = '') => {
    if (!markdown) return '';

    const rawHtml = marked.parse(markdown, {
      gfm: true,
      breaks: true,
    });

    const escapedTitle = title
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Remove the first H1 if AI content repeats the same title already shown in UI.
    const withoutDuplicateH1 = escapedTitle
      ? rawHtml.replace(new RegExp(`^\\s*<h1[^>]*>\\s*${escapedTitle}\\s*<\\/h1>\\s*`, 'i'), '')
      : rawHtml;

    return withoutDuplicateH1;
  };

  const generateAIContent = async (title) => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch(`${apiURL}/generate-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      setAIGenerateSuccess(true);
      setTimeout(() => setAIGenerateSuccess(false), 2000);
      toast.success('AI content generated');
      return data.content || '';
    } catch (error) {
      console.error('Error generating AI content:', error);
      toast.error('Failed to generate AI content');
      return '';
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateAIContent = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title first');
      return;
    }
    const aiContent = await generateAIContent(formData.title);
    if (aiContent) {
      setFormData((prev) => ({ ...prev, content: aiContent, contentType: 'markdown' }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaveError('');

    try {
      const isEdit = Boolean(editingBlog?._id);
      const response = await fetch(
        isEdit ? `${apiURL}/blogs/${editingBlog._id}` : `${apiURL}/blogs`,
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save blog (${response.status})`);
      }

      await fetchBlogs();
      resetForm();
      setShowCreateForm(false);
      setEditingBlog(null);
      toast.success(isEdit ? 'Blog updated successfully' : 'Blog created successfully');
    } catch (error) {
      console.error('Error saving blog:', error);
      setSaveError('Unable to save blog. Please review fields and try again.');
      toast.error('Unable to save blog');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this blog?')) return;

    try {
      const response = await fetch(`${apiURL}/blogs/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to delete blog (${response.status})`);
      }

      await fetchBlogs();
      setSelectedBlog(null);
      setShowBlogDetail(false);
      toast.success('Blog deleted successfully');
    } catch (error) {
      console.error('Error deleting blog:', error);
      toast.error('Unable to delete blog right now');
    }
  };

  const openCreate = () => {
    setShowCreateForm(true);
    setEditingBlog(null);
    resetForm();
  };

  const handleEdit = (blog) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title || '',
      description: blog.description || '',
      content: blog.content || '',
      author: blog.author || '',
      contentType: blog.contentType || 'markdown',
    });
    setShowCreateForm(true);
    setShowBlogDetail(false);
    setSaveError('');
  };

  const handleBlogClick = (blog) => {
    setSelectedBlog(blog);
    setShowBlogDetail(true);
  };

  const scrollToBlogs = () => {
    blogsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="app-loading">
        <Card className="app-loading-card">
          <i className="fas fa-file-alt" aria-hidden="true"></i>
          <p>Loading blogs...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <img
            src="/blogify_favicon_transparent.png"
            alt="Blogify logo"
            className="app-brand-logo"
          />
          <h1>{APP_NAME}</h1>
        </div>
        <div className="header-actions">
          <Button onClick={openCreate}>
            <i className="fas fa-plus" aria-hidden="true"></i>
            Create New Blog
          </Button>
        </div>
      </header>

      {!showBlogDetail ? (
        <main className="home-page">
          <section className="hero-simple">
            <p className="hero-kicker">AI Generated Blog Platform</p>
            <h2>Discover Your Next Viral Blog Idea with AI</h2>
            <p className="hero-copy">
              Your personal AI blog assistant for generating complete drafts, refining content, and publishing faster.
            </p>
            <div className="hero-actions hero-actions-centered">
              <Button onClick={openCreate}>
                <i className="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                Create Blog
              </Button>
              <Button variant="outline" onClick={scrollToBlogs}>
                <i className="fas fa-compass" aria-hidden="true"></i>
                Browse Blogs
              </Button>
            </div>
          </section>

          <section className="hero-feature-grid">
            <Card className="hero-feature-card">
              <CardContent>
                <div className="hero-feature-icon hero-feature-icon-ai">
                  <i className="fas fa-lightbulb" aria-hidden="true"></i>
                </div>
                <h4>AI-Generated Blogs</h4>
                <p>Create structured title, intro, headings, and key points instantly.</p>
              </CardContent>
            </Card>
            <Card className="hero-feature-card">
              <CardContent>
                <div className="hero-feature-icon hero-feature-icon-edit">
                  <i className="fas fa-pen-ruler" aria-hidden="true"></i>
                </div>
                <h4>Personalized Writing Style</h4>
                <p>Edit drafts, adjust tone, and shape every post to match your voice.</p>
              </CardContent>
            </Card>
            <Card className="hero-feature-card">
              <CardContent>
                <div className="hero-feature-icon hero-feature-icon-manage">
                  <i className="fas fa-folder-tree" aria-hidden="true"></i>
                </div>
                <h4>Save and Manage Posts</h4>
                <p>Browse, update, and delete all your blogs from one dashboard.</p>
              </CardContent>
            </Card>
          </section>

          {pageError && (
            <Alert variant="destructive" className="alert-error">
              <i className="fas fa-triangle-exclamation" aria-hidden="true"></i>
              <AlertDescription>{pageError}</AlertDescription>
            </Alert>
          )}

          <section className="section-header" ref={blogsSectionRef}>
            <h3>All Blogs</h3>
            <p>{blogs.length} available</p>
          </section>

          {blogs.length === 0 ? (
            <Card className="empty-state">
              <i className="fas fa-folder-open" aria-hidden="true"></i>
              <h4>No blog posts yet</h4>
              <p>Start by creating your first post. You can also generate content with AI from a title.</p>
              <Button onClick={openCreate}>
                <i className="fas fa-pen-to-square" aria-hidden="true"></i>
                Create First Blog
              </Button>
            </Card>
          ) : (
            <section className="blog-grid">
              {blogs.map((blog) => (
                <Card key={blog._id} className="blog-card" onClick={() => handleBlogClick(blog)}>
                  <CardContent>
                    <h4>{blog.title || 'Untitled Post'}</h4>
                    <p>{stripMarkdown(blog.description || blog.content || '').slice(0, 180)}...</p>
                    <div className="blog-card-footer">
                      <Badge variant="secondary">
                        <i className="fas fa-user-edit" aria-hidden="true"></i>
                        {blog.author || 'Anonymous'}
                      </Badge>
                      <Badge variant="outline">
                        <i className="fas fa-calendar-alt" aria-hidden="true"></i>
                        {formatDate(blog.createdAt)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </main>
      ) : (
        <main className="detail-page">
          <Card className="detail-shell">
            <div className="detail-toolbar">
              <Button variant="outline" onClick={() => setShowBlogDetail(false)}>
                <i className="fas fa-arrow-left" aria-hidden="true"></i>
                Back to Blogs
              </Button>
              <div className="toolbar-actions">
                <Button variant="secondary" onClick={() => handleEdit(selectedBlog)}>
                  <i className="fas fa-pen" aria-hidden="true"></i>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(selectedBlog._id)}>
                  <i className="fas fa-trash" aria-hidden="true"></i>
                  Delete
                </Button>
              </div>
            </div>

            <h2 className="detail-title">{selectedBlog.title}</h2>
            <div className="detail-meta">
              <Badge variant="secondary">
                <i className="fas fa-user-edit" aria-hidden="true"></i>
                {selectedBlog.author || 'Anonymous'}
              </Badge>
              <Badge variant="outline">
                <i className="fas fa-calendar-alt" aria-hidden="true"></i>
                {formatDate(selectedBlog.createdAt)}
              </Badge>
              {selectedBlog.updatedAt !== selectedBlog.createdAt && (
                <Badge variant="outline">
                  <i className="fas fa-clock-rotate-left" aria-hidden="true"></i>
                  Updated {formatDate(selectedBlog.updatedAt)}
                </Badge>
              )}
            </div>

            <p className="detail-description">{selectedBlog.description}</p>

            <article
              className="blog-content-rendered"
              dangerouslySetInnerHTML={{
                __html:
                  selectedBlog.contentType === 'markdown'
                    ? convertMarkdownToHTML(selectedBlog.content, selectedBlog.title)
                    : escapeHTML(selectedBlog.content || '').replace(/\n/g, '<br>'),
              }}
            />
          </Card>
        </main>
      )}

      <Dialog open={showCreateForm}>
        <DialogContent role="dialog" aria-modal="true" aria-label="Create or edit blog">
          <DialogHeader>
            <DialogTitle>{editingBlog ? 'Edit Blog' : 'Create New Blog'}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="icon-close-btn"
              onClick={() => {
                setShowCreateForm(false);
                setEditingBlog(null);
                resetForm();
              }}
              aria-label="Close form"
            >
              <i className="fas fa-xmark" aria-hidden="true"></i>
            </Button>
          </DialogHeader>

          {saveError && (
            <Alert variant="destructive" className="alert-error">
              <i className="fas fa-circle-exclamation" aria-hidden="true"></i>
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <label className="form-label" htmlFor="blog-title">
              Title
            </label>
            <Input
              id="blog-title"
              type="text"
              value={formData.title}
              onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
              required
            />

            <label className="form-label" htmlFor="blog-description">
              Description
            </label>
            <Textarea
              id="blog-description"
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              rows="3"
              required
            />

            <label className="form-label" htmlFor="blog-content">
              Content
            </label>
            <Textarea
              id="blog-content"
              value={formData.content}
              onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
              rows="12"
              required
              placeholder={isGeneratingAI ? 'AI is generating content...' : 'Write your blog content here...'}
              disabled={isGeneratingAI}
            />

            <div className="ai-assist-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateAIContent}
                disabled={!formData.title.trim() || isGeneratingAI}
              >
                <i className="fas fa-robot" aria-hidden="true"></i>
                {aiGenerateSuccess ? 'Generated' : 'Generate AI Content'}
              </Button>
              <small>AI generates formatted markdown sections for your title.</small>
            </div>

            <label className="form-label" htmlFor="blog-author">
              Author
            </label>
            <Input
              id="blog-author"
              type="text"
              value={formData.author}
              onChange={(event) => setFormData((prev) => ({ ...prev, author: event.target.value }))}
              placeholder="Anonymous"
            />

            <DialogFooter className="form-actions">
              <Button type="submit">
                <i className="fas fa-floppy-disk" aria-hidden="true"></i>
                {editingBlog ? 'Update Blog' : 'Create Blog'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingBlog(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
};

export default App;

import React, { useState, useEffect } from 'react';

const App = () => {
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBlogDetail, setShowBlogDetail] = useState(false);
  
  // AI Button states
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGenerateSuccess, setAIGenerateSuccess] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    author: '',
    contentType: 'markdown'
  });

  useEffect(() => {
  fetchBlogs();
}, []);

  // Updated API URL configuration
  const getAPIURL = () => {
    return process.env.NODE_ENV === 'production' 
      ? '/api'
      : 'http://localhost:5000/api';
  };

  // Simple markdown to HTML converter
  const convertMarkdownToHTML = (markdown) => {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Blockquotes
    html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');
    
    // Lists
    html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>');
    html = html.replace(/^[\*\-] (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
      if (!match.includes('<ol>')) {
        return `<ul>${match}</ul>`;
      }
      return match;
    });
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraphs
    html = `<p>${html}</p>`;
    
    // Clean up multiple paragraph tags
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>.*?<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>.*?<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>.*?<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ol>.*?<\/ol>)<\/p>/g, '$1');
    
    return html;
  };

  // Fetch all blogs
  const fetchBlogs = async () => {
    try {
      const API_URL = getAPIURL();
      const response = await fetch(`${API_URL}/blogs`);
      const data = await response.json();
      setBlogs(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching blogs:', error);
      setLoading(false);
    }
  };

  // Generate AI content
  const generateAIContent = async (title) => {
    setIsGeneratingAI(true);
    try {
      const API_URL = getAPIURL();
      const response = await fetch(`${API_URL}/generate-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setAIGenerateSuccess(true);
      setTimeout(() => setAIGenerateSuccess(false), 2000);
      
      return data.content;
    } catch (error) {
      console.error('Error generating AI content:', error);
      alert('Failed to generate AI content. Please try again.');
      return '';
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Create or update blog
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const API_URL = getAPIURL();
      const url = editingBlog 
        ? `${API_URL}/blogs/${editingBlog._id}`
        : `${API_URL}/blogs`;
      
      const method = editingBlog ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        fetchBlogs();
        resetForm();
        setShowCreateForm(false);
        setEditingBlog(null);
      }
    } catch (error) {
      console.error('Error saving blog:', error);
    }
  };

  // Delete blog
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this blog?')) {
      try {
        const API_URL = getAPIURL();
        await fetch(`${API_URL}/blogs/${id}`, {
          method: 'DELETE',
        });
        fetchBlogs();
        setSelectedBlog(null);
        setShowBlogDetail(false);
      } catch (error) {
        console.error('Error deleting blog:', error);
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content: '',
      author: '',
      contentType: 'markdown'
    });
    setIsGeneratingAI(false);
    setAIGenerateSuccess(false);
  };

  // Handle edit
  const handleEdit = (blog) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title,
      description: blog.description,
      content: blog.content,
      author: blog.author,
      contentType: blog.contentType || 'markdown'
    });
    setShowCreateForm(true);
    setShowBlogDetail(false);
  };

  // Handle blog click
  const handleBlogClick = (blog) => {
    setSelectedBlog(blog);
    setShowBlogDetail(true);
  };

  // Handle AI content generation
  const handleGenerateAIContent = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title first to generate AI content');
      return;
    }
    
    const aiContent = await generateAIContent(formData.title);
    if (aiContent) {
      setFormData(prev => ({ ...prev, content: aiContent, contentType: 'markdown' }));
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        fontSize: '18px',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📝</div>
          <div>Loading blogs...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      margin: 0, 
      padding: 0,
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: '#2c3e50', 
        color: 'white', 
        padding: '20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ margin: 0, fontSize: '28px' }}>📝 Blogify</h1>
          {/* {showBlogDetail && (
            <button 
              onClick={() => setShowBlogDetail(false)}
              style={{
                backgroundColor: '#34495e',
                color: 'white',
                border: 'none',
                padding: '8px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Blogs
            </button>
          )} */}
        </div>
        <button 
          onClick={() => {
            setShowCreateForm(true);
            setEditingBlog(null);
            resetForm();
          }}
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            transition: 'background-color 0.3s'
          }}
        >
           Create New Blog
        </button>
      </header>

      {/* Main Content */}
      {!showBlogDetail ? (
        // Grid View
        <div style={{ padding: '20px' }}>
          <h2 style={{ 
            marginBottom: '20px', 
            color: '#2c3e50',
            textAlign: 'center',
            fontSize: '24px'
          }}>
            All Blogs ({blogs.length})
          </h2>
          
          {blogs.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#7f8c8d', 
              fontSize: '18px',
              padding: '60px 20px'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '20px' }}>📝</div>
              <div>No blogs yet. Create your first blog! 🚀</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '20px',
              maxWidth: '1200px',
              margin: '0 auto'
            }}>
              {blogs.map(blog => (
                <div 
                  key={blog._id} 
                  onClick={() => handleBlogClick(blog)}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease',
                    border: '1px solid #e1e8ed',
                    height: 'fit-content'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                  }}
                >
                  <h3 style={{ 
                    margin: '0 0 15px 0', 
                    color: '#2c3e50',
                    fontSize: '20px',
                    lineHeight: '1.3'
                  }}>
                    {blog.title}
                  </h3>
                  
                  <p style={{ 
                    margin: '0 0 20px 0', 
                    color: '#7f8c8d', 
                    fontSize: '14px',
                    lineHeight: '1.5',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {blog.description}
                  </p>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontSize: '12px', 
                    color: '#95a5a6',
                    paddingTop: '15px',
                    borderTop: '1px solid #ecf0f1'
                  }}>
                    <span style={{ 
                      backgroundColor: '#ecf0f1',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '11px'
                    }}>
                      📝 {blog.author}
                    </span>
                    <span>
                      📅 {new Date(blog.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Blog Detail View (Full Page)
        <div style={{ 
          backgroundColor: 'white', 
          minHeight: 'calc(100vh - 80px)',
          padding: '40px'
        }}>
          <div style={{ 
            maxWidth: '800px', 
            margin: '0 auto'
          }}>
            {/* Blog Actions */}
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              marginBottom: '30px',
              paddingBottom: '20px',
              borderBottom: '1px solid #ecf0f1'
            }}>
              <button 
                onClick={() => handleEdit(selectedBlog)}
                style={{
                  backgroundColor: '#f39c12',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background-color 0.3s'
                }}
              >
                 Edit
              </button>
              <button 
                onClick={() => handleDelete(selectedBlog._id)}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background-color 0.3s'
                }}
              >
                 Delete
              </button>
              {/*back to blogs button*/}
                   {showBlogDetail && (
              <button onClick={() => setShowBlogDetail(false)}
              style={{
                backgroundColor: '#34495e',
                color: 'white',
                border: 'none',
                padding: '8px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
              ← Blogs
            </button>
              )}
            </div>
            
            {/* Blog Title */}
            <h1 style={{ 
              color: '#2c3e50', 
              marginBottom: '20px',
              fontSize: '36px',
              lineHeight: '1.2'
            }}>
              {selectedBlog.title}
            </h1>
            
            {/* Blog Meta */}
            <div style={{ 
              display: 'flex', 
              gap: '20px', 
              marginBottom: '30px', 
              fontSize: '14px', 
              color: '#7f8c8d',
              flexWrap: 'wrap'
            }}>
              <span style={{ 
                backgroundColor: '#ecf0f1',
                padding: '6px 12px',
                borderRadius: '15px'
              }}>
                📝 By {selectedBlog.author}
              </span>
              <span style={{ 
                backgroundColor: '#ecf0f1',
                padding: '6px 12px',
                borderRadius: '15px'
              }}>
                📅 {new Date(selectedBlog.createdAt).toLocaleDateString()}
              </span>
              {selectedBlog.updatedAt !== selectedBlog.createdAt && (
                <span style={{ 
                  backgroundColor: '#ecf0f1',
                  padding: '6px 12px',
                  borderRadius: '15px'
                }}>
                  🔄 Updated: {new Date(selectedBlog.updatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            
            {/* Blog Description */}
            <div style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '20px', 
              borderRadius: '8px', 
              marginBottom: '30px',
              borderLeft: '4px solid #3498db'
            }}>
              <p style={{ 
                margin: 0, 
                fontStyle: 'italic', 
                color: '#5a6c7d',
                fontSize: '16px',
                lineHeight: '1.5'
              }}>
                {selectedBlog.description}
              </p>
            </div>
            
            {/* Blog Content */}
            <div style={{ 
              lineHeight: '1.8', 
              color: '#2c3e50',
              fontSize: '16px'
            }}>
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: selectedBlog.contentType === 'markdown' 
                    ? convertMarkdownToHTML(selectedBlog.content)
                    : selectedBlog.content.replace(/\n/g, '<br>')
                }} 
                style={{
                  '& h1': { 
                    color: '#2c3e50', 
                    borderBottom: '2px solid #3498db', 
                    paddingBottom: '10px',
                    marginTop: '30px',
                    marginBottom: '20px'
                  },
                  '& h2': { 
                    color: '#34495e', 
                    borderBottom: '1px solid #bdc3c7', 
                    paddingBottom: '5px',
                    marginTop: '25px',
                    marginBottom: '15px'
                  },
                  '& h3': { 
                    color: '#5a6c7d',
                    marginTop: '20px',
                    marginBottom: '10px'
                  },
                  '& p': {
                    marginBottom: '15px'
                  },
                  '& blockquote': { 
                    backgroundColor: '#f8f9fa', 
                    borderLeft: '4px solid #3498db', 
                    margin: '20px 0', 
                    padding: '15px',
                    borderRadius: '0 5px 5px 0',
                    fontStyle: 'italic'
                  },
                  '& code': { 
                    backgroundColor: '#f1f2f6', 
                    padding: '2px 6px', 
                    borderRadius: '3px',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  },
                  '& pre': { 
                    backgroundColor: '#2c3e50', 
                    color: 'white', 
                    padding: '15px', 
                    borderRadius: '5px',
                    overflow: 'auto',
                    fontSize: '14px',
                    margin: '20px 0'
                  },
                  '& a': { 
                    color: '#3498db', 
                    textDecoration: 'none'
                  },
                  '& ul, & ol': { 
                    paddingLeft: '20px',
                    marginBottom: '15px'
                  },
                  '& li': { 
                    marginBottom: '5px'
                  },
                  '& hr': {
                    border: 'none',
                    height: '1px',
                    backgroundColor: '#ecf0f1',
                    margin: '30px 0'
                  },
                  '& table': {
                    width: '100%',
                    borderCollapse: 'collapse',
                    margin: '20px 0'
                  },
                  '& th, & td': {
                    border: '1px solid #ecf0f1',
                    padding: '8px 12px',
                    textAlign: 'left'
                  },
                  '& th': {
                    backgroundColor: '#f8f9fa',
                    fontWeight: 'bold'
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ 
              marginTop: 0, 
              color: '#2c3e50',
              fontSize: '24px'
            }}>
              {editingBlog ? ' Edit Blog' : ' Create New Blog'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '5px', 
                  fontWeight: 'bold', 
                  color: '#2c3e50' 
                }}>
                  Title:
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '5px', 
                  fontWeight: 'bold', 
                  color: '#2c3e50' 
                }}>
                  Description:
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  required
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '5px', 
                  fontWeight: 'bold', 
                  color: '#2c3e50' 
                }}>
                  Content:
                </label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    required
                    rows="10"
                    placeholder={isGeneratingAI ? "🤖 AI is generating content..." : "Write your blog content here... (Supports Markdown formatting)"}
                    disabled={isGeneratingAI}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ddd',
                      borderRadius: '5px',
                      fontSize: '16px',
                      resize: 'vertical',
                      fontFamily: 'monospace'
                    }}
                  />
                  {isGeneratingAI && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      padding: '20px',
                      borderRadius: '5px',
                      textAlign: 'center'
                    }}>
                      <div style={{ marginBottom: '10px' }}>🤖</div>
                      <div>Generating AI content...</div>
                    </div>
                  )}
                </div>
                <button 
                  type="button" 
                  onClick={handleGenerateAIContent}
                  disabled={!formData.title.trim() || isGeneratingAI}
                  style={{
                    marginTop: '10px',
                    backgroundColor: aiGenerateSuccess ? '#27ae60' : '#3498db',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: formData.title.trim() && !isGeneratingAI ? 'pointer' : 'not-allowed',
                    opacity: formData.title.trim() && !isGeneratingAI ? 1 : 0.6
                  }}
                >
                  🤖 {aiGenerateSuccess ? 'Generated!' : 'Generate AI Content'}
                </button>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#7f8c8d', 
                  marginTop: '5px' 
                }}>
                  💡 AI will generate content with rich formatting (headings, **bold**, *italic*, links, lists, etc.)
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '5px', 
                  fontWeight: 'bold', 
                  color: '#2c3e50' 
                }}>
                  Author:
                </label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="Anonymous"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                justifyContent: 'flex-end' 
              }}>
                <button 
                  type="submit"
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  {editingBlog ? ' Update Blog' : ' Create Blog'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingBlog(null);
                    resetForm();
                  }}
                  style={{
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

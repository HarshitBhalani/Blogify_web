import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const BlogList = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/blogs');
      setBlogs(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching blogs:', error);
      setLoading(false);
    }
  };

  const deleteBlog = async (id) => {
    if (window.confirm('Are you sure you want to delete this blog?')) {
      try {
        await axios.delete(`http://localhost:5000/api/blogs/${id}`);
        setBlogs(blogs.filter(blog => blog._id !== id));
      } catch (error) {
        console.error('Error deleting blog:', error);
      }
    }
  };

  const handleReadMore = (blog) => {
    setSelectedBlog(blog);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBlog(null);
  };

  // Simple markdown to HTML converter
  const convertMarkdownToHTML = (markdown) => {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>All Blogs</h1>
        <Link to="/create" className="btn btn-primary">
          <i className="fas fa-plus me-2"></i>
          Create New Blog
        </Link>
      </div>

      {blogs.length === 0 ? (
        <div className="text-center">
          <p className="lead">No blogs found. Create your first blog!</p>
          <Link to="/create" className="btn btn-primary">Create Blog</Link>
        </div>
      ) : (
        <div className="row g-4">
          {blogs.map(blog => (
            <div key={blog._id} className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 shadow-sm blog-card">
                <div className="card-body d-flex flex-column">
                  <h5 className="card-title fw-bold mb-3">{blog.title}</h5>
                  <p className="card-text flex-grow-1 text-muted">
                    {blog.description.length > 100 
                      ? blog.description.substring(0, 100) + '...' 
                      : blog.description}
                  </p>
                  <p className="card-text mt-auto">
                    <small className="text-muted">
                      By {blog.author || 'Anonymous'} • {new Date(blog.createdAt).toLocaleDateString()}
                    </small>
                  </p>
                </div>
                <div className="card-footer bg-transparent border-top-0 pt-0">
                  <div className="d-flex flex-wrap gap-2">
                    <button 
                      onClick={() => handleReadMore(blog)}
                      className="btn btn-primary btn-sm flex-fill"
                    >
                      <i className="fas fa-book-open me-1"></i>
                      Read More
                    </button>
                    <Link 
                      to={`/edit/${blog._id}`} 
                      className="btn btn-outline-warning btn-sm"
                    >
                      <i className="fas fa-edit"></i>
                    </Link>
                    <button 
                      onClick={() => deleteBlog(blog._id)}
                      className="btn btn-outline-danger btn-sm"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Blog Content */}
      {showModal && selectedBlog && (
        <div className="modal fade show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedBlog.title}</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={closeModal}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <small className="text-muted">
                    By {selectedBlog.author || 'Anonymous'} • {new Date(selectedBlog.createdAt).toLocaleDateString()}
                    {selectedBlog.updatedAt !== selectedBlog.createdAt && (
                      <span> • Updated: {new Date(selectedBlog.updatedAt).toLocaleDateString()}</span>
                    )}
                  </small>
                </div>
                <div className="alert alert-info">
                  <strong>Description:</strong> {selectedBlog.description}
                </div>
                <div className="blog-content">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: selectedBlog.contentType === 'markdown' 
                        ? convertMarkdownToHTML(selectedBlog.content)
                        : selectedBlog.content.replace(/\n/g, '<br>')
                    }} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Link 
                  to={`/edit/${selectedBlog._id}`} 
                  className="btn btn-warning"
                  onClick={closeModal}
                >
                  <i className="fas fa-edit me-2"></i>
                  Edit Blog
                </Link>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .blog-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          min-height: 280px;
        }
        
        .blog-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15) !important;
        }
        
        .blog-content h1, .blog-content h2, .blog-content h3 {
          color: #2c3e50;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
        }
        
        .blog-content pre {
          background-color: #f8f9fa;
          padding: 1rem;
          border-radius: 0.375rem;
          overflow-x: auto;
        }
        
        .blog-content code {
          background-color: #f8f9fa;
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        
        .blog-content blockquote {
          border-left: 4px solid #007bff;
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: #6c757d;
        }
        
        @media (max-width: 767px) {
          .blog-card {
            min-height: 250px;
          }
          
          .modal-dialog {
            margin: 0.5rem;
          }
          
          .card-footer .d-flex {
            flex-direction: column;
          }
          
          .card-footer .d-flex .btn {
            margin-bottom: 0.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default BlogList;

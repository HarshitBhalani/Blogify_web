import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const EditBlog = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    author: ''
  });
  const [loading, setLoading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [fetchingBlog, setFetchingBlog] = useState(true);

  // Dynamic API URL based on environment
  const API_URL = process.env.NODE_ENV === 'production' 
    ? '' // In production, use relative URLs
    : 'http://localhost:5000';

  useEffect(() => {
    fetchBlog();
  }, [id]);

  const fetchBlog = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/blogs/${id}`);
      const blog = response.data;
      setFormData({
        title: blog.title,
        description: blog.description,
        content: blog.content,
        author: blog.author
      });
      setFetchingBlog(false);
    } catch (error) {
      console.error('Error fetching blog:', error);
      setFetchingBlog(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const generateDescription = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title first');
      return;
    }

    setGeneratingDescription(true);
    try {
      const response = await axios.post(`${API_URL}/api/generate-description`, {
        title: formData.title
      });
      setFormData({
        ...formData,
        description: response.data.description
      });
    } catch (error) {
      console.error('Error generating description:', error);
      alert('Error generating description. Please try again.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim() || !formData.content.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/blogs/${id}`, formData);
      navigate(`/blog/${id}`);
    } catch (error) {
      console.error('Error updating blog:', error);
      alert('Error updating blog. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingBlog) {
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
      <h1>Edit Blog</h1>
      
      <form onSubmit={handleSubmit} className="card p-4">
        <div className="mb-3">
          <label className="form-label">Title *</label>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter blog title"
              required
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={generateDescription}
              disabled={generatingDescription || !formData.title.trim()}
            >
              {generatingDescription ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Generating...
                </>
              ) : (
                <>
                  <i className="fas fa-magic me-2"></i>
                  Generate Description
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">Description *</label>
          <textarea
            className="form-control"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            placeholder="Enter blog description"
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Content *</label>
          <textarea
            className="form-control"
            name="content"
            value={formData.content}
            onChange={handleChange}
            rows="10"
            placeholder="Write your blog content here..."
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Author</label>
          <input
            type="text"
            className="form-control"
            name="author"
            value={formData.author}
            onChange={handleChange}
            placeholder="Enter author name (optional)"
          />
        </div>

        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Updating...
              </>
            ) : (
              <>
                <i className="fas fa-save me-2"></i>
                Update Blog
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/blog/${id}`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditBlog;

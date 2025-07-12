import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const BlogList = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <div className="row">
          {blogs.map(blog => (
            <div key={blog._id} className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">{blog.title}</h5>
                  <p className="card-text">{blog.description}</p>
                  <p className="card-text">
                    <small className="text-muted">
                      By {blog.author} • {new Date(blog.createdAt).toLocaleDateString()}
                    </small>
                  </p>
                </div>
                <div className="card-footer">
                  <Link to={`/blog/${blog._id}`} className="btn btn-outline-primary btn-sm me-2">
                    Read More
                  </Link>
                  <Link to={`/edit/${blog._id}`} className="btn btn-outline-warning btn-sm me-2">
                    Edit
                  </Link>
                  <button 
                    onClick={() => deleteBlog(blog._id)}
                    className="btn btn-outline-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlogList;

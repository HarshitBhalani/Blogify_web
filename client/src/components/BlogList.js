import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

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
        setBlogs(blogs.filter((blog) => blog._id !== id));
      } catch (error) {
        console.error('Error deleting blog:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className='app-loading'>
        <Card className='app-loading-card'>
          <i className='fas fa-file-alt' aria-hidden='true'></i>
          <p>Loading blogs...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className='home-page'>
      <div className='section-header'>
        <h1>All Blogs</h1>
        <Link to='/create' className='ui-button ui-button-default ui-button-md'>
          <i className='fas fa-plus me-2'></i>
          Create New Blog
        </Link>
      </div>

      {blogs.length === 0 ? (
        <Card className='empty-state'>
          <i className='fas fa-folder-open' aria-hidden='true'></i>
          <p className='lead'>No blogs found. Create your first blog!</p>
          <Link to='/create' className='ui-button ui-button-default ui-button-md'>
            Create Blog
          </Link>
        </Card>
      ) : (
        <div className='blog-grid'>
          {blogs.map((blog) => (
            <Card key={blog._id} className='blog-card'>
              <CardContent>
                <Link to={`/blog/${blog._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h5>{blog.title}</h5>
                  <p>{blog.description}</p>
                </Link>
                <div className='blog-card-footer'>
                  <Badge variant='secondary'>By {blog.author}</Badge>
                  <Badge variant='outline'>{new Date(blog.createdAt).toLocaleDateString()}</Badge>
                </div>
                <div className='form-actions' style={{ marginTop: '0.75rem' }}>
                  <Link to={`/blog/${blog._id}`} className='ui-button ui-button-outline ui-button-sm'>
                    Read More
                  </Link>
                  <Link to={`/edit/${blog._id}`} className='ui-button ui-button-secondary ui-button-sm'>
                    Edit
                  </Link>
                  <Button size='sm' variant='destructive' onClick={() => deleteBlog(blog._id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlogList;

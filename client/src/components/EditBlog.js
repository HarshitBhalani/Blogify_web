import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

const EditBlog = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    author: '',
  });
  const [loading, setLoading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [fetchingBlog, setFetchingBlog] = useState(true);

  const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

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
        author: blog.author,
      });
      setFetchingBlog(false);
    } catch (error) {
      console.error('Error fetching blog:', error);
      setFetchingBlog(false);
    }
  };

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
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
        title: formData.title,
      });
      setFormData({
        ...formData,
        description: response.data.description,
      });
    } catch (error) {
      console.error('Error generating description:', error);
      alert('Error generating description. Please try again.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

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
      <div className='app-loading'>
        <Card className='app-loading-card'>
          <i className='fas fa-file-alt' aria-hidden='true'></i>
          <p>Loading blog...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className='home-page'>
      <h1>Edit Blog</h1>
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <label className='form-label'>Title *</label>
            <div className='form-actions' style={{ justifyContent: 'stretch' }}>
              <Input
                type='text'
                name='title'
                value={formData.title}
                onChange={handleChange}
                placeholder='Enter blog title'
                required
              />
              <Button
                type='button'
                variant='outline'
                onClick={generateDescription}
                disabled={generatingDescription || !formData.title.trim()}
              >
                {generatingDescription ? 'Generating...' : 'Generate Description'}
              </Button>
            </div>

            <label className='form-label'>Description *</label>
            <Textarea
              name='description'
              value={formData.description}
              onChange={handleChange}
              rows='3'
              placeholder='Enter blog description'
              required
            />

            <label className='form-label'>Content *</label>
            <Textarea
              name='content'
              value={formData.content}
              onChange={handleChange}
              rows='10'
              placeholder='Write your blog content here...'
              required
            />

            <label className='form-label'>Author</label>
            <Input
              type='text'
              name='author'
              value={formData.author}
              onChange={handleChange}
              placeholder='Enter author name (optional)'
            />

            <div className='form-actions'>
              <Button type='submit' disabled={loading}>
                {loading ? 'Updating...' : 'Update Blog'}
              </Button>
              <Button type='button' variant='outline' onClick={() => navigate(`/blog/${id}`)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditBlog;

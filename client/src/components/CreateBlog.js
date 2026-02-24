import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

const CreateBlog = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    author: '',
  });
  const [loading, setLoading] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);

  const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

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
      const response = await axios.post(`${API_URL}/api/generate-description`, { title: formData.title });
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

  const generateContent = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title first');
      return;
    }

    setGeneratingContent(true);
    try {
      const response = await axios.post(`${API_URL}/api/generate-content`, { title: formData.title });
      setFormData({
        ...formData,
        content: response.data.content,
      });
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Error generating content. Please try again.');
    } finally {
      setGeneratingContent(false);
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
      await axios.post(`${API_URL}/api/blogs`, {
        ...formData,
        contentType: 'markdown',
      });
      navigate('/');
    } catch (error) {
      console.error('Error creating blog:', error);
      alert(`Error creating blog: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='home-page'>
      <h1>Create New Blog</h1>
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
            <div className='ai-assist-row'>
              <Button
                type='button'
                variant='outline'
                onClick={generateContent}
                disabled={generatingContent || !formData.title.trim()}
              >
                {generatingContent ? 'Generating AI Content...' : 'Generate AI Content'}
              </Button>
              <small>Generate complete blog content using AI</small>
            </div>
            <Textarea
              name='content'
              value={formData.content}
              onChange={handleChange}
              rows='15'
              placeholder='Write your blog content here... or use AI to generate it!'
              required
              style={{ fontFamily: 'monospace' }}
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
              <Button type='submit' disabled={loading || generatingDescription || generatingContent}>
                {loading ? 'Creating...' : 'Create Blog'}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => navigate('/')}
                disabled={loading || generatingDescription || generatingContent}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateBlog;

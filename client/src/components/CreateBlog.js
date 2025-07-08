import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const CreateBlog = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content: '',
        author: ''
    });
    const [loading, setLoading] = useState(false);
    const [generatingDescription, setGeneratingDescription] = useState(false);

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
            const response = await axios.post('http://localhost:5000/api/generate-description', {
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
            await axios.post('http://localhost:5000/api/blogs', formData);
            navigate('/');
        } catch (error) {
            console.error('Error creating blog:', error);
            alert('Error creating blog. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>Create New Blog</h1>

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
                                Creating...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save me-2"></i>    
                                Create Blog
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate('/')}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateBlog;
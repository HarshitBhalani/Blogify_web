const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// OpenRouter API Key configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log(' Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.log(' MongoDB connection error:', err);
});

// Blog Schema
const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['markdown', 'html', 'plain'],
    default: 'markdown'
  },
  author: {
    type: String,
    default: 'Anonymous'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Blog = mongoose.model('Blog', blogSchema);

// AI Description Generation Function using OpenRouter
const generateDescription = async (title) => {
  try {
    const prompt = `Write a short 2-3 sentence description about: ${title}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const result = await response.json();
    const description = result.choices?.[0]?.message?.content || '';
    
    return description.trim();
  } catch (error) {
    console.error('Error generating description with OpenRouter:', error);
    return `Learn about ${title} and discover key insights on this topic.`;
  }
};

// Enhanced AI Content Generation Function with Rich Formatting
const generateAIContent = async (title) => {
  try {
    // Enhanced prompt for rich content generation
    const prompt = `Write a comprehensive blog post about: "${title}"

Use markdown format with:
- # for main title
- ## for section headings
- **bold** for important terms
- Bullet points for lists
- 3-4 paragraphs of quality content`;

    // Use OpenRouter API - completely free and reliable
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    let content = result.choices?.[0]?.message?.content || '';
    
    // Clean up the content
    content = content.trim();
    
    // Ensure proper markdown formatting
    if (!content.startsWith('#')) {
      content = `# ${title}\n\n${content}`;
    }
    
    // Fix common markdown issues
    content = content.replace(/\n\n\n+/g, '\n\n');
    
    return content;
  } catch (error) {
    console.error('Error generating content with OpenRouter:', error);
    // Enhanced fallback content with markdown
    return `# ${title}

> **Error Notice**: Content generation is temporarily unavailable.

## What happened?
We encountered a technical issue while generating AI content for **"${title}"**.

## Next steps:
1. **Check your API configuration** - Ensure your Gemini API key is valid
2. **Try again** - The issue might be temporary
3. **Manual creation** - You can write the content manually

### Error Details:
\`\`\`
${error.message}
\`\`\`

---

*Please try again or contact support if the issue persists.*`;
  }
};

// Generate description for title
app.post('/api/generate-description', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    const description = await generateDescription(title);
    res.json({ description });
  } catch (error) {
    console.error('Error in generate-description:', error);
    res.status(500).json({ message: 'Failed to generate description' });
  }
});

// Generate AI content for title
app.post('/api/generate-content', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    console.log(`Generating enhanced content for: ${title}`);
    const content = await generateAIContent(title);
    res.json({ 
      content,
      contentType: 'markdown'
    });
  } catch (error) {
    console.error('Error in generate-content:', error);
    res.status(500).json({ message: 'Failed to generate content' });
  }
});

// Routes

// Get all blogs
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single blog
app.get('/api/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create blog
app.post('/api/blogs', async (req, res) => {
  try {
    const { title, description, content, author, contentType } = req.body;
    
    const blog = new Blog({
      title,
      description,
      content,
      contentType: contentType || 'markdown',
      author: author || 'Anonymous'
    });

    const savedBlog = await blog.save();
    res.status(201).json(savedBlog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update blog
app.put('/api/blogs/:id', async (req, res) => {
  try {
    const { title, description, content, author, contentType } = req.body;
    
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        content,
        contentType: contentType || 'markdown',
        author,
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    res.json(blog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete blog
app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }
    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    features: ['markdown-support', 'rich-content-generation']
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`Enhanced features: Markdown support, Rich content generation`);
});
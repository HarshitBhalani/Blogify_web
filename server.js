const express = require('express');
const mongoose = require('mongoose');
const path = require('path'); 
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
// app.use(cors());
// app.use(express.json());

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// API routes
app.use('/api', require('./routes/api'));

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.log('❌ MongoDB connection error:', err);
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

// AI Description Generation Function using Gemini
const generateDescription = async (title) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Write a short 2-3 sentence description about: ${title}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const description = response.text();
    
    return description.trim();
  } catch (error) {
    console.error('Error generating description with Gemini:', error);
    return `Learn about ${title} and discover key insights on this topic.`;
  }
};

// Enhanced AI Content Generation Function with Rich Formatting
const generateAIContent = async (title) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Enhanced prompt for rich content generation
    const prompt = `Write a comprehensive and well-structured blog post about: "${title}"

Please format the content using markdown with the following guidelines:
- Use # for the main title
- Use ## for major section headings
- Use ### for subsection headings
- Use **bold text** for important terms and concepts
- Use *italic text* for emphasis
- Use numbered lists (1. 2. 3.) for step-by-step instructions
- Use bullet points (- or *) for general lists
- Use > for blockquotes when citing or highlighting important information
- Use \`inline code\` for technical terms or code snippets
- Use [link text](URL) format for any relevant links (you can use placeholder URLs like https://example.com)
- Use --- for horizontal dividers between major sections
- Keep paragraphs well-spaced with empty lines

The content should be informative, engaging, and well-structured with proper markdown formatting.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let content = response.text();
    
    // Clean up the content
    content = content.trim();
    
    // Ensure proper markdown formatting
    if (!content.startsWith('#')) {
      content = `# ${title}\n\n${content}`;
    }
    
    // Fix common markdown issues
    content = content.replace(/\n\n\n+/g, '\n\n'); // Fix excessive line breaks
    content = content.replace(/\*\*\*([^*]+)\*\*\*/g, '**$1**'); // Fix triple asterisks
    content = content.replace(/(?<!\n)\n(?![\n\-\*\d])/g, '\n\n'); // Ensure proper paragraph spacing
    
    return content;
  } catch (error) {
    console.error('Error generating content with Gemini:', error);
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

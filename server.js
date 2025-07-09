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

// Middleware - FIXED ORDER
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-render-app.onrender.com'] // Replace with your actual Render URL
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

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
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

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
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

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

// API Routes

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
    res.status(500).json({ message: 'Failed to generate description', error: error.message });
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
    res.status(500).json({ message: 'Failed to generate content', error: error.message });
  }
});

// Get all blogs
app.get('/api/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    console.error('Error fetching blogs:', error);
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
    console.error('Error fetching blog:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create blog
app.post('/api/blogs', async (req, res) => {
  try {
    const { title, description, content, author, contentType } = req.body;
    
    // Validation
    if (!title || !description || !content) {
      return res.status(400).json({ message: 'Title, description, and content are required' });
    }
    
    const blog = new Blog({
      title,
      description,
      content,
      contentType: contentType || 'markdown',
      author: author || 'Anonymous'
    });

    const savedBlog = await blog.save();
    console.log('Blog created successfully:', savedBlog._id);
    res.status(201).json(savedBlog);
  } catch (error) {
    console.error('Error creating blog:', error);
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
    console.error('Error updating blog:', error);
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
    console.error('Error deleting blog:', error);
    res.status(500).json({ message: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    mongoConnected: mongoose.connection.readyState === 1,
    features: ['markdown-support', 'rich-content-generation']
  });
});

// Serve React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`MongoDB connected: ${mongoose.connection.readyState === 1}`);
  console.log(`Enhanced features: Markdown support, Rich content generation`);
});


// Add this code to your existing server.js file

// Keep-alive endpoint (add this after your other routes)
app.get('/keep-alive', (req, res) => {
    res.status(200).json({ 
        message: 'Server is alive!', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Self-ping function to keep server awake for render 
function keepServerAlive() {
    const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://blogify-web-szk9.onrender.com/';
    
    // Only run self-ping in production (on Render)
    if (process.env.NODE_ENV === 'production' && appUrl.includes('onrender.com')) {
        setInterval(() => {
            const https = require('https');
            
            const options = {
                hostname: new URL(appUrl).hostname,
                port: 443,
                path: '/keep-alive',
                method: 'GET',
                timeout: 10000
            };
            
            const req = https.request(options, (res) => {
                console.log(`✅ Self-ping successful: ${res.statusCode} at ${new Date().toISOString()}`);
                res.on('data', () => {}); // Consume response data
            });
            
            req.on('error', (err) => {
                console.error(`❌ Self-ping failed: ${err.message}`);
            });
            
            req.on('timeout', () => {
                console.error(`⏰ Self-ping timeout`);
                req.abort();
            });
            
            req.end();
        }, 5 * 60 * 1000); // 5 minutes
        
        console.log('🔄 Keep-alive self-ping started (every 5 minutes)');
    }
}

// Start keep-alive after server starts
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start keep-alive mechanism
    keepServerAlive();
});

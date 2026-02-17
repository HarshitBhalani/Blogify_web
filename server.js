const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================= GROQ INITIALIZATION =================
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ================= MIDDLEWARE =================
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://blogify-web-szk9.onrender.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));

// ================= MONGODB CONNECTION =================
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

// ================= BLOG SCHEMA =================
const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  content: { type: String, required: true },
  contentType: {
    type: String,
    enum: ['markdown', 'html', 'plain'],
    default: 'markdown'
  },
  author: { type: String, default: 'Anonymous' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Blog = mongoose.model('Blog', blogSchema);

// ================= AI DESCRIPTION =================
const generateDescription = async (title) => {
  try {
    const prompt = `Write a short 2-3 sentence description about: ${title}`;

    const message = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 300
    });

    return message.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('Groq description error:', error);
    return `Learn about ${title} and discover key insights on this topic.`;
  }
};

// ================= AI CONTENT =================
const generateAIContent = async (title) => {
  try {
    const prompt = `Write a comprehensive markdown blog about "${title}" with headings, lists, formatting and structured content.`;

    const message = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 2000
    });

    let content = message.choices[0]?.message?.content || '';

    content = content.trim();

    if (!content.startsWith('#')) {
      content = `# ${title}\n\n${content}`;
    }

    return content;
  } catch (error) {
    console.error('Groq content error:', error);

    return `# ${title}

> Content generation temporarily unavailable.

Please try again later.`;
  }
};

// ================= API ROUTES =================

// Generate Description
app.post('/api/generate-description', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });

    const description = await generateDescription(title);
    res.json({ description });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate Content
app.post('/api/generate-content', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });

    const content = await generateAIContent(title);

    res.json({
      content,
      contentType: 'markdown'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Blogs
app.get('/api/blogs', async (req, res) => {
  const blogs = await Blog.find().sort({ createdAt: -1 });
  res.json(blogs);
});

// Get Single Blog
app.get('/api/blogs/:id', async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) return res.status(404).json({ message: 'Blog not found' });
  res.json(blog);
});

// Create Blog
app.post('/api/blogs', async (req, res) => {
  const { title, description, content, author, contentType } = req.body;

  if (!title || !description || !content) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  const blog = new Blog({
    title,
    description,
    content,
    contentType: contentType || 'markdown',
    author: author || 'Anonymous'
  });

  const savedBlog = await blog.save();
  res.status(201).json(savedBlog);
});

// Update Blog
app.put('/api/blogs/:id', async (req, res) => {
  const blog = await Blog.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedAt: Date.now() },
    { new: true }
  );

  if (!blog) return res.status(404).json({ message: 'Blog not found' });

  res.json(blog);
});

// Delete Blog
app.delete('/api/blogs/:id', async (req, res) => {
  const blog = await Blog.findByIdAndDelete(req.params.id);
  if (!blog) return res.status(404).json({ message: 'Blog not found' });

  res.json({ message: 'Blog deleted successfully' });
});

// ================= HEALTH CHECK =================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    mongoConnected: mongoose.connection.readyState === 1,
    groqConfigured: !!process.env.GROQ_API_KEY
  });
});

// ================= SERVE REACT =================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// ================= KEEP ALIVE (RENDER FREE FIX) =================
const RENDER_URL = "https://blogify-web-szk9.onrender.com";

const keepAlive = () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("Keep-alive disabled (development mode)");
    return;
  }

  setInterval(async () => {
    try {
      const response = await fetch(`${RENDER_URL}/api/health`);
      console.log(`✅ Keep-alive ping: ${response.status}`);
    } catch (error) {
      console.error("❌ Keep-alive failed:", error.message);
    }
  }, 14 * 60 * 1000); // every 14 minutes
};

// ================= SERVER START =================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🧠 Groq configured: ${!!process.env.GROQ_API_KEY}`);
  console.log(`🗄 MongoDB connected: ${mongoose.connection.readyState === 1}`);

  keepAlive();
});

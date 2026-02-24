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
  console.log('[OK] Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.log('[ERROR] MongoDB connection error:', err);
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
const stripMarkdown = (text = '') =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[#>*_~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ensureSection = (content, sectionTitle, fallbackBody) => {
  const normalized = sectionTitle.toLowerCase();
  const hasSection = content
    .toLowerCase()
    .includes(`## ${normalized}`);

  if (hasSection) return content;
  return `${content}\n\n## ${sectionTitle}\n${fallbackBody}`;
};

const normalizeAIContent = (title, rawContent = '') => {
  let content = rawContent.trim();

  // Remove fenced markdown wrappers if model returns full block as code.
  content = content.replace(/^```markdown\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');

  if (!content.startsWith('#')) {
    content = `# ${title}\n\n${content}`;
  }

  content = ensureSection(
    content,
    'Introduction',
    `This article explains ${title} with practical context, examples, and actionable takeaways.`
  );
  content = ensureSection(
    content,
    'Key Points',
    `- Core concept of ${title}\n- Benefits and limitations\n- Practical implementation guidance`
  );
  content = ensureSection(
    content,
    'Conclusion',
    `In summary, ${title} can be applied effectively with clear goals and consistent execution.`
  );

  return content.trim();
};

const buildDescriptionFromContent = (title, content) => {
  const plain = stripMarkdown(content);
  if (!plain) return `A practical guide to ${title}.`;
  return plain.slice(0, 170).trim() + (plain.length > 170 ? '...' : '');
};

const generateAIContent = async (title) => {
  try {
    const prompt = `
Write a professional markdown blog post for the topic: "${title}".

Return only markdown content (no code fences, no extra notes).
Use this exact structure:
# ${title}
## Introduction
## Key Points
- bullet points
## Practical Example
## Conclusion

Requirements:
- 700 to 1000 words
- clear paragraphs and readable language
- include at least one numbered list and one bullet list
- avoid placeholders like "lorem ipsum"
`.trim();

    const message = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 2000
    });

    const raw = message.choices[0]?.message?.content || '';
    return normalizeAIContent(title, raw);
  } catch (error) {
    console.error('Groq content error:', error);

    return normalizeAIContent(title, `# ${title}

## Introduction
Content generation is temporarily unavailable.

## Key Points
- Service is currently unavailable
- Retry after a few moments
- Check API key and provider status

## Conclusion
Please try again later.`);
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
    const normalizedTitle = (title || '').trim();
    if (!normalizedTitle) {
      return res.status(400).json({
        success: false,
        message: 'Title required',
        data: null
      });
    }

    const content = await generateAIContent(normalizedTitle);
    const description = buildDescriptionFromContent(normalizedTitle, content);
    const payload = {
      title: normalizedTitle,
      description,
      content,
      contentType: 'markdown',
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Content generated successfully',
      data: payload,
      // Backward-compatible fields for current frontend
      content: payload.content,
      contentType: payload.contentType,
      description: payload.description
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate content',
      data: null
    });
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
      console.log(`[OK] Keep-alive ping: ${response.status}`);
    } catch (error) {
      console.error("[ERROR] Keep-alive failed:", error.message);
    }
  }, 14 * 60 * 1000); // every 14 minutes
};

// ================= SERVER START =================
app.listen(PORT, () => {
  console.log(`[START] Server running on port ${PORT}`);
  console.log(`[AI] Groq configured: ${!!process.env.GROQ_API_KEY}`);
  console.log(`MongoDB connected: ${mongoose.connection.readyState === 1}`);

  keepAlive();
});

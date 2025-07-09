const express = require('express');
const mongoose = require('mongoose');
const path = require('path'); 
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced Environment Variables Logging
console.log('=== Environment Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);
console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY?.length || 0);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('=========================');

// Initialize Gemini AI with error handling
let genAI;
try {
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('✅ Gemini AI initialized successfully');
  } else {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
  }
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error.message);
}

// Enhanced CORS Configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://blogify-web-szk9.onrender.com',
        /\.onrender\.com$/,
        /\.vercel\.app$/,
        /\.netlify\.app$/
      ]
    : [
        'http://localhost:3000', 
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware - FIXED ORDER
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files if client build exists
const clientBuildPath = path.join(__dirname, 'client/build');
if (require('fs').existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  console.log('✅ Static files served from:', clientBuildPath);
} else {
  console.log('⚠️  Client build directory not found:', clientBuildPath);
}

// Enhanced MongoDB Connection with retry logic
const connectMongoDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    const mongoOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    };

    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    // Retry connection after 5 seconds
    setTimeout(connectMongoDB, 5000);
  }
};

// Initialize MongoDB connection
connectMongoDB();

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected. Attempting to reconnect...');
  setTimeout(connectMongoDB, 5000);
});

// Enhanced Blog Schema
const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  content: {
    type: String,
    required: true,
    maxlength: 50000
  },
  contentType: {
    type: String,
    enum: ['markdown', 'html', 'plain'],
    default: 'markdown'
  },
  author: {
    type: String,
    default: 'Anonymous',
    maxlength: 100
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

// Enhanced AI Description Generation Function
const generateDescription = async (title) => {
  try {
    console.log('🔍 Generating description for:', title);
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    if (!genAI) {
      throw new Error('Gemini AI not initialized');
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 200,
      }
    });
    
    const prompt = `Write a short, engaging 2-3 sentence description about: "${title}". Make it informative and compelling for blog readers.`;
    
    console.log('📝 Sending description request to Gemini...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const description = response.text();
    
    console.log('✅ Description generated successfully');
    return description.trim();
  } catch (error) {
    console.error('❌ Error generating description with Gemini:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    return `Learn about ${title} and discover key insights on this topic.`;
  }
};

// Enhanced AI Content Generation Function with Rich Formatting
const generateAIContent = async (title) => {
  try {
    console.log('🔍 Starting content generation for:', title);
    console.log('🔑 API Key status:', !!process.env.GEMINI_API_KEY);
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    if (!genAI) {
      throw new Error('Gemini AI not initialized');
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4000,
      }
    });
    
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
- Use [link text](https://example.com) format for any relevant links
- Use --- for horizontal dividers between major sections
- Keep paragraphs well-spaced with empty lines

The content should be informative, engaging, and well-structured with proper markdown formatting. Make it at least 800-1200 words.`;
    
    console.log('📝 Sending content request to Gemini...');
    const result = await model.generateContent(prompt);
    console.log('✅ Gemini response received');
    
    const response = await result.response;
    let content = response.text();
    
    console.log('📄 Content generated successfully, length:', content.length);
    
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
    console.error('❌ Gemini API Error Details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status,
      timestamp: new Date().toISOString()
    });
    
    // Enhanced fallback content with markdown
    return `# ${title}

> **⚠️ Content Generation Notice**: AI content generation is temporarily unavailable.

## What happened?
We encountered a technical issue while generating AI content for **"${title}"**.

## Possible causes:
1. **API Configuration** - Gemini API key might be invalid or expired
2. **Network Issues** - Temporary connectivity problems
3. **Service Limits** - API quota might be exceeded
4. **Server Issues** - Temporary service disruption

## Next steps:
1. **Wait and retry** - The issue might be temporary
2. **Check API status** - Verify Gemini API service status
3. **Manual creation** - You can write the content manually
4. **Contact support** - If the issue persists

### Error Details:
\`\`\`
Error: ${error.message}
Time: ${new Date().toISOString()}
\`\`\`

---

*Please try again in a few moments or contact support if the issue persists.*`;
  }
};

// Request timeout middleware
const timeoutMiddleware = (req, res, next) => {
  res.setTimeout(30000, () => {
    console.error('Request timeout for:', req.path);
    res.status(408).json({ 
      message: 'Request timeout',
      path: req.path,
      timestamp: new Date().toISOString()
    });
  });
  next();
};

// Apply timeout middleware to AI routes
app.use('/api/generate-*', timeoutMiddleware);

// API Routes

// Generate description for title
app.post('/api/generate-description', async (req, res) => {
  try {
    const { title } = req.body;
    
    console.log('🎯 Description generation request received for:', title);
    
    if (!title) {
      console.log('❌ No title provided');
      return res.status(400).json({ 
        message: 'Title is required',
        timestamp: new Date().toISOString()
      });
    }
    
    if (title.length > 200) {
      return res.status(400).json({ 
        message: 'Title too long. Maximum 200 characters allowed.',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('🚀 Starting description generation...');
    const description = await generateDescription(title);
    
    console.log('✅ Description generated successfully');
    res.json({ 
      description,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in generate-description endpoint:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      message: 'Failed to generate description', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Generate AI content for title
app.post('/api/generate-content', async (req, res) => {
  try {
    const { title } = req.body;
    
    console.log('🎯 Content generation request received for:', title);
    
    if (!title) {
      console.log('❌ No title provided');
      return res.status(400).json({ 
        message: 'Title is required',
        timestamp: new Date().toISOString()
      });
    }
    
    if (title.length > 200) {
      return res.status(400).json({ 
        message: 'Title too long. Maximum 200 characters allowed.',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('🚀 Generating enhanced content for:', title);
    const content = await generateAIContent(title);
    
    console.log('✅ Content generated successfully');
    res.json({ 
      content,
      contentType: 'markdown',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in generate-content endpoint:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      message: 'Failed to generate content', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all blogs with pagination
app.get('/api/blogs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    console.log(`📄 Fetching blogs - Page: ${page}, Limit: ${limit}`);
    
    const blogs = await Blog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title description author createdAt updatedAt');
    
    const totalBlogs = await Blog.countDocuments();
    const totalPages = Math.ceil(totalBlogs / limit);
    
    console.log(`✅ Fetched ${blogs.length} blogs successfully`);
    
    res.json({
      blogs,
      currentPage: page,
      totalPages,
      totalBlogs,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });
  } catch (error) {
    console.error('❌ Error fetching blogs:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch blogs',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get single blog
app.get('/api/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Fetching blog with ID:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: 'Invalid blog ID format',
        timestamp: new Date().toISOString()
      });
    }
    
    const blog = await Blog.findById(id);
    if (!blog) {
      console.log('❌ Blog not found:', id);
      return res.status(404).json({ 
        message: 'Blog not found',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('✅ Blog fetched successfully:', blog.title);
    res.json(blog);
  } catch (error) {
    console.error('❌ Error fetching blog:', error.message);
    res.status(500).json({ 
      message: 'Failed to fetch blog',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Create blog
app.post('/api/blogs', async (req, res) => {
  try {
    const { title, description, content, author, contentType } = req.body;
    
    console.log('📝 Creating new blog:', title);
    
    // Enhanced validation
    if (!title || !description || !content) {
      return res.status(400).json({ 
        message: 'Title, description, and content are required',
        timestamp: new Date().toISOString()
      });
    }
    
    if (title.length > 200) {
      return res.status(400).json({ 
        message: 'Title too long. Maximum 200 characters allowed.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (description.length > 500) {
      return res.status(400).json({ 
        message: 'Description too long. Maximum 500 characters allowed.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (content.length > 50000) {
      return res.status(400).json({ 
        message: 'Content too long. Maximum 50000 characters allowed.',
        timestamp: new Date().toISOString()
      });
    }
    
    const blog = new Blog({
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      contentType: contentType || 'markdown',
      author: author?.trim() || 'Anonymous'
    });

    const savedBlog = await blog.save();
    console.log('✅ Blog created successfully:', savedBlog._id);
    
    res.status(201).json({
      ...savedBlog.toObject(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error creating blog:', error.message);
    res.status(400).json({ 
      message: 'Failed to create blog',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update blog
app.put('/api/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, author, contentType } = req.body;
    
    console.log('🔄 Updating blog:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: 'Invalid blog ID format',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validation
    if (title && title.length > 200) {
      return res.status(400).json({ 
        message: 'Title too long. Maximum 200 characters allowed.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (description && description.length > 500) {
      return res.status(400).json({ 
        message: 'Description too long. Maximum 500 characters allowed.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (content && content.length > 50000) {
      return res.status(400).json({ 
        message: 'Content too long. Maximum 50000 characters allowed.',
        timestamp: new Date().toISOString()
      });
    }
    
    const updateData = {
      updatedAt: Date.now()
    };
    
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (content) updateData.content = content.trim();
    if (author) updateData.author = author.trim();
    if (contentType) updateData.contentType = contentType;
    
    const blog = await Blog.findByIdAndUpdate(id, updateData, { 
      new: true,
      runValidators: true 
    });

    if (!blog) {
      console.log('❌ Blog not found for update:', id);
      return res.status(404).json({ 
        message: 'Blog not found',
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ Blog updated successfully:', blog.title);
    res.json({
      ...blog.toObject(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating blog:', error.message);
    res.status(400).json({ 
      message: 'Failed to update blog',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Delete blog
app.delete('/api/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️  Deleting blog:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        message: 'Invalid blog ID format',
        timestamp: new Date().toISOString()
      });
    }
    
    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) {
      console.log('❌ Blog not found for deletion:', id);
      return res.status(404).json({ 
        message: 'Blog not found',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('✅ Blog deleted successfully:', blog.title);
    res.json({ 
      message: 'Blog deleted successfully',
      deletedBlog: {
        id: blog._id,
        title: blog.title
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error deleting blog:', error.message);
    res.status(500).json({ 
      message: 'Failed to delete blog',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    console.log('🏥 Health check requested');
    
    // Test Gemini API connection
    let geminiWorking = false;
    let geminiError = null;
    
    if (process.env.GEMINI_API_KEY && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent('Test connection');
        const response = await result.response;
        response.text(); // This will throw if there's an issue
        geminiWorking = true;
        console.log('✅ Gemini API test successful');
      } catch (error) {
        geminiError = error.message;
        console.error('❌ Gemini API test failed:', error.message);
      }
    }
    
    // Test MongoDB connection
    const mongoStatus = mongoose.connection.readyState;
    const mongoStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      
      // API Configuration
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      geminiWorking: geminiWorking,
      geminiError: geminiError,
      
      // Database Status
      mongoConfigured: !!process.env.MONGODB_URI,
      mongoStatus: mongoStatusMap[mongoStatus],
      mongoConnected: mongoStatus === 1,
      
      // Features
      features: [
        'markdown-support', 
        'rich-content-generation',
        'pagination',
        'enhanced-error-handling',
        'timeout-protection'
      ],
      
      // Deployment Info
      deployment: {
        platform: process.env.RENDER ? 'Render' : 'Local',
        nodeVersion: process.version,
        port: PORT
      }
    };
    
    console.log('✅ Health check completed successfully');
    res.json(healthData);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }
});

// Keep-alive endpoint for preventing cold starts
app.get('/api/keep-alive', (req, res) => {
  console.log('💓 Keep-alive ping received');
  res.status(200).json({ 
    message: 'Server is alive!', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint called');
  res.json({
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    mongoConfigured: !!process.env.MONGODB_URI
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Unhandled error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Catch all handler for React app
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'client/build', 'index.html');
  
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      message: 'Client build not found',
      timestamp: new Date().toISOString()
    });
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`🗄️  MongoDB configured: ${!!process.env.MONGODB_URI}`);
  console.log(`📊 Enhanced features: Markdown support, Rich content generation, Pagination, Error handling`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💓 Keep-alive: http://localhost:${PORT}/api/keep-alive`);
  console.log('='.repeat(60));
});

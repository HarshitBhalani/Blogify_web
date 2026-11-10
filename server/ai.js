const express = require('express');
const Groq = require('groq-sdk');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('./auth');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// AI calls cost money, so they need an account and are rate limited per IP.
router.use(requireAuth);
router.use(rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many AI requests. Wait a minute and try again.' } }));

const TONES = {
  conversational: 'friendly and conversational, like explaining to a colleague',
  professional: 'clear and professional',
  playful: 'light and playful, with a bit of humour',
  technical: 'precise and technical',
};

const AUDIENCES = {
  beginner: 'beginners who are new to the topic; explain terms',
  general: 'a general audience',
  expert: 'experienced practitioners; skip the basics',
};

const STYLE_RULES = `
Writing rules:
- Write like a thoughtful human writer, not a marketing bot.
- No filler openers such as "In today's fast-paced world" or "In this article we will".
- Avoid the words: delve, tapestry, landscape, realm, unlock, elevate, game-changer, seamless, leverage, robust.
- Prefer concrete examples and specific details over generic claims.
- Vary sentence length. Short paragraphs.
`.trim();

const pick = (map, key, fallback) => map[key] || map[fallback];

const chat = async (messages, opts = {}) => {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 1500,
    reasoning_effort: 'low',
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  });
  return (res.choices[0]?.message?.content || '').trim();
};

const stripFences = (text) => text.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim();

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error('[AI] error:', error.message);
    if (!res.headersSent) {
      // Groq answers 429 when our own API quota is used up; tell the writer to wait instead of a generic failure.
      if (error.status === 429) {
        res.status(429).json({ message: 'The AI is busy right now (provider rate limit). Wait a minute and try again.' });
      } else {
        res.status(502).json({ message: 'The AI service failed. Try again in a moment.' });
      }
    }
    else res.end();
  }
};

// Outline: a list of section headings the writer can edit before drafting.
router.post('/outline', wrap(async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ message: 'Add a title first' });
  const tone = pick(TONES, req.body.tone, 'conversational');
  const audience = pick(AUDIENCES, req.body.audience, 'general');

  const text = await chat([
    {
      role: 'user',
      content: `Create an outline for a blog post titled "${title}" for ${audience}. Tone: ${tone}.
Return 5 to 7 section headings, one per line, each starting with "## ". Under each heading add one short line starting with "- " saying what that section covers. Return only the outline.`,
    },
  ], { maxTokens: 700 });
  res.json({ outline: stripFences(text) });
}));

// Draft: streamed as plain text so the editor can show it as it is written.
router.post('/draft', wrap(async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ message: 'Add a title first' });
  const outline = (req.body.outline || '').trim().slice(0, 4000);
  const tone = pick(TONES, req.body.tone, 'conversational');
  const audience = pick(AUDIENCES, req.body.audience, 'general');
  const length = req.body.length === 'short' ? '400 to 600' : req.body.length === 'long' ? '1200 to 1600' : '700 to 1000';

  const prompt = `Write a blog post in Markdown titled "${title}".
Audience: ${audience}.
Tone: ${tone}.
Length: ${length} words.
${outline ? `Follow this outline exactly, keeping its headings:\n${outline}\n` : 'Use 4 to 6 "## " section headings.'}
Do not repeat the title as a heading. Do not wrap the answer in code fences. Use lists or a code block only where they genuinely help.

${STYLE_RULES}`;

  const stream = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 4000,
    reasoning_effort: 'low',
    stream: true,
  });

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let aborted = false;
  req.on('close', () => { aborted = true; });
  for await (const chunk of stream) {
    if (aborted) break;
    const piece = chunk.choices[0]?.delta?.content;
    if (piece) res.write(piece);
  }
  res.end();
}));

const REWRITES = {
  shorter: 'Make this text about half as long while keeping the key point.',
  longer: 'Expand this text with one or two concrete details or an example.',
  casual: 'Rewrite this in a more casual, conversational voice.',
  formal: 'Rewrite this in a more formal, professional voice.',
  grammar: 'Fix grammar, spelling and punctuation only. Change as little as possible.',
  clearer: 'Rewrite this so it is clearer and easier to follow.',
};

router.post('/rewrite', wrap(async (req, res) => {
  const text = (req.body.text || '').trim();
  const instruction = REWRITES[req.body.action];
  if (!text) return res.status(400).json({ message: 'Select some text first' });
  if (!instruction) return res.status(400).json({ message: 'Unknown action' });

  const result = await chat([
    {
      role: 'user',
      content: `${instruction}
Keep the Markdown formatting. Return only the rewritten text, with no preamble or quotes.

${STYLE_RULES}

Text:
${text.slice(0, 6000)}`,
    },
  ], { temperature: 0.4, maxTokens: 2000 });
  res.json({ text: stripFences(result) });
}));

router.post('/suggest', wrap(async (req, res) => {
  const content = (req.body.content || '').trim();
  const title = (req.body.title || '').trim();
  if (!content && !title) return res.status(400).json({ message: 'Write a title or some content first' });

  const raw = await chat([
    {
      role: 'user',
      content: `Here is a blog post${title ? ` currently titled "${title}"` : ''}.
Suggest 4 alternative titles (specific, under 70 characters, no clickbait, no colons-with-buzzwords), a 1 to 2 sentence summary for the post list (under 200 characters), and 3 to 5 short lowercase topic tags.
Respond as JSON: {"titles": [...], "summary": "...", "tags": [...]}

Post:
${content.slice(0, 8000) || '(no content yet)'}`,
    },
  ], { temperature: 0.7, maxTokens: 800, json: true });

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return res.status(502).json({ message: 'Could not read the AI suggestions. Try again.' });
  }
  return res.json({
    titles: Array.isArray(data.titles) ? data.titles.slice(0, 4).map(String) : [],
    summary: typeof data.summary === 'string' ? data.summary : '',
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 5).map(String) : [],
  });
}));

module.exports = { router };

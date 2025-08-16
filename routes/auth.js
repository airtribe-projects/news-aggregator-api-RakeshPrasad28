const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const users = require('../models/users.js'); 
const authenticateToken = require('../middleware/auth.js');
const axios = require('axios');
const NEWS_API_KEY = 'b36515b31c1540c588ce7281cefb7e8e';
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.get('/news', authenticateToken, async (req, res) => {
  try {
    const user = users.find(u => u.email === req.user.email);
    if (!user) return res.status(404).json({ error: "User not found" });

    const categories = (user.preferences && user.preferences.length > 0) ? user.preferences : ['technology'];

    let allArticles = [];
    for (const category of categories) {
      try {
        const response = await axios.get(
          `https://newsapi.org/v2/top-headlines`,
          {
            params: {
              country: 'us',
              category,
              apiKey: NEWS_API_KEY
            }
          }
        );
        if (response.data.articles) {
          allArticles = allArticles.concat(response.data.articles);
        }
      } catch (categoryErr) {
        console.error(`Error fetching news for category ${category}:`, categoryErr.message);
      }
    }
    const uniqueArticles = [];
    const urls = new Set();
    allArticles.forEach(article => {
      if (article.url && !urls.has(article.url)) {
        urls.add(article.url);
        uniqueArticles.push(article);
      }
    });

    res.json({ articles: uniqueArticles });
  } catch (err) {
    console.error("News fetching error:", err.message);
    res.status(500).json({ error: "Failed to fetch news articles" });
  }
});

router.get('/preferences', authenticateToken, (req, res) => {
  const user = users.find(u => u.email === req.user.email);
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({ preferences: user.preferences });
});

router.put('/preferences', authenticateToken, (req, res) => {
  const { preferences } = req.body;
  if (!Array.isArray(preferences)) return res.status(400).json({ error: "Preferences must be an array" });

  const user = users.find(u => u.email === req.user.email);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.preferences = preferences;
  res.json({ message: "Preferences updated", preferences: user.preferences });
});

router.post('/register', 
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const existingUser = users.find(u => u.email === email);
  if (existingUser) return res.status(409).json({ error: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ email, password: hashedPassword, preferences: [] });

  res.status(201).json({ message: "User registered successfully" });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ email: user.email }, 'supersecret', { expiresIn: '1h' });

  res.json({ token });
});

router.post('/logout', (req, res) => {
  res.json({ message: "Logout successful." });
});

module.exports = router;

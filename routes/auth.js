const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [
      String(email || '').trim().toLowerCase(),
    ]);
    const user = rows[0];
    if (!user) {
      return res.status(401).render('login', { error: 'Invalid email or password.' });
    }
    const match = await bcrypt.compare(password || '', user.password_hash);
    if (!match) {
      return res.status(401).render('login', { error: 'Invalid email or password.' });
    }
    req.session.userId = user.id;
    req.session.userName = user.name;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).render('login', { error: 'Something went wrong. Please try again.' });
  }
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', { error: null, name: '', email: '' });
});

router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!name || !email || password.length < 6) {
    return res.status(400).render('register', {
      error: 'Please fill in your name, email, and a password of at least 6 characters.',
      name,
      email,
    });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(400).render('register', {
        error: 'An account with that email already exists.',
        name,
        email,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name',
      [name, email, passwordHash]
    );
    req.session.userId = rows[0].id;
    req.session.userName = rows[0].name;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).render('register', {
      error: 'Something went wrong. Please try again.',
      name,
      email,
    });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;

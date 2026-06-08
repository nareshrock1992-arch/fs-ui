/**
 * server.js  (PostgreSQL version)
 *
 * On startup, calls db.initSchema() to CREATE tables if they
 * don't already exist — safe to run repeatedly.
 */

require('dotenv').config();
const express = require('express');
const app     = express();
const PORT    = process.env.PORT || 3000;

// Session support
const session = require('express-session');
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-in-production';

// ── Bootstrap DB schema before accepting requests ─────────────
const db = require('./db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const USERS_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(USERS_DIR, 'users.json');

function ensureUsersFileSync() {
  if (!fs.existsSync(USERS_DIR)) fs.mkdirSync(USERS_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

async function maybeCreateInitialAdmin() {
  ensureUsersFileSync();
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (users.length === 0 && adminUser && adminPass) {
    const hash = await bcrypt.hash(adminPass, 10);
    users.push({ username: adminUser, password: hash, isAdmin: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log('[server] Created initial admin user from ADMIN_USER/ADMIN_PASSWORD env vars.');
  }
}

db.initSchema()
  .then(async () => {
    console.log('[server] DB schema verified.');
    await maybeCreateInitialAdmin();
  })
  .catch(err => {
    console.error('[server] FATAL: could not initialise DB schema:', err.message);
    process.exit(1);
  });

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());

// Configure session middleware (placed before routes)
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
app.set('trust proxy', 1);
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Mount auth routes (no protection needed)
app.use('/api/auth', require('./routes/auth'));

// ── Authentication middleware ────────────────────────────────
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  // Not authenticated
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  // For HTML/static files, redirect to login
  res.redirect('/login.html');
}

// Serve login page and its assets without auth
const publicDir = path.join(__dirname, 'public');
const loginFile = path.join(publicDir, 'login.html');

function sendLogin(req, res) {
  res.sendFile(loginFile);
}

app.get('/login.html', sendLogin);
app.head('/login.html', sendLogin);
app.get('/login.html/', sendLogin);
app.head('/login.html/', sendLogin);
app.get('/login.js', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.js'));
});
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(publicDir, 'style.css'));
});
app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(publicDir, 'logo.png'));
});

// Protect all other static files with login requirement
app.use(requireLogin);
app.use(express.static(path.join(__dirname, 'public'), { redirect: false }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/users',         requireLogin, require('./routes/users'));
app.use('/api/registrations', requireLogin, require('./routes/registrations'));
app.use('/api/conferences',   requireLogin, require('./routes/conferences'));
app.use('/api/conferences',   requireLogin, require('./routes/conferenceAdvanced'));

// History / Reporting (PostgreSQL-backed)
app.use('/api/history',       requireLogin, require('./routes/conferenceHistory'));

// ── Catch-all error handler ───────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled route error:', err.stack || err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

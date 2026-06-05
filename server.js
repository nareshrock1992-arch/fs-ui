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
app.use(express.static('public'));

// Configure session middleware (placed before routes)
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Mount auth routes
app.use('/api/auth', require('./routes/auth'));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/users',         require('./routes/users'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/conferences',   require('./routes/conferences'));
app.use('/api/conferences',   require('./routes/conferenceAdvanced'));

// History / Reporting (PostgreSQL-backed)
app.use('/api/history',       require('./routes/conferenceHistory'));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

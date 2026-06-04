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

// ── Bootstrap DB schema before accepting requests ─────────────
const db = require('./db');
db.initSchema()
  .then(() => console.log('[server] DB schema verified.'))
  .catch(err => {
    console.error('[server] FATAL: could not initialise DB schema:', err.message);
    process.exit(1);
  });

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.static('public'));

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

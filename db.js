/**
 * db.js  —  Conference History Database (PostgreSQL)
 *
 * Dependencies:  npm install pg dotenv
 *
 * Place a .env file (or set environment variables) with:
 *
 *   DB_HOST=127.0.0.1
 *   DB_PORT=5432
 *   DB_NAME=freeswitch_dashboard
 *   DB_USER=postgres
 *   DB_PASS=yourpassword
 *
 * On first run, call:  node db.js
 * That will CREATE the tables if they don't exist yet.
 *
 * Tables
 * ──────
 *   conferences   – one row per session
 *   participants  – one row per member join; updated on leave
 *   events        – granular action log (join/leave/mute/kick/lock/terminate…)
 */

require('dotenv').config();
const { Pool } = require('pg');

// ── Connection pool ───────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST || '127.0.0.1',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'freeswitch_dashboard',
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  max:      10,                  // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

// ── Schema bootstrap ──────────────────────────────────────────
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conferences (
      id             SERIAL PRIMARY KEY,
      name           TEXT        NOT NULL,
      started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at       TIMESTAMPTZ,
      terminated_by  TEXT,
      total_members  INT         NOT NULL DEFAULT 0,
      peak_members   INT         NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_conf_name
      ON conferences (name);

    CREATE INDEX IF NOT EXISTS idx_conf_active
      ON conferences (name) WHERE ended_at IS NULL;

    CREATE TABLE IF NOT EXISTS participants (
      id               SERIAL PRIMARY KEY,
      conference_id    INT         NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
      conference_name  TEXT        NOT NULL,
      member_id        TEXT        NOT NULL,
      "user"           TEXT,
      joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      left_at          TIMESTAMPTZ,
      duration_sec     INT,
      was_muted        BOOLEAN     NOT NULL DEFAULT FALSE,
      was_kicked       BOOLEAN     NOT NULL DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_part_conf
      ON participants (conference_id);

    CREATE INDEX IF NOT EXISTS idx_part_active
      ON participants (conference_id, member_id) WHERE left_at IS NULL;

    CREATE TABLE IF NOT EXISTS events (
      id               SERIAL PRIMARY KEY,
      conference_id    INT         REFERENCES conferences(id) ON DELETE CASCADE,
      conference_name  TEXT        NOT NULL,
      member_id        TEXT,
      "user"           TEXT,
      type             TEXT        NOT NULL,
      detail           TEXT,
      ts               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_evt_conf
      ON events (conference_id);
  `);
  console.log('[db] Schema ready.');
}

// ── Low-level helper ──────────────────────────────────────────
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// ── Conference operations ─────────────────────────────────────

/**
 * Find or create an open conference session by name.
 * Returns the full row.
 */
async function ensureConference(conferenceName) {
  // Try to find an existing open session first
  const existing = await query(
    `SELECT * FROM conferences
      WHERE name = $1 AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1`,
    [conferenceName]
  );
  if (existing.rows.length) return existing.rows[0];

  // Create a new session
  const ins = await query(
    `INSERT INTO conferences (name)
      VALUES ($1)
      RETURNING *`,
    [conferenceName]
  );
  return ins.rows[0];
}

async function closeConference(conferenceName, terminatedBy = 'system') {
  await query(
    `UPDATE conferences
        SET ended_at = NOW(), terminated_by = $2
      WHERE name = $1 AND ended_at IS NULL`,
    [conferenceName, terminatedBy]
  );
}

// ── Participant operations ────────────────────────────────────

async function recordJoin(conferenceName, memberId, user) {
  const conf = await ensureConference(conferenceName);

  // Idempotent — don't double-insert if already active
  const chk = await query(
    `SELECT id FROM participants
      WHERE conference_id = $1 AND member_id = $2 AND left_at IS NULL`,
    [conf.id, String(memberId)]
  );
  if (chk.rows.length) return chk.rows[0];

  // Update peak / total on conference row
  await query(
    `UPDATE conferences
        SET total_members = total_members + 1,
            peak_members  = GREATEST(
              peak_members,
              (SELECT COUNT(*) FROM participants
                WHERE conference_id = $1 AND left_at IS NULL) + 1
            )
      WHERE id = $1`,
    [conf.id]
  );

  const ins = await query(
    `INSERT INTO participants (conference_id, conference_name, member_id, "user")
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
    [conf.id, conferenceName, String(memberId), user || String(memberId)]
  );

  await addEvent(conferenceName, conf.id, memberId, user, 'join', 'Participant joined');
  return ins.rows[0];
}

async function recordLeave(conferenceName, memberId, wasKicked = false) {
  const confRes = await query(
    `SELECT id FROM conferences
      WHERE name = $1 AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    [conferenceName]
  );
  if (!confRes.rows.length) return;
  const confId = confRes.rows[0].id;

  const partRes = await query(
    `SELECT * FROM participants
      WHERE conference_id = $1 AND member_id = $2 AND left_at IS NULL`,
    [confId, String(memberId)]
  );
  if (!partRes.rows.length) return;
  const p = partRes.rows[0];

  await query(
    `UPDATE participants
        SET left_at      = NOW(),
            was_kicked   = $3,
            duration_sec = EXTRACT(EPOCH FROM (NOW() - joined_at))::INT
      WHERE id = $1 AND conference_id = $2`,
    [p.id, confId, wasKicked]
  );

  await addEvent(
    conferenceName, confId, memberId, p.user,
    wasKicked ? 'kick' : 'leave',
    wasKicked ? 'Participant was kicked' : 'Participant left'
  );
}

async function recordMute(conferenceName, memberId, muted) {
  const confRes = await query(
    `SELECT id FROM conferences
      WHERE name = $1 AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    [conferenceName]
  );
  if (!confRes.rows.length) return;
  const confId = confRes.rows[0].id;

  const partRes = await query(
    `SELECT * FROM participants
      WHERE conference_id = $1 AND member_id = $2 AND left_at IS NULL`,
    [confId, String(memberId)]
  );
  const p = partRes.rows[0] || null;

  if (p && muted) {
    await query(
      `UPDATE participants SET was_muted = TRUE WHERE id = $1`,
      [p.id]
    );
  }

  await addEvent(
    conferenceName, confId, memberId,
    p ? p.user : String(memberId),
    muted ? 'mute' : 'unmute',
    muted ? 'Participant muted' : 'Participant unmuted'
  );
}

// ── Event log ─────────────────────────────────────────────────

async function addEvent(conferenceName, conferenceId, memberId, user, type, detail) {
  await query(
    `INSERT INTO events (conference_id, conference_name, member_id, "user", type, detail)
      VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      conferenceId || null,
      conferenceName,
      memberId ? String(memberId) : null,
      user || null,
      type,
      detail || null
    ]
  );
}

async function addConferenceEvent(conferenceName, type, detail, actor) {
  const confRes = await query(
    `SELECT id FROM conferences
      WHERE name = $1 AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    [conferenceName]
  );
  const confId = confRes.rows[0]?.id || null;
  await addEvent(conferenceName, confId, null, actor || 'operator', type, detail);
}

// ── Query helpers ─────────────────────────────────────────────

async function getAllConferences({ limit = 100, offset = 0, name } = {}) {
  const params = [limit, offset];
  let where = '';
  if (name) {
    params.push(name);
    where = `WHERE name = $${params.length}`;
  }
  const res = await query(
    `SELECT * FROM conferences
      ${where}
      ORDER BY started_at DESC
      LIMIT $1 OFFSET $2`,
    params
  );
  return res.rows;
}

async function getConferenceById(id) {
  const res = await query(
    `SELECT * FROM conferences WHERE id = $1`,
    [parseInt(id)]
  );
  return res.rows[0] || null;
}

async function getParticipantsByConference(conferenceId) {
  const res = await query(
    `SELECT * FROM participants
      WHERE conference_id = $1
      ORDER BY joined_at ASC`,
    [parseInt(conferenceId)]
  );
  return res.rows;
}

async function getEventsByConference(conferenceId) {
  const res = await query(
    `SELECT * FROM events
      WHERE conference_id = $1
      ORDER BY ts ASC`,
    [parseInt(conferenceId)]
  );
  return res.rows;
}

async function getStats() {
  const [totals, durations] = await Promise.all([
    query(`
      SELECT
        COUNT(*)                                    AS total,
        COUNT(*) FILTER (WHERE ended_at IS NULL)    AS active,
        (SELECT COUNT(*) FROM participants)         AS total_part,
        (SELECT COUNT(*) FROM events)               AS total_events
      FROM conferences
    `),
    query(`
      SELECT
        ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)::NUMERIC, 1) AS avg_duration,
        ROUND(MAX(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60)::NUMERIC, 1) AS max_duration
      FROM conferences
      WHERE ended_at IS NOT NULL
    `)
  ]);

  const t = totals.rows[0];
  const d = durations.rows[0];
  return {
    total:        parseInt(t.total),
    active:       parseInt(t.active),
    totalPart:    parseInt(t.total_part),
    totalEvents:  parseInt(t.total_events),
    avgDuration:  d.avg_duration || 0,
    maxDuration:  d.max_duration || 0
  };
}

// ── Exports ───────────────────────────────────────────────────
module.exports = {
  pool,
  initSchema,
  // write
  ensureConference,
  closeConference,
  recordJoin,
  recordLeave,
  recordMute,
  addEvent,
  addConferenceEvent,
  // read
  getAllConferences,
  getConferenceById,
  getParticipantsByConference,
  getEventsByConference,
  getStats
};

// ── Run schema bootstrap when called directly ─────────────────
if (require.main === module) {
  initSchema()
    .then(() => { console.log('Done.'); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}

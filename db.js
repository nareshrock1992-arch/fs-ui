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
  // ── Conference History tables (original) ─────────────────────
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

  // ── ENS / ERS Organization schema ───────────────────────────
  // Create ENUM types (idempotent — skip if they already exist)
  const enums = [
    { name: 'enum_Organization_modules', values: ['ens', 'ers'] },
    { name: 'enum_Contacts_modules',     values: ['ens', 'ers'] },
    { name: 'enum_Location_modules',     values: ['ens', 'ers'] },
    { name: 'enum_Responder_modules',    values: ['ens', 'ers'] },
    { name: 'enum_Room_modules',         values: ['ens', 'ers'] },
    { name: 'enum_users_role',           values: ['Admin', 'User'] },
    { name: 'enum_blast_logs_module',    values: ['ens', 'ers'] },
    { name: 'enum_blast_logs_conference_type', values: ['primary', 'secondary'] },
    { name: 'enum_blast_logs_group_type',      values: ['primary', 'secondary'] },
  ];

  for (const e of enums) {
    const vals = e.values.map(v => `'${v}'`).join(', ');
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE "${e.name}" AS ENUM (${vals});
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  // Organization
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Organization" (
      id          VARCHAR(255) NOT NULL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      type        VARCHAR(255) NOT NULL,
      description TEXT,
      active      BOOLEAN      NOT NULL DEFAULT TRUE,
      modules     "enum_Organization_modules"
    );
  `);

  // Contacts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Contacts" (
      id                VARCHAR(255) NOT NULL PRIMARY KEY,
      name              VARCHAR(255) NOT NULL,
      role              VARCHAR(255) NOT NULL,
      phone             VARCHAR(255) NOT NULL,
      email             VARCHAR(255),
      "organization_Id" VARCHAR(255) NOT NULL REFERENCES "Organization"(id)
                        ON UPDATE CASCADE ON DELETE CASCADE,
      modules           "enum_Contacts_modules" NOT NULL
    );
  `);

  // Location
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Location" (
      id                VARCHAR(255) NOT NULL PRIMARY KEY,
      name              VARCHAR(255) NOT NULL,
      modules           "enum_Location_modules",
      "organization_Id" VARCHAR(255) NOT NULL REFERENCES "Organization"(id)
                        ON UPDATE CASCADE ON DELETE CASCADE
    );
  `);

  // Room
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Room" (
      id                VARCHAR(255) NOT NULL PRIMARY KEY,
      name              VARCHAR(255) NOT NULL,
      modules           "enum_Room_modules",
      "organization_Id" VARCHAR(255) NOT NULL REFERENCES "Organization"(id)
                        ON UPDATE CASCADE ON DELETE CASCADE,
      "locations_Id"    VARCHAR(255) NOT NULL REFERENCES "Location"(id)
                        ON UPDATE CASCADE ON DELETE CASCADE
    );
  `);

  // Responder
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Responder" (
      id                VARCHAR(255) NOT NULL PRIMARY KEY,
      name              VARCHAR(255) NOT NULL,
      description       VARCHAR(255) NOT NULL,
      modules           "enum_Responder_modules",
      "organization_Id" VARCHAR(255) NOT NULL REFERENCES "Organization"(id)
                        ON UPDATE CASCADE ON DELETE CASCADE
    );
  `);

  // ResponderContacts (many-to-many)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ResponderContacts" (
      "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      "ResponderId"  VARCHAR(255) NOT NULL REFERENCES "Responder"(id)
                     ON UPDATE CASCADE ON DELETE CASCADE,
      "ContactId"    VARCHAR(255) NOT NULL REFERENCES "Contacts"(id)
                     ON UPDATE CASCADE ON DELETE CASCADE,
      PRIMARY KEY ("ResponderId", "ContactId")
    );
  `);

  // DailySync
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "DailySync" (
      id              VARCHAR(255) NOT NULL PRIMARY KEY,
      host            VARCHAR(255) NOT NULL,
      database_name   VARCHAR(255) NOT NULL,
      "user"          VARCHAR(255) NOT NULL,
      password        VARCHAR(255) NOT NULL,
      active          BOOLEAN      NOT NULL DEFAULT TRUE,
      "time"          VARCHAR(255) DEFAULT '00:00',
      query           TEXT,
      "responderId"   VARCHAR(255) NOT NULL REFERENCES "Responder"(id)
                      ON UPDATE CASCADE ON DELETE CASCADE
    );
  `);

  // ENS (Emergency Notification System)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ENS" (
      id                VARCHAR(255) NOT NULL PRIMARY KEY,
      name              VARCHAR(255) NOT NULL,
      pin               VARCHAR(255) NOT NULL,
      responders        JSONB        NOT NULL,
      active            BOOLEAN      NOT NULL DEFAULT TRUE,
      phone             VARCHAR(255) NOT NULL,
      retry_number      VARCHAR(255),
      retry             INTEGER      NOT NULL DEFAULT 0,
      "organization_Id" VARCHAR(255) NOT NULL REFERENCES "Organization"(id)
                        ON UPDATE CASCADE ON DELETE CASCADE
    );
  `);

  // ERS (Emergency Response System)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ERS" (
      id                VARCHAR(255) NOT NULL PRIMARY KEY,
      name              VARCHAR(255) NOT NULL,
      responders        JSONB        NOT NULL,
      active            BOOLEAN      DEFAULT FALSE,
      phone             VARCHAR(255) NOT NULL,
      retry             INTEGER      NOT NULL DEFAULT 0,
      retry_number      JSONB        DEFAULT '{"primary": null, "secondary": null}',
      "organization_Id" VARCHAR(255) NOT NULL REFERENCES "Organization"(id)
                        ON UPDATE CASCADE ON DELETE CASCADE
    );
  `);

  // License
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "License" (
      id                  VARCHAR(255) NOT NULL PRIMARY KEY,
      token               TEXT,
      activated_at        TIMESTAMPTZ,
      expires_at          TIMESTAMPTZ,
      used_keys           TEXT         NOT NULL DEFAULT '[]',
      key_attempt_count   INTEGER      NOT NULL DEFAULT 0,
      key_lockout_until   TIMESTAMPTZ,
      "createdAt"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      "updatedAt"         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  // blast_logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blast_logs (
      id                    SERIAL PRIMARY KEY,
      callid                VARCHAR(255),
      caller_id             VARCHAR(255),
      record_start          TIMESTAMPTZ,
      record_end            TIMESTAMPTZ,
      record_duration       INTEGER,
      recording_file        VARCHAR(255),
      blasted_to            VARCHAR(255),
      attendance_status     VARCHAR(255),
      recording_name        VARCHAR(255),
      recording_size        BIGINT,
      recording_format      VARCHAR(20),
      recording_duration_sec INTEGER,
      recording_url         TEXT,
      ens_number            TEXT,
      created_at            TIMESTAMPTZ,
      module                "enum_blast_logs_module",
      conference_type       "enum_blast_logs_conference_type",
      answered_at           TIMESTAMPTZ,
      group_type            "enum_blast_logs_group_type",
      blast_status          VARCHAR(255) DEFAULT 'COMPLETED',
      attempt_number        INTEGER      DEFAULT 0,
      last_hangup_cause     VARCHAR(255)
    );
  `);

  // app_users (RBAC users table from ENS/ERS schema)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id          UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(255) NOT NULL,
      email       VARCHAR(255) NOT NULL UNIQUE,
      password    VARCHAR(255) NOT NULL,
      role        "enum_users_role" NOT NULL DEFAULT 'User',
      active      BOOLEAN      NOT NULL DEFAULT TRUE,
      "timeZone"  VARCHAR(255) DEFAULT 'UTC',
      "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  // Trigger: map_responder_to_org
  await pool.query(`
    CREATE OR REPLACE FUNCTION map_responder_to_org() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      correct_org UUID;
    BEGIN
      SELECT "organization_Id"
      INTO correct_org
      FROM "Responder"
      WHERE id = NEW."organization_Id";

      IF correct_org IS NOT NULL THEN
        NEW."organization_Id" := correct_org;
      END IF;

      RETURN NEW;
    END;
    $$;
  `);

  // Attach trigger to Contacts (idempotent — drop first if exists)
  await pool.query(`
    DROP TRIGGER IF EXISTS trg_map_responder_to_org ON "Contacts";
    CREATE TRIGGER trg_map_responder_to_org
      BEFORE INSERT ON "Contacts"
      FOR EACH ROW EXECUTE FUNCTION map_responder_to_org();
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

async function getActiveConferences() {
  const res = await query(`
    SELECT
      id,
      name,
      started_at,
      EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 AS elapsed_minutes,
      (SELECT COUNT(*) FROM participants WHERE conference_id = conferences.id AND left_at IS NULL) AS current_members
    FROM conferences
    WHERE ended_at IS NULL
    ORDER BY started_at DESC
  `);
  return res.rows.map(r => ({
    id: r.id,
    name: r.name,
    startedAt: r.started_at,
    elapsedMinutes: parseFloat(r.elapsed_minutes) || 0,
    currentMembers: parseInt(r.current_members) || 0
  }));
}

// ── Organization CRUD ─────────────────────────────────────────

async function createOrganization({ id, name, type, description, active, modules }) {
  const res = await query(
    `INSERT INTO "Organization" (id, name, type, description, active, modules)
      VALUES ($1, $2, $3, $4, $5, $6::"enum_Organization_modules")
      RETURNING *`,
    [id, name, type, description || null, active !== false, modules || null]
  );
  return res.rows[0];
}

async function getAllOrganizations() {
  const res = await query(`SELECT * FROM "Organization" ORDER BY name ASC`);
  return res.rows;
}

async function getOrganizationById(id) {
  const res = await query(`SELECT * FROM "Organization" WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

async function updateOrganization(id, { name, type, description, active, modules }) {
  const res = await query(
    `UPDATE "Organization"
        SET name = $2, type = $3, description = $4, active = $5,
            modules = $6::"enum_Organization_modules"
      WHERE id = $1
      RETURNING *`,
    [id, name, type, description || null, active !== false, modules || null]
  );
  return res.rows[0] || null;
}

async function deleteOrganization(id) {
  const res = await query(`DELETE FROM "Organization" WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] || null;
}

// ── Exports ───────────────────────────────────────────────────
module.exports = {
  pool,
  initSchema,
  // conference write
  ensureConference,
  closeConference,
  recordJoin,
  recordLeave,
  recordMute,
  addEvent,
  addConferenceEvent,
  // conference read
  getAllConferences,
  getConferenceById,
  getParticipantsByConference,
  getEventsByConference,
  getStats,
  getActiveConferences,
  // organization CRUD
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization
};

// ── Run schema bootstrap when called directly ─────────────────
if (require.main === module) {
  initSchema()
    .then(() => { console.log('Done.'); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}

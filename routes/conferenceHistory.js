/**
 * conferenceHistory.js  —  History & Reporting Routes (PostgreSQL)
 *
 * Mount in server.js:
 *   app.use('/api/history', require('./routes/conferenceHistory'));
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── GET /api/history/conferences ──────────────────────────────
// List all conferences, newest first. Supports ?limit=, ?offset=, ?name=
router.get('/conferences', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const name   = req.query.name || undefined;

    const [conferences, stats] = await Promise.all([
      db.getAllConferences({ limit, offset, name }),
      db.getStats()
    ]);

    res.json({ conferences, stats });
  } catch (err) {
    console.error('[history] list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/history/conferences/:id ─────────────────────────
// Full detail: conference + participants + events
router.get('/conferences/:id', async (req, res) => {
  try {
    const conf = await db.getConferenceById(req.params.id);
    if (!conf) return res.status(404).json({ error: 'Conference not found' });

    const [participants, events] = await Promise.all([
      db.getParticipantsByConference(conf.id),
      db.getEventsByConference(conf.id)
    ]);

    // Compute live duration for participants still in the call
    const now = Date.now();
    const enriched = participants.map(p => {
      const joinedMs  = new Date(p.joined_at).getTime();
      const leftMs    = p.left_at ? new Date(p.left_at).getTime() : now;
      const duration  = p.duration_sec ?? Math.round((leftMs - joinedMs) / 1000);
      return {
        ...p,
        // camelCase aliases so report.html doesn't need changes
        conferenceId:   p.conference_id,
        conferenceName: p.conference_name,
        memberId:       p.member_id,
        user:           p.user,
        joinedAt:       p.joined_at,
        leftAt:         p.left_at,
        durationSec:    duration,
        duration,
        wasMuted:       p.was_muted,
        wasKicked:      p.was_kicked
      };
    });

    const enrichedEvents = events.map(e => ({
      ...e,
      conferenceId:   e.conference_id,
      conferenceName: e.conference_name,
      memberId:       e.member_id,
      user:           e.user,
      ts:             e.ts
    }));

    // Conference duration
    const startMs     = new Date(conf.started_at).getTime();
    const endMs       = conf.ended_at ? new Date(conf.ended_at).getTime() : Date.now();
    const confDuration = Math.round((endMs - startMs) / 1000);

    // camelCase aliases for conference row
    const conference = {
      ...conf,
      startedAt:    conf.started_at,
      endedAt:      conf.ended_at,
      terminatedBy: conf.terminated_by,
      totalMembers: conf.total_members,
      peakMembers:  conf.peak_members
    };

    res.json({ conference, confDuration, participants: enriched, events: enrichedEvents });
  } catch (err) {
    console.error('[history] detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/history/stats ────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    res.json(await db.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

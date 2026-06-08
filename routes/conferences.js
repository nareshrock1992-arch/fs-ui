/**
 * conferences.js  (PostgreSQL version)
 *
 * All db.* calls are now async — every route handler uses async/await.
 * The API surface to the frontend is identical to the original.
 */

const express = require('express');
const router  = express.Router();
const winston = require('winston');
const db      = require('../db');

const {
  listConferences,
  createConference,
  kickParticipant,
  muteParticipant,
  unmuteParticipant,
  muteAllParticipants,
  unmuteAllParticipants,
  terminateConference,
  getConferenceStats,
  parseConferenceList
} = require('../freeswitch/esl');

// ── Logger ────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'conference-actions.log' })
  ]
});

// ── Shared route handler factory ──────────────────────────────
// Wraps the repeated try/catch → logger.info → logger.error → res.json
// pattern used by every conference action route.
function conferenceAction(action, handler) {
  return async (req, res) => {
    try {
      const { result, payload } = await handler(req);
      logger.info({ action, ...req.body, result });
      res.json({ success: true, result, ...payload });
    } catch (err) {
      logger.error({ action, ...req.body, error: err.message });
      res.status(500).json({ error: err.message });
    }
  };
}

// ── GET /list ─────────────────────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    const raw         = await listConferences();
    const conferences = parseConferenceList(raw);

    await Promise.all(
      conferences
        .filter(p => p.conferenceName && p.memberId)
        .map(p => db.recordJoin(p.conferenceName, p.memberId, p.user))
    );

    res.json({ conferences });
  } catch (err) {
    logger.error({ action: 'list', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── GET /active (with start times) ─────────────────────────────
router.get('/active', async (req, res) => {
  try {
    const activeConfs = await db.getActiveConferences();
    res.json({ conferences: activeConfs });
  } catch (err) {
    logger.error({ action: 'active', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /create ──────────────────────────────────────────────
router.post('/create', conferenceAction('create', async (req) => {
  const { name, extension } = req.body;
  const result = await createConference(name, extension);
  await db.ensureConference(name);
  await db.addConferenceEvent(name, 'create', `Created by dialling ${extension}`, 'operator');
  return { result };
}));

// ── POST /kick ────────────────────────────────────────────────
router.post('/kick', conferenceAction('kick', async (req) => {
  const { conferenceName, memberId } = req.body;
  const result = await kickParticipant(conferenceName, memberId);
  await db.recordLeave(conferenceName, memberId, true);
  return { result };
}));

// ── POST /mute ────────────────────────────────────────────────
router.post('/mute', conferenceAction('mute', async (req) => {
  const { conferenceName, memberId } = req.body;
  const result = await muteParticipant(conferenceName, memberId);
  await db.recordMute(conferenceName, memberId, true);
  return { result };
}));

// ── POST /unmute ──────────────────────────────────────────────
router.post('/unmute', conferenceAction('unmute', async (req) => {
  const { conferenceName, memberId } = req.body;
  const result = await unmuteParticipant(conferenceName, memberId);
  await db.recordMute(conferenceName, memberId, false);
  return { result };
}));

// ── POST /muteall ─────────────────────────────────────────────
router.post('/muteall', conferenceAction('muteall', async (req) => {
  const { conferenceName } = req.body;
  const result = await muteAllParticipants(conferenceName);
  await db.addConferenceEvent(conferenceName, 'mute', 'All participants muted', 'operator');
  return { result };
}));

// ── POST /unmuteall ───────────────────────────────────────────
router.post('/unmuteall', conferenceAction('unmuteall', async (req) => {
  const { conferenceName } = req.body;
  const result = await unmuteAllParticipants(conferenceName);
  await db.addConferenceEvent(conferenceName, 'unmute', 'All participants unmuted', 'operator');
  return { result };
}));

// ── POST /terminate ───────────────────────────────────────────
router.post('/terminate', conferenceAction('terminate', async (req) => {
  const { conferenceName } = req.body;
  const result = await terminateConference(conferenceName);
  await db.addConferenceEvent(conferenceName, 'terminate', 'Conference terminated by operator', 'operator');
  await db.closeConference(conferenceName, 'operator');
  return { result };
}));

// ── GET /monitor ──────────────────────────────────────────────
router.get('/monitor', async (req, res) => {
  try {
    const stats = await getConferenceStats();
    res.json({ stats });
  } catch (err) {
    logger.error({ action: 'monitor', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

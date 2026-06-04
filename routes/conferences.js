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

// ── GET /list ─────────────────────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    const raw         = await listConferences();
    const conferences = parseConferenceList(raw);

    // Auto-register active participants into DB (idempotent)
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

// ── POST /create ──────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const { name, extension } = req.body;
  try {
    const result = await createConference(name, extension);
    logger.info({ action: 'create', name, extension, result });

    await db.ensureConference(name);
    await db.addConferenceEvent(name, 'create', `Created by dialling ${extension}`, 'operator');

    res.json({ success: true, result });
  } catch (err) {
    logger.error({ action: 'create', name, extension, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /kick ────────────────────────────────────────────────
router.post('/kick', async (req, res) => {
  const { conferenceName, memberId } = req.body;
  try {
    const result = await kickParticipant(conferenceName, memberId);
    logger.info({ action: 'kick', conferenceName, memberId, result });

    await db.recordLeave(conferenceName, memberId, true);

    res.json({ success: true, result });
  } catch (err) {
    logger.error({ action: 'kick', conferenceName, memberId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /mute ────────────────────────────────────────────────
router.post('/mute', async (req, res) => {
  const { conferenceName, memberId } = req.body;
  try {
    const result = await muteParticipant(conferenceName, memberId);
    logger.info({ action: 'mute', conferenceName, memberId, result });

    await db.recordMute(conferenceName, memberId, true);

    res.json({ success: true, result });
  } catch (err) {
    logger.error({ action: 'mute', conferenceName, memberId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /unmute ──────────────────────────────────────────────
router.post('/unmute', async (req, res) => {
  const { conferenceName, memberId } = req.body;
  try {
    const result = await unmuteParticipant(conferenceName, memberId);
    logger.info({ action: 'unmute', conferenceName, memberId, result });

    await db.recordMute(conferenceName, memberId, false);

    res.json({ success: true, result });
  } catch (err) {
    logger.error({ action: 'unmute', conferenceName, memberId, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /muteall ─────────────────────────────────────────────
router.post('/muteall', async (req, res) => {
  const { conferenceName } = req.body;
  try {
    const result = await muteAllParticipants(conferenceName);
    logger.info({ action: 'muteall', conferenceName, result });

    await db.addConferenceEvent(conferenceName, 'mute', 'All participants muted', 'operator');

    res.json({ success: true, result });
  } catch (err) {
    logger.error({ action: 'muteall', conferenceName, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /unmuteall ───────────────────────────────────────────
router.post('/unmuteall', async (req, res) => {
  const { conferenceName } = req.body;
  try {
    const result = await unmuteAllParticipants(conferenceName);
    logger.info({ action: 'unmuteall', conferenceName, result });

    await db.addConferenceEvent(conferenceName, 'unmute', 'All participants unmuted', 'operator');

    res.json({ success: true, result });
  } catch (err) {
    logger.error({ action: 'unmuteall', conferenceName, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /terminate ───────────────────────────────────────────
router.post('/terminate', async (req, res) => {
  const { conferenceName } = req.body;
  try {
    const result = await terminateConference(conferenceName);
    logger.info({ action: 'terminate', conferenceName, result });

    await db.addConferenceEvent(conferenceName, 'terminate', 'Conference terminated by operator', 'operator');
    await db.closeConference(conferenceName, 'operator');

    res.json({ success: true, result });
  } catch (err) {
    logger.error({ action: 'terminate', conferenceName, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

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

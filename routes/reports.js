/**
 * reports.js — read-only access to blast_logs (ENS/ERS Reports).
 * Filter with ?module=ens|ers.
 */
const express = require('express');
const router  = express.Router();
const { BlastLog } = require('../models');

// GET /api/reports?module=ens&limit=100
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.module) where.module = req.query.module;
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const rows = await BlastLog.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
    });
    res.json({ success: true, reports: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

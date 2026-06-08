const express = require('express');
const router = express.Router();
const db = require('../db');

// List blast logs with filters and pagination
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.module) filters.module = req.query.module;
    if (req.query.group_type) filters.group_type = req.query.group_type;
    if (req.query.phone) filters.phone = req.query.phone;
    if (req.query.date_from) filters.date_from = req.query.date_from;
    if (req.query.date_to) filters.date_to = req.query.date_to;
    if (req.query.blast_status) filters.blast_status = req.query.blast_status;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    const countFilters = { ...filters };
    const total = await db.countBlastLogs(countFilters);

    filters.limit = limit;
    filters.offset = offset;
    const items = await db.getAllBlastLogs(filters);

    res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[blast_logs] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

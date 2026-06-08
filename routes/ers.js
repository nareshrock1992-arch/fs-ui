const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// List ERS profiles (with optional ?organization_Id filter)
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.organization_Id) filters.organization_Id = req.query.organization_Id;
    if (req.query.active !== undefined) filters.active = req.query.active === 'true';
    const items = await db.getAllERS(filters);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('[ers] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single ERS profile
router.get('/:id', async (req, res) => {
  try {
    const item = await db.getERSById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[ers] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create ERS profile
router.post('/add', async (req, res) => {
  try {
    const { name, responders, active, phone, retry, retry_number, organization_Id } = req.body;
    if (!name || !phone || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name, phone, and organization are required' });
    }
    const id = crypto.randomUUID();
    const item = await db.createERS({ id, name, responders, active, phone, retry, retry_number, organization_Id });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[ers] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update ERS profile
router.put('/:id', async (req, res) => {
  try {
    const { name, responders, active, phone, retry, retry_number, organization_Id } = req.body;
    if (!name || !phone || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name, phone, and organization are required' });
    }
    const item = await db.updateERS(req.params.id, { name, responders, active, phone, retry, retry_number, organization_Id });
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[ers] update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete ERS profile
router.delete('/:id', async (req, res) => {
  try {
    const item = await db.deleteERS(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[ers] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

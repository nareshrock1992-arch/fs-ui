const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// List ENS profiles (with optional ?organization_Id filter)
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.organization_Id) filters.organization_Id = req.query.organization_Id;
    if (req.query.active !== undefined) filters.active = req.query.active === 'true';
    const items = await db.getAllENS(filters);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('[ens] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single ENS profile
router.get('/:id', async (req, res) => {
  try {
    const item = await db.getENSById(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[ens] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create ENS profile
router.post('/add', async (req, res) => {
  try {
    const { name, pin, responders, active, phone, retry_number, retry, organization_Id } = req.body;
    if (!name || !pin || !phone || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name, PIN, phone, and organization are required' });
    }
    const id = crypto.randomUUID();
    const item = await db.createENS({ id, name, pin, responders, active, phone, retry_number, retry, organization_Id });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[ens] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update ENS profile
router.put('/:id', async (req, res) => {
  try {
    const { name, pin, responders, active, phone, retry_number, retry, organization_Id } = req.body;
    if (!name || !pin || !phone || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name, PIN, phone, and organization are required' });
    }
    const item = await db.updateENS(req.params.id, { name, pin, responders, active, phone, retry_number, retry, organization_Id });
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[ens] update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete ENS profile
router.delete('/:id', async (req, res) => {
  try {
    const item = await db.deleteENS(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('[ens] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

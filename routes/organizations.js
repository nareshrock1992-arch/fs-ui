const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// List organizations (with optional ?modules=ens|ers filter)
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.modules) filters.modules = req.query.modules;
    const orgs = await db.getAllOrganizations(filters);
    res.json({ success: true, data: orgs });
  } catch (err) {
    console.error('[org] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single organization
router.get('/:id', async (req, res) => {
  try {
    const org = await db.getOrganizationById(req.params.id);
    if (!org) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: org });
  } catch (err) {
    console.error('[org] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create organization
router.post('/add', async (req, res) => {
  try {
    const { name, type, description, active, modules } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Name and type are required' });
    }
    const id = crypto.randomUUID();
    const org = await db.createOrganization({ id, name, type, description, active, modules });
    res.json({ success: true, data: org });
  } catch (err) {
    console.error('[org] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update organization
router.put('/:id', async (req, res) => {
  try {
    const { name, type, description, active, modules } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Name and type are required' });
    }
    const org = await db.updateOrganization(req.params.id, { name, type, description, active, modules });
    if (!org) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: org });
  } catch (err) {
    console.error('[org] update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete organization
router.delete('/:id', async (req, res) => {
  try {
    const org = await db.deleteOrganization(req.params.id);
    if (!org) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: org });
  } catch (err) {
    console.error('[org] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

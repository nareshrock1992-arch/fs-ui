const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// List locations (with optional filters)
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.modules) filters.modules = req.query.modules;
    if (req.query.organization_Id) filters.organization_Id = req.query.organization_Id;
    if (req.query.department_Id) filters.department_Id = req.query.department_Id;
    const locations = await db.getAllLocations(filters);
    res.json({ success: true, data: locations });
  } catch (err) {
    console.error('[locations] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single location
router.get('/:id', async (req, res) => {
  try {
    const loc = await db.getLocationById(req.params.id);
    if (!loc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: loc });
  } catch (err) {
    console.error('[locations] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create location
router.post('/add', async (req, res) => {
  try {
    const { name, modules, organization_Id, department_Id } = req.body;
    if (!name || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name and organization are required' });
    }
    const id = crypto.randomUUID();
    const loc = await db.createLocation({ id, name, modules, organization_Id, department_Id });
    res.json({ success: true, data: loc });
  } catch (err) {
    console.error('[locations] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update location
router.put('/:id', async (req, res) => {
  try {
    const { name, modules, organization_Id, department_Id } = req.body;
    if (!name || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name and organization are required' });
    }
    const loc = await db.updateLocation(req.params.id, { name, modules, organization_Id, department_Id });
    if (!loc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: loc });
  } catch (err) {
    console.error('[locations] update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete location
router.delete('/:id', async (req, res) => {
  try {
    const loc = await db.deleteLocation(req.params.id);
    if (!loc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: loc });
  } catch (err) {
    console.error('[locations] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

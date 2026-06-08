const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// List departments (with optional filters)
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.modules) filters.modules = req.query.modules;
    if (req.query.organization_Id) filters.organization_Id = req.query.organization_Id;
    const depts = await db.getAllDepartments(filters);
    res.json({ success: true, data: depts });
  } catch (err) {
    console.error('[departments] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single department
router.get('/:id', async (req, res) => {
  try {
    const dept = await db.getDepartmentById(req.params.id);
    if (!dept) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: dept });
  } catch (err) {
    console.error('[departments] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create department
router.post('/add', async (req, res) => {
  try {
    const { name, description, organization_Id, modules } = req.body;
    if (!name || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name and organization are required' });
    }
    const id = crypto.randomUUID();
    const dept = await db.createDepartment({ id, name, description, organization_Id, modules });
    res.json({ success: true, data: dept });
  } catch (err) {
    console.error('[departments] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update department
router.put('/:id', async (req, res) => {
  try {
    const { name, description, organization_Id, modules } = req.body;
    if (!name || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name and organization are required' });
    }
    const dept = await db.updateDepartment(req.params.id, { name, description, organization_Id, modules });
    if (!dept) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: dept });
  } catch (err) {
    console.error('[departments] update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete department
router.delete('/:id', async (req, res) => {
  try {
    const dept = await db.deleteDepartment(req.params.id);
    if (!dept) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: dept });
  } catch (err) {
    console.error('[departments] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

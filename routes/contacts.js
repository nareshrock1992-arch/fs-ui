const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// List contacts (with optional filters: ?modules=ens&organization_Id=xxx&department_Id=yyy)
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.modules) filters.modules = req.query.modules;
    if (req.query.organization_Id) filters.organization_Id = req.query.organization_Id;
    if (req.query.department_Id) filters.department_Id = req.query.department_Id;
    const contacts = await db.getAllContacts(filters);
    res.json({ success: true, data: contacts });
  } catch (err) {
    console.error('[contacts] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single contact
router.get('/:id', async (req, res) => {
  try {
    const contact = await db.getContactById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: contact });
  } catch (err) {
    console.error('[contacts] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create contact
router.post('/add', async (req, res) => {
  try {
    const { name, role, phone, email, organization_Id, department_Id, modules } = req.body;
    if (!name || !role || !phone || !organization_Id || !modules) {
      return res.status(400).json({ success: false, error: 'Name, role, phone, organization, and module are required' });
    }
    const id = crypto.randomUUID();
    const contact = await db.createContact({ id, name, role, phone, email, organization_Id, department_Id, modules });
    res.json({ success: true, data: contact });
  } catch (err) {
    console.error('[contacts] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update contact
router.put('/:id', async (req, res) => {
  try {
    const { name, role, phone, email, organization_Id, department_Id, modules } = req.body;
    if (!name || !role || !phone || !organization_Id || !modules) {
      return res.status(400).json({ success: false, error: 'Name, role, phone, organization, and module are required' });
    }
    const contact = await db.updateContact(req.params.id, { name, role, phone, email, organization_Id, department_Id, modules });
    if (!contact) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: contact });
  } catch (err) {
    console.error('[contacts] update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete contact
router.delete('/:id', async (req, res) => {
  try {
    const contact = await db.deleteContact(req.params.id);
    if (!contact) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: contact });
  } catch (err) {
    console.error('[contacts] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

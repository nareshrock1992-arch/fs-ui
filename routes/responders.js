const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// List responders (with optional filters)
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.modules) filters.modules = req.query.modules;
    if (req.query.organization_Id) filters.organization_Id = req.query.organization_Id;
    const responders = await db.getAllResponders(filters);
    res.json({ success: true, data: responders });
  } catch (err) {
    console.error('[responders] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single responder
router.get('/:id', async (req, res) => {
  try {
    const resp = await db.getResponderById(req.params.id);
    if (!resp) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: resp });
  } catch (err) {
    console.error('[responders] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create responder
router.post('/add', async (req, res) => {
  try {
    const { name, description, modules, organization_Id } = req.body;
    if (!name || !description || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name, description, and organization are required' });
    }
    const id = crypto.randomUUID();
    const resp = await db.createResponder({ id, name, description, modules, organization_Id });
    res.json({ success: true, data: resp });
  } catch (err) {
    console.error('[responders] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update responder
router.put('/:id', async (req, res) => {
  try {
    const { name, description, modules, organization_Id } = req.body;
    if (!name || !description || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name, description, and organization are required' });
    }
    const resp = await db.updateResponder(req.params.id, { name, description, modules, organization_Id });
    if (!resp) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: resp });
  } catch (err) {
    console.error('[responders] update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete responder
router.delete('/:id', async (req, res) => {
  try {
    const resp = await db.deleteResponder(req.params.id);
    if (!resp) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: resp });
  } catch (err) {
    console.error('[responders] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Responder contacts management
router.get('/:id/contacts', async (req, res) => {
  try {
    const contacts = await db.getResponderContacts(req.params.id);
    res.json({ success: true, data: contacts });
  } catch (err) {
    console.error('[responders] contacts list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/contacts', async (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ success: false, error: 'contactId is required' });
    const result = await db.addContactToResponder(req.params.id, contactId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[responders] add contact error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id/contacts/:contactId', async (req, res) => {
  try {
    const result = await db.removeContactFromResponder(req.params.id, req.params.contactId);
    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[responders] remove contact error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

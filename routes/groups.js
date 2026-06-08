const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

// List groups (with optional filters)
router.get('/list', async (req, res) => {
  try {
    const filters = {};
    if (req.query.modules) filters.modules = req.query.modules;
    if (req.query.organization_Id) filters.organization_Id = req.query.organization_Id;
    const groups = await db.getAllGroups(filters);
    res.json({ success: true, data: groups });
  } catch (err) {
    console.error('[groups] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single group
router.get('/:id', async (req, res) => {
  try {
    const group = await db.getGroupById(req.params.id);
    if (!group) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: group });
  } catch (err) {
    console.error('[groups] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create group
router.post('/add', async (req, res) => {
  try {
    const { name, type, description, organization_Id, modules } = req.body;
    if (!name || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name and organization are required' });
    }
    const id = crypto.randomUUID();
    const group = await db.createGroup({ id, name, type, description, organization_Id, modules });
    res.json({ success: true, data: group });
  } catch (err) {
    console.error('[groups] create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update group
router.put('/:id', async (req, res) => {
  try {
    const { name, type, description, organization_Id, modules } = req.body;
    if (!name || !organization_Id) {
      return res.status(400).json({ success: false, error: 'Name and organization are required' });
    }
    const group = await db.updateGroup(req.params.id, { name, type, description, organization_Id, modules });
    if (!group) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: group });
  } catch (err) {
    console.error('[groups] update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete group
router.delete('/:id', async (req, res) => {
  try {
    const group = await db.deleteGroup(req.params.id);
    if (!group) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: group });
  } catch (err) {
    console.error('[groups] delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get contacts in a group
router.get('/:id/contacts', async (req, res) => {
  try {
    const contacts = await db.getGroupContacts(req.params.id);
    res.json({ success: true, data: contacts });
  } catch (err) {
    console.error('[groups] get contacts error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add contact to group
router.post('/:id/contacts', async (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ success: false, error: 'contactId is required' });
    const gc = await db.addContactToGroup(req.params.id, contactId);
    res.json({ success: true, data: gc });
  } catch (err) {
    console.error('[groups] add contact error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove contact from group
router.delete('/:id/contacts/:contactId', async (req, res) => {
  try {
    const gc = await db.removeContactFromGroup(req.params.id, req.params.contactId);
    if (!gc) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: gc });
  } catch (err) {
    console.error('[groups] remove contact error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

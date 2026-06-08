/**
 * responders.js — CRUD for Responder (the ENS/ERS "Groups") plus member
 * management (Responder ↔ Contacts via ResponderContacts).
 */
const express = require('express');
const router  = express.Router();
const { Responder, Contacts, Organization } = require('../models');

const MODULES = ['ens', 'ers'];

// GET /api/responders?module=ens&organization_Id=...
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.module) where.modules = req.query.module;
    if (req.query.organization_Id) where.organization_Id = req.query.organization_Id;
    const rows = await Responder.findAll({
      where,
      order: [['name', 'ASC']],
      include: [{ model: Organization, attributes: ['id', 'name'] }],
    });
    res.json({ success: true, responders: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/responders/:id  (with members)
router.get('/:id', async (req, res) => {
  try {
    const row = await Responder.findByPk(req.params.id, {
      include: [{ model: Contacts, through: { attributes: [] } }],
    });
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, responder: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/responders   body may include contactIds: []
router.post('/', async (req, res) => {
  try {
    const { name, description, modules, organization_Id, contactIds } = req.body;
    if (!name || !organization_Id)
      return res.status(400).json({ success: false, error: 'name and organization_Id are required' });
    if (modules && !MODULES.includes(modules))
      return res.status(400).json({ success: false, error: 'modules must be ens or ers' });
    const row = await Responder.create({
      name,
      description: description || '',
      modules,
      organization_Id,
    });
    if (Array.isArray(contactIds) && contactIds.length) {
      await row.setContacts(contactIds);
    }
    res.status(201).json({ success: true, responder: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/responders/:id
router.put('/:id', async (req, res) => {
  try {
    const row = await Responder.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    const { name, description, modules, organization_Id, contactIds } = req.body;
    if (modules && !MODULES.includes(modules))
      return res.status(400).json({ success: false, error: 'modules must be ens or ers' });
    await row.update({ name, description, modules, organization_Id });
    if (Array.isArray(contactIds)) {
      await row.setContacts(contactIds);
    }
    res.json({ success: true, responder: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/responders/:id
router.delete('/:id', async (req, res) => {
  try {
    const n = await Responder.destroy({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/responders/:id/members  { contactIds: [] }  (add)
router.post('/:id/members', async (req, res) => {
  try {
    const row = await Responder.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    const { contactIds } = req.body;
    if (!Array.isArray(contactIds))
      return res.status(400).json({ success: false, error: 'contactIds array required' });
    await row.addContacts(contactIds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/responders/:id/members/:contactId  (remove one)
router.delete('/:id/members/:contactId', async (req, res) => {
  try {
    const row = await Responder.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    await row.removeContact(req.params.contactId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

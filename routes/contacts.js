/**
 * contacts.js — CRUD for Contacts (the ENS/ERS "Users" / recipients).
 * Scope with ?module / ?organization_Id / ?department_Id.
 */
const express = require('express');
const router  = express.Router();
const { Contacts, Organization, Department } = require('../models');

const MODULES = ['ens', 'ers'];

// GET /api/contacts?module=ens&organization_Id=...&department_Id=...
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.module) where.modules = req.query.module;
    if (req.query.organization_Id) where.organization_Id = req.query.organization_Id;
    if (req.query.department_Id) where.department_Id = req.query.department_Id;
    const rows = await Contacts.findAll({
      where,
      order: [['name', 'ASC']],
      include: [
        { model: Organization, attributes: ['id', 'name'] },
        { model: Department, attributes: ['id', 'name'] },
      ],
    });
    res.json({ success: true, contacts: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await Contacts.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, contact: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const { name, role, phone, email, organization_Id, department_Id, modules } = req.body;
    if (!name || !phone || !organization_Id || !modules)
      return res.status(400).json({ success: false, error: 'name, phone, organization_Id and modules are required' });
    if (!MODULES.includes(modules))
      return res.status(400).json({ success: false, error: 'modules must be ens or ers' });
    const row = await Contacts.create({
      name,
      role: role || 'member',
      phone,
      email,
      organization_Id,
      department_Id: department_Id || null,
      modules,
    });
    res.status(201).json({ success: true, contact: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res) => {
  try {
    const row = await Contacts.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    const { name, role, phone, email, organization_Id, department_Id, modules } = req.body;
    if (modules && !MODULES.includes(modules))
      return res.status(400).json({ success: false, error: 'modules must be ens or ers' });
    await row.update({ name, role, phone, email, organization_Id, department_Id, modules });
    res.json({ success: true, contact: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    const n = await Contacts.destroy({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

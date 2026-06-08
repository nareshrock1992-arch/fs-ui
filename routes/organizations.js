/**
 * organizations.js — CRUD for Organization (Sequelize).
 * Scope per service with ?module=ens|ers.
 */
const express = require('express');
const router  = express.Router();
const { Organization } = require('../models');

const MODULES = ['ens', 'ers'];

// GET /api/organizations?module=ens
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.module) where.modules = req.query.module;
    const rows = await Organization.findAll({ where, order: [['name', 'ASC']] });
    res.json({ success: true, organizations: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/organizations/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await Organization.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, organization: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/organizations
router.post('/', async (req, res) => {
  try {
    const { name, type, description, active, modules } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (modules && !MODULES.includes(modules))
      return res.status(400).json({ success: false, error: 'modules must be ens or ers' });
    const row = await Organization.create({
      name,
      type: type || 'default',
      description,
      active: active !== undefined ? active : true,
      modules,
    });
    res.status(201).json({ success: true, organization: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/organizations/:id
router.put('/:id', async (req, res) => {
  try {
    const row = await Organization.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    const { name, type, description, active, modules } = req.body;
    if (modules && !MODULES.includes(modules))
      return res.status(400).json({ success: false, error: 'modules must be ens or ers' });
    await row.update({ name, type, description, active, modules });
    res.json({ success: true, organization: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/organizations/:id
router.delete('/:id', async (req, res) => {
  try {
    const n = await Organization.destroy({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

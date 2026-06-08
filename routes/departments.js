/**
 * departments.js — CRUD for the new Department table (Sequelize).
 * Organization → Department → Contacts. Scope with ?module / ?organization_Id.
 */
const express = require('express');
const router  = express.Router();
const { Department, Organization } = require('../models');

const MODULES = ['ens', 'ers'];

// GET /api/departments?module=ens&organization_Id=...
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.module) where.modules = req.query.module;
    if (req.query.organization_Id) where.organization_Id = req.query.organization_Id;
    const rows = await Department.findAll({
      where,
      order: [['name', 'ASC']],
      include: [{ model: Organization, attributes: ['id', 'name'] }],
    });
    res.json({ success: true, departments: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/departments/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await Department.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, department: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/departments
router.post('/', async (req, res) => {
  try {
    const { name, description, modules, organization_Id } = req.body;
    if (!name || !organization_Id)
      return res.status(400).json({ success: false, error: 'name and organization_Id are required' });
    if (modules && !MODULES.includes(modules))
      return res.status(400).json({ success: false, error: 'modules must be ens or ers' });
    const row = await Department.create({ name, description, modules, organization_Id });
    res.status(201).json({ success: true, department: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/departments/:id
router.put('/:id', async (req, res) => {
  try {
    const row = await Department.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    const { name, description, modules, organization_Id } = req.body;
    if (modules && !MODULES.includes(modules))
      return res.status(400).json({ success: false, error: 'modules must be ens or ers' });
    await row.update({ name, description, modules, organization_Id });
    res.json({ success: true, department: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/departments/:id
router.delete('/:id', async (req, res) => {
  try {
    const n = await Department.destroy({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

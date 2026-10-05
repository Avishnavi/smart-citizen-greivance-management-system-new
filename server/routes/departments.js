'use strict';

const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const Officer = require('../models/Officer');

// GET /api/departments
router.get('/', async (req, res, next) => {
  try {
    if (require('mongoose').connection.readyState !== 1) {
      const { MOCK_DEPARTMENTS } = require('../services/mockData');
      return res.json({ success: true, count: MOCK_DEPARTMENTS.length, data: MOCK_DEPARTMENTS });
    }
    const departments = await Department.find({ active: true }).sort({ name: 1 });
    res.json({ success: true, count: departments.length, data: departments });
  } catch (err) {
    next(err);
  }
});

// GET /api/departments/:id/officers
router.get('/:id/officers', async (req, res, next) => {
  try {
    const officers = await Officer.find({
      departmentId: req.params.id,
      active: true,
    }).sort({ name: 1 });
    res.json({ success: true, count: officers.length, data: officers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { categorizeComplaint } = require('../services/categorizationService');
const { checkDuplicate } = require('../services/duplicateDetectionService');
const { predictPriority } = require('../services/priorityService');

// POST /api/ai/preview-analysis
// Runs fast multi-modal analysis preview before the user submits the complaint
router.post('/preview-analysis', async (req, res, next) => {
  try {
    const { description = '', location, imageUrls = [], hasVoice = false } = req.body;

    const startTime = Date.now();

    // 1. Categorization
    const classification = await categorizeComplaint(description, imageUrls);

    // 2. Duplicate Detection against recent active complaints
    let duplicate = { isDuplicate: false, recommendation: 'No duplicate detected.' };
    if (location && location.latitude && location.longitude) {
      const recentComplaints = await Complaint.find({
        status: { $nin: ['CLOSED', 'REJECTED'] },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }).limit(50);

      duplicate = await checkDuplicate(description, location, recentComplaints);
    }

    // 3. Priority Prediction
    const priority = await predictPriority(
      classification.category,
      description,
      location || {},
      hasVoice || (imageUrls && imageUrls.length > 0)
    );

    const processingTimeMs = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        classification,
        duplicate,
        priority,
        processingTimeMs,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

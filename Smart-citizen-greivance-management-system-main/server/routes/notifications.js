'use strict';

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// GET /api/notifications/:citizenId
router.get('/:citizenId', async (req, res, next) => {
  try {
    const { citizenId } = req.params;
    const notifications = await Notification.find({ citizenId })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      citizenId,
      read: false,
    });

    res.json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true, readAt: new Date() },
      { new: true }
    );
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:citizenId/read-all
router.post('/:citizenId/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { citizenId: req.params.citizenId, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

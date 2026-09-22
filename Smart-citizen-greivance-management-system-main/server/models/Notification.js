'use strict';

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    citizenId: { type: String, required: true, index: true },
    complaintId: { type: String, default: null },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['status_change', 'assigned', 'resolved', 'reminder', 'announcement', 'escalation', 'recurring'],
      default: 'status_change',
    },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ citizenId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);

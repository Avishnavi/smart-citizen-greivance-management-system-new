'use strict';

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    citizenId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    recipientRole: {
      type: String,
      enum: ['citizen', 'central_admin', 'department_supervisor', 'department_employee'],
      default: 'citizen',
      index: true,
    },
    complaintId: { type: String, default: null, index: true },
    taskId: { type: String, default: null, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['status_change', 'assigned', 'resolved', 'closed', 'reminder', 'announcement', 'escalation', 'recurring'],
      default: 'status_change',
    },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ citizenId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ taskId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);

'use strict';

const mongoose = require('mongoose');

/**
 * ComplaintMessage — official communication records between citizens and municipal departments,
 * including departmental clarification threads, progress discussions, and internal staff notes.
 */
const ComplaintMessageSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: [true, 'Complaint ID is required'],
      index: true,
    },
    taskId: {
      type: String,
      default: null,
      index: true,
    },
    // Department association for department-wise threaded conversations
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    departmentName: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender user reference is required'],
      index: true,
    },
    senderName: {
      type: String,
      required: [true, 'Sender name is required'],
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ['citizen', 'central_admin', 'department_supervisor', 'department_employee'],
      required: [true, 'Sender role is required'],
      index: true,
    },
    messageType: {
      type: String,
      enum: [
        'citizen_inquiry',
        'admin_clarification_request',
        'citizen_clarification_response',
        'internal_staff_note',
        'status_update',
      ],
      default: 'citizen_inquiry',
    },
    message: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
    },
    attachments: [
      {
        type: String,
      },
    ],
    // True for internal staff-only communications; False for citizen-facing messages
    isInternal: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Chronological indexes for complaint and task queries
ComplaintMessageSchema.index({ complaintId: 1, createdAt: 1 });
ComplaintMessageSchema.index({ taskId: 1, createdAt: 1 });

// Compound indexes for department-wise conversations and role-based visibility
ComplaintMessageSchema.index({ complaintId: 1, departmentId: 1, createdAt: 1 });
ComplaintMessageSchema.index({ complaintId: 1, departmentId: 1, isInternal: 1, createdAt: 1 });
ComplaintMessageSchema.index({ complaintId: 1, isInternal: 1, createdAt: 1 });
ComplaintMessageSchema.index({ taskId: 1, isInternal: 1, createdAt: 1 });

module.exports = mongoose.model('ComplaintMessage', ComplaintMessageSchema);


'use strict';

const mongoose = require('mongoose');

const CitizenSchema = new mongoose.Schema(
  {
    citizenId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    ward: { type: String, default: '' },
    zone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    preferredLanguage: { type: String, default: 'English' },
    notificationPreferences: {
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
    },
    totalComplaints: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Citizen', CitizenSchema);

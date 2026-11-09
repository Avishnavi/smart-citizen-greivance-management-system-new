'use strict';

/**
 * verify-chat-phase2.js
 * Isolated, non-destructive model validation test for Phase 2:
 * ComplaintMessage model updates for Department-wise conversations.
 */

const path = require('path');
const mongoose = require('mongoose');

// Outer and inner model paths
const outerModelPath = path.join(__dirname, '../models/ComplaintMessage.js');
const innerModelPath = path.join(__dirname, '../../Smart-citizen-greivance-management-system-main/server/models/ComplaintMessage.js');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { connectDatabase } = require('../config/database');

async function runValidation() {
  console.log('================================================================');
  console.log('🧪 PHASE 2: COMPLAINTMESSAGE MODEL VALIDATION (ISOLATED & NON-DESTRUCTIVE)');
  console.log('================================================================\n');

  const results = [];
  function record(id, title, passed, details) {
    results.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${id}] ${title}`);
    if (details) console.log(`   └─ ${details}`);
  }

  // 1. Check Model Files and Schema definitions
  const ComplaintMessage = require(outerModelPath);
  record('M1', 'Outer ComplaintMessage model loaded successfully', !!ComplaintMessage, outerModelPath);

  const innerComplaintMessage = require(innerModelPath);
  record('M2', 'Inner ComplaintMessage model loaded successfully', !!innerComplaintMessage, innerModelPath);

  const schema = ComplaintMessage.schema;

  // Check departmentId
  const deptIdPath = schema.path('departmentId');
  const deptIdValid =
    deptIdPath &&
    (deptIdPath.instance === 'ObjectId' || deptIdPath.instance === 'ObjectID') &&
    deptIdPath.options.ref === 'Department' &&
    deptIdPath.options.default === null;
  record(
    'M3',
    'departmentId field definition',
    deptIdValid,
    `Type: ${deptIdPath?.instance}, Ref: ${deptIdPath?.options?.ref}, Default: ${deptIdPath?.options?.default}`
  );

  // Check departmentName
  const deptNamePath = schema.path('departmentName');
  const deptNameValid =
    deptNamePath &&
    deptNamePath.instance === 'String' &&
    deptNamePath.options.default === '' &&
    deptNamePath.options.trim === true;
  record(
    'M4',
    'departmentName field definition',
    deptNameValid,
    `Type: ${deptNamePath?.instance}, Default: "${deptNamePath?.options?.default}", Trim: ${deptNamePath?.options?.trim}`
  );

  // Check existing fields preservation
  const fieldsToCheck = [
    'complaintId',
    'taskId',
    'senderId',
    'senderName',
    'senderRole',
    'messageType',
    'message',
    'attachments',
    'isInternal',
    'createdAt',
    'updatedAt',
  ];
  const allFieldsPreserved = fieldsToCheck.every((f) => schema.path(f) || schema.paths[f]);
  record(
    'M5',
    'All existing ComplaintMessage fields preserved',
    allFieldsPreserved,
    fieldsToCheck.join(', ')
  );

  // Check Compound and Single Indexes
  const indexes = schema.indexes();
  console.log('\nDefined Schema Indexes:');
  indexes.forEach(([spec, opts]) => {
    console.log(' -', JSON.stringify(spec), opts ? JSON.stringify(opts) : '');
  });

  const hasComplaintCreatedIdx = indexes.some(([spec]) => spec.complaintId === 1 && spec.createdAt === 1 && !spec.departmentId && !spec.isInternal);
  const hasTaskCreatedIdx = indexes.some(([spec]) => spec.taskId === 1 && spec.createdAt === 1 && !spec.isInternal);
  const hasComplaintDeptCreatedIdx = indexes.some(([spec]) => spec.complaintId === 1 && spec.departmentId === 1 && spec.createdAt === 1 && !spec.isInternal);
  const hasComplaintDeptInternalCreatedIdx = indexes.some(([spec]) => spec.complaintId === 1 && spec.departmentId === 1 && spec.isInternal === 1 && spec.createdAt === 1);
  const hasComplaintInternalCreatedIdx = indexes.some(([spec]) => spec.complaintId === 1 && spec.isInternal === 1 && spec.createdAt === 1 && !spec.departmentId);
  const hasTaskInternalCreatedIdx = indexes.some(([spec]) => spec.taskId === 1 && spec.isInternal === 1 && spec.createdAt === 1);

  record('IDX1', 'Chronological index on (complaintId, createdAt)', hasComplaintCreatedIdx);
  record('IDX2', 'Chronological index on (taskId, createdAt)', hasTaskCreatedIdx);
  record('IDX3', 'Compound index on (complaintId, departmentId, createdAt)', hasComplaintDeptCreatedIdx);
  record('IDX4', 'Compound index on (complaintId, departmentId, isInternal, createdAt)', hasComplaintDeptInternalCreatedIdx);
  record('IDX5', 'Compound index on (complaintId, isInternal, createdAt)', hasComplaintInternalCreatedIdx);
  record('IDX6', 'Compound index on (taskId, isInternal, createdAt)', hasTaskInternalCreatedIdx);

  // 2. In-Memory Document Validation Tests (No database writes)
  const dummySenderId = new mongoose.Types.ObjectId();
  const dummyDeptId = new mongoose.Types.ObjectId();

  // Test new department message validation
  const newDeptMsg = new ComplaintMessage({
    complaintId: 'CMP-2026-TEST01',
    departmentId: dummyDeptId,
    departmentName: 'Road Maintenance & Infrastructure',
    senderId: dummySenderId,
    senderName: 'Citizen Rajesh Kumar',
    senderRole: 'citizen',
    messageType: 'citizen_inquiry',
    message: 'Could you give an update on the pothole repair at 4th Cross?',
    isInternal: false,
  });
  const newDeptMsgErr = newDeptMsg.validateSync();
  record(
    'VAL1',
    'New message with departmentId & departmentName validates in-memory',
    !newDeptMsgErr,
    newDeptMsgErr ? newDeptMsgErr.message : `departmentId=${newDeptMsg.departmentId}, departmentName=${newDeptMsg.departmentName}`
  );

  // Test legacy message validation (backward compatibility: no departmentId or departmentName provided)
  const legacyMsg = new ComplaintMessage({
    complaintId: 'CMP-2026-LEGACY01',
    senderId: dummySenderId,
    senderName: 'Admin Officer',
    senderRole: 'central_admin',
    message: 'General inquiry on complaint status.',
  });
  const legacyErr = legacyMsg.validateSync();
  const legacyBackwardCompatible =
    !legacyErr &&
    legacyMsg.departmentId === null &&
    legacyMsg.departmentName === '' &&
    legacyMsg.isInternal === false;
  record(
    'VAL2',
    'Legacy message without department fields validates with defaults',
    legacyBackwardCompatible,
    `departmentId=${legacyMsg.departmentId}, departmentName="${legacyMsg.departmentName}", isInternal=${legacyMsg.isInternal}`
  );

  // Test invalid document catches errors
  const invalidMsg = new ComplaintMessage({
    complaintId: '',
    senderRole: 'super_admin', // Invalid role
  });
  const invalidErr = invalidMsg.validateSync();
  const caughtErrors =
    invalidErr &&
    invalidErr.errors.complaintId &&
    invalidErr.errors.senderId &&
    invalidErr.errors.senderName &&
    invalidErr.errors.message &&
    invalidErr.errors.senderRole;
  record(
    'VAL3',
    'Model validation enforces required fields and enum constraints',
    !!caughtErrors,
    'Verified complaintId, senderId, senderName, message, senderRole errors properly caught'
  );

  // 3. Live MongoDB Atlas Read-Only Verification
  console.log('\n--- Live MongoDB Atlas Inspection (Read-Only) ---');
  try {
    await connectDatabase();

    const rawCount = await mongoose.connection.collection('complaintmessages').countDocuments();
    record(
      'DB1',
      'Existing MongoDB complaintmessages count verified',
      rawCount === 8,
      `Exact count in Atlas collection: ${rawCount} (Expected: 8)`
    );

    const existingDocs = await ComplaintMessage.find().lean();
    record(
      'DB2',
      'Loaded all existing documents via updated ComplaintMessage model',
      existingDocs.length === 8,
      `Successfully hydrated ${existingDocs.length} documents`
    );

    // Verify all existing docs are intact and backward compatible
    let backwardCompatibleDocs = 0;
    existingDocs.forEach((doc, idx) => {
      const hasReqFields = doc._id && doc.complaintId && doc.senderId && doc.senderName && doc.message;
      const deptIdVal = doc.departmentId === undefined || doc.departmentId === null;
      if (hasReqFields && deptIdVal) {
        backwardCompatibleDocs++;
      }
    });

    record(
      'DB3',
      'All 8 existing Atlas records intact & backward compatible',
      backwardCompatibleDocs === 8,
      `${backwardCompatibleDocs} of 8 documents retain their original data and resolve cleanly`
    );

    // Sample an existing document
    if (existingDocs.length > 0) {
      const sample = existingDocs[0];
      console.log('\nSample Atlas Message Record (Read-Only):');
      console.log({
        _id: sample._id,
        complaintId: sample.complaintId,
        taskId: sample.taskId,
        departmentId: sample.departmentId ?? null,
        departmentName: sample.departmentName ?? '',
        senderRole: sample.senderRole,
        senderName: sample.senderName,
        messageType: sample.messageType,
        isInternal: sample.isInternal,
        message: sample.message.substring(0, 60) + (sample.message.length > 60 ? '...' : ''),
        createdAt: sample.createdAt,
      });
    }

  } catch (dbErr) {
    record('DB_ERR', 'MongoDB connection / query failed', false, dbErr.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database disconnected cleanly.');
  }

  // Summary
  const allPassed = results.every((r) => r.passed);
  console.log('\n================================================================');
  console.log(`Phase 2 Validation Summary: ${results.filter((r) => r.passed).length}/${results.length} checks passed`);
  console.log(`Overall Status: ${allPassed ? 'ALL CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('================================================================');
}

runValidation().catch((err) => {
  console.error('Validation script failed with error:', err);
  process.exit(1);
});

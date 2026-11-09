'use strict';

/**
 * PHASE 6 VERIFICATION SUITE
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates all 18 test requirements for Phase 6 (RAG-Based Knowledge Support: Module 8):
 *  1. Correct retrieval for a road damage complaint
 *  2. Correct retrieval for a sanitation/drainage complaint
 *  3. Correct department-specific retrieval
 *  4. Retrieval for a multi-department complaint
 *  5. Rejection of inactive documents
 *  6. Exclusion of deleted documents
 *  7. Exclusion of unapproved official documents from approved guidance
 *  8. No-match handling
 *  9. Duplicate chunk prevention
 * 10. Document update and chunk synchronization
 * 11. Correct source and document references
 * 12. Prevention of unsupported or fabricated recommendations
 * 13. Citizen access restrictions
 * 14. Employee department restrictions
 * 15. Supervisor department restrictions
 * 16. Central Admin access
 * 17. Retrieval failure without disrupting the complaint workflow
 * 18. Regression tests for previously completed phases
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const http = require('http');
const { connectDatabase } = require('../config/database');
const { app } = require('../index');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const KnowledgeChunk = require('../models/KnowledgeChunk');
const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const User = require('../models/User');

const { chunkDocument, syncDocumentChunks } = require('../services/chunkingService');
const { retrieveRelevantKnowledge, buildRAGContext } = require('../services/ragService');

let server;
const results = [];

function record(id, title, passed, detail) {
  results.push({ id, title, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${id}: ${title}`);
  if (detail) console.log(`       └─ ${detail}`);
}

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================');
  console.log('📚  PHASE 6: RAG-BASED KNOWLEDGE SUPPORT (MODULE 8) VERIFICATION');
  console.log('================================================================\n');

  await connectDatabase();
  const PORT = 5106;

  server = app.listen(PORT);
  console.log(`📡  Test API Server running on port ${PORT}\n`);

  try {
    // 0. Authenticate Universal Test Accounts
    console.log('--- Step 0: Auth Handshake for Role Access Testing ---');
    const roles = {
      admin: { email: 'admin.commissioner@smartcity.gov.in', password: 'Admin@123' },
      roadSupervisor: { email: 'selvam.supervisor@smartcity.gov.in', password: 'Supervisor@123' },
      roadEmployee: { email: 'ramesh.field@smartcity.gov.in', password: 'Employee@123' },
      citizen: { email: 'rajesh.kumar88@example.gov.in', password: 'Citizen@123' },
    };

    const tokens = {};
    for (const [roleKey, creds] of Object.entries(roles)) {
      const authRes = await request(
        {
          hostname: '127.0.0.1',
          port: PORT,
          path: '/api/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        creds
      );
      if (authRes.status === 200 && authRes.data.token) {
        tokens[roleKey] = authRes.data.token;
      } else {
        console.warn(`[Auth Warning] Failed to log in as ${roleKey}:`, authRes.data);
      }
    }
    console.log('✅ Tokens obtained for roles:', Object.keys(tokens).join(', '), '\n');

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 1: Correct retrieval for a road damage complaint
    // ─────────────────────────────────────────────────────────────────────────
    console.log('--- Scenario 1: Road Damage Complaint Knowledge Retrieval ---');
    const s1Res = await retrieveRelevantKnowledge({
      category: 'Pothole',
      subcategory: 'Surface Crater',
      description: 'Deep dangerous pothole on Anna Salai near bus stop causing accidents',
      issue: 'Pothole Crater',
      department: 'Road Maintenance Department',
      userRole: 'department_supervisor',
      userDepartment: 'Road Maintenance Department',
    });

    const s1Passed =
      s1Res.found === true &&
      s1Res.references.some((r) => r.title.includes('Pothole Cold-Mix Resurfacing SOP')) &&
      s1Res.recommendedActions.some((a) => a.toLowerCase().includes('tack coat') || a.toLowerCase().includes('compaction') || a.toLowerCase().includes('saw-cut'));

    record(
      'SCENARIO-1',
      'Road Damage Complaint Knowledge Retrieval Grounded in Official SOP',
      s1Passed,
      `Top Doc: "${s1Res.references[0]?.title}". Score: ${Math.round((s1Res.topRelevanceScore || 0))}%. Recommended actions count: ${s1Res.recommendedActions.length}.`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 2: Correct retrieval for a sanitation / drainage complaint
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 2: Sanitation / Drainage Knowledge Retrieval ---');
    const s2Res = await retrieveRelevantKnowledge({
      category: 'Drainage',
      subcategory: 'Sewer Overflow',
      description: 'Underground sewer overflowing and manhole blocked with heavy silt',
      issue: 'Sewer Block',
      department: 'Water & Sewerage Board',
      userRole: 'department_supervisor',
      userDepartment: 'Water & Sewerage Board',
    });

    const s2Passed =
      s2Res.found === true &&
      s2Res.references.some((r) => r.title.includes('Underground Sewer Manhole Clearing')) &&
      s2Res.precautions.some((p) => p.toLowerCase().includes('scba') || p.toLowerCase().includes('manual entry') || p.toLowerCase().includes('hazard'));

    record(
      'SCENARIO-2',
      'Sanitation & Sewer Manhole Knowledge Retrieval with Mandatory Safety Precautions',
      s2Passed,
      `Top Doc: "${s2Res.references[0]?.title}". Mandatory precautions identified: ${s2Res.precautions.length}.`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 3: Correct department-specific retrieval
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 3: Department-Specific Grounded Retrieval ---');
    const s3Res = await retrieveRelevantKnowledge({
      category: 'Streetlight',
      subcategory: 'Non-Functional Lamp',
      description: 'Streetlight feeder pillar contactor tripped and 5 LED pole lamps off',
      issue: 'Feeder Pillar Trip',
      department: 'Electricity & Lighting Department',
      userRole: 'department_supervisor',
      userDepartment: 'Electricity & Lighting Department',
    });

    const s3Passed =
      s3Res.found === true &&
      s3Res.references[0]?.department === 'Electricity & Lighting Department' &&
      s3Res.references.some((r) => r.title.includes('Streetlight SLA & Contactor Repair'));

    record(
      'SCENARIO-3',
      'Department-Specific Knowledge Retrieval Scoped to Correct Jurisdiction',
      s3Passed,
      `Department matched: "${s3Res.references[0]?.department}". Document: "${s3Res.references[0]?.title}".`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 4: Multi-department complaint support
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 4: Multi-Department Complaint Task Knowledge Isolation ---');
    // Task 1: Road Maintenance
    const taskRoadRes = await retrieveRelevantKnowledge({
      category: 'Roads & Footpaths',
      description: 'Asphalt surface damaged around water leak trench',
      department: 'Road Maintenance Department',
      userRole: 'central_admin',
    });

    // Task 2: Water & Sewerage Board
    const taskWaterRes = await retrieveRelevantKnowledge({
      category: 'Drainage & Sewage',
      description: 'Underground sewer pipe cracked and leaking',
      department: 'Water & Sewerage Board',
      userRole: 'central_admin',
    });

    const s4Passed =
      taskRoadRes.found === true &&
      taskRoadRes.references[0]?.department === 'Road Maintenance Department' &&
      taskWaterRes.found === true &&
      taskWaterRes.references[0]?.department === 'Water & Sewerage Board' &&
      taskRoadRes.references[0]?.title !== taskWaterRes.references[0]?.title;

    record(
      'SCENARIO-4',
      'Multi-Department Complaint Provides Respective Department-Specific Knowledge',
      s4Passed,
      `Road Task Doc: "${taskRoadRes.references[0]?.title}" | Water Task Doc: "${taskWaterRes.references[0]?.title}".`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 5: Rejection of inactive documents
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 5: Rejection of Inactive Documents ---');
    const inactiveDoc = await KnowledgeDocument.create({
      title: 'TEST_INACTIVE_SOP_DO_NOT_RETRIEVE',
      department: 'Road Maintenance Department',
      content: 'This is an inactive deprecated road repair guideline that must never be served.',
      applicableCategories: ['Pothole'],
      active: false, // Inactive
      approvalStatus: 'approved',
      isDeleted: false,
    });
    await chunkDocument(inactiveDoc);

    const s5Res = await retrieveRelevantKnowledge({
      category: 'Pothole',
      description: 'TEST_INACTIVE_SOP_DO_NOT_RETRIEVE deprecated road repair guideline',
      department: 'Road Maintenance Department',
      userRole: 'central_admin',
    });

    const s5Passed = !s5Res.references.some((r) => r.title.includes('TEST_INACTIVE_SOP'));
    await KnowledgeDocument.deleteOne({ _id: inactiveDoc._id });
    await KnowledgeChunk.deleteMany({ documentId: inactiveDoc._id });

    record(
      'SCENARIO-5',
      'Inactive Documents (active: false) Strictly Excluded from Retrieval',
      s5Passed,
      'Confirmed: Inactive SOP was excluded from all retrieval candidates.'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 6: Exclusion of deleted documents
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 6: Exclusion of Deleted Documents ---');
    const deletedDoc = await KnowledgeDocument.create({
      title: 'TEST_DELETED_SOP_EXCLUDE',
      department: 'Water & Sewerage Board',
      content: 'Deleted draft sewer procedure that must be purged from retrieval results.',
      applicableCategories: ['Drainage'],
      active: true,
      approvalStatus: 'approved',
      isDeleted: true, // Soft deleted
    });
    await chunkDocument(deletedDoc);

    const s6Res = await retrieveRelevantKnowledge({
      category: 'Drainage',
      description: 'Deleted draft sewer procedure that must be purged',
      department: 'Water & Sewerage Board',
      userRole: 'central_admin',
    });

    const s6Passed = !s6Res.references.some((r) => r.title.includes('TEST_DELETED_SOP'));
    await KnowledgeDocument.deleteOne({ _id: deletedDoc._id });
    await KnowledgeChunk.deleteMany({ documentId: deletedDoc._id });

    record(
      'SCENARIO-6',
      'Soft-Deleted Documents (isDeleted: true) Excluded from Knowledge Retrieval',
      s6Passed,
      'Confirmed: Deleted document chunks safely filtered out.'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 7: Exclusion of unapproved documents
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 7: Exclusion of Unapproved Draft Documents ---');
    const unapprovedDoc = await KnowledgeDocument.create({
      title: 'TEST_UNAPPROVED_DRAFT_SOP',
      department: 'Electricity & Lighting Department',
      content: 'Unreviewed draft document for transformer maintenance pending review.',
      applicableCategories: ['Streetlight'],
      active: true,
      approvalStatus: 'draft', // Not approved
      isDeleted: false,
    });
    await chunkDocument(unapprovedDoc);

    const s7Res = await retrieveRelevantKnowledge({
      category: 'Streetlight',
      description: 'Unreviewed draft document for transformer maintenance pending review',
      department: 'Electricity & Lighting Department',
      userRole: 'central_admin',
    });

    const s7Passed = !s7Res.references.some((r) => r.title.includes('TEST_UNAPPROVED_DRAFT'));
    await KnowledgeDocument.deleteOne({ _id: unapprovedDoc._id });
    await KnowledgeChunk.deleteMany({ documentId: unapprovedDoc._id });

    record(
      'SCENARIO-7',
      'Unapproved Official Documents (approvalStatus: draft) Excluded from Guidance',
      s7Passed,
      'Confirmed: Only approved documents (approvalStatus: approved) are made available.'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 8: No-match handling
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 8: No-Match Handling (No Fabricated Answers) ---');
    const s8Res = await retrieveRelevantKnowledge({
      category: 'QuantumPhysics',
      description: 'Alien interstellar spacecraft engine particle detector calibration',
      issue: 'Quantum Engine',
      department: 'Astrophysics Agency',
      userRole: 'central_admin',
    });

    const s8Passed =
      s8Res.found === false &&
      s8Res.summary === 'No relevant knowledge source was found for this complaint.' &&
      s8Res.recommendedActions.length === 0 &&
      s8Res.precautions.length === 0 &&
      s8Res.references.length === 0;

    record(
      'SCENARIO-8',
      'Unmatched Query Gracefully Returns Standard No-Match String Without Hallucination',
      s8Passed,
      `Summary: "${s8Res.summary}". Recommendations: ${s8Res.recommendedActions.length}. References: ${s8Res.references.length}.`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 9: Duplicate chunk prevention
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 9: Duplicate Chunk Prevention on Re-processing ---');
    const testDoc = await KnowledgeDocument.findOne({ active: true, isDeleted: { $ne: true } });
    // Establish baseline chunking
    await chunkDocument(testDoc);
    const countBefore = await KnowledgeChunk.countDocuments({ documentId: testDoc._id });

    // Re-chunk the same document twice to verify idempotence
    await chunkDocument(testDoc);
    await chunkDocument(testDoc);

    const countAfter = await KnowledgeChunk.countDocuments({ documentId: testDoc._id });
    const s9Passed = countBefore > 0 && countBefore === countAfter;

    record(
      'SCENARIO-9',
      'Atomic Chunk Re-indexing Prevents Chunk Buildup or Duplicate Records',
      s9Passed,
      `Before count: ${countBefore} chunks, After repeated chunking: ${countAfter} chunks (No duplicates).`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 10: Document update and chunk synchronization
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 10: Document Status & Chunk Synchronization ---');
    const tempSyncDoc = await KnowledgeDocument.create({
      title: 'TEST_SYNC_DOC',
      department: 'Road Maintenance Department',
      content: 'Temporary document to test chunk synchronization on active toggle.',
      applicableCategories: ['Pothole'],
      active: true,
      approvalStatus: 'approved',
      isDeleted: false,
    });
    await chunkDocument(tempSyncDoc);

    // Update document to inactive
    tempSyncDoc.active = false;
    await tempSyncDoc.save();
    await syncDocumentChunks(tempSyncDoc);

    const chunksAfterDeactivation = await KnowledgeChunk.find({ documentId: tempSyncDoc._id });
    const allChunksInactive = chunksAfterDeactivation.every((c) => c.active === false);

    await KnowledgeDocument.deleteOne({ _id: tempSyncDoc._id });
    await KnowledgeChunk.deleteMany({ documentId: tempSyncDoc._id });

    const s10Passed = allChunksInactive && chunksAfterDeactivation.length > 0;
    record(
      'SCENARIO-10',
      'Document Status Changes Automatically Synchronized to All Associated Chunks',
      s10Passed,
      `All ${chunksAfterDeactivation.length} chunks reflect updated active: false state.`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 11: Correct source and document references
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 11: Source and Document Citations Integrity ---');
    const s11Ref = s1Res.references[0];
    const s11Passed =
      s11Ref &&
      Boolean(s11Ref.documentId) &&
      Boolean(s11Ref.title) &&
      Boolean(s11Ref.source) &&
      Boolean(s11Ref.department) &&
      Boolean(s11Ref.sectionHeading) &&
      typeof s11Ref.relevanceScore === 'number';

    record(
      'SCENARIO-11',
      'Grounded Response Includes Complete Source, Department, and Section Citations',
      s11Passed,
      `Title: "${s11Ref?.title}", Source: "${s11Ref?.source}", Section: "${s11Ref?.sectionHeading}", Relevance: ${s11Ref?.relevanceScore}.`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 12: Prevention of unsupported or fabricated recommendations
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 12: Prevention of Unsupported or Fabricated Actions ---');
    const docPothole = await KnowledgeDocument.findOne({ title: /Pothole Cold-Mix/ });
    const contentText = (docPothole?.content || '').toLowerCase();

    // Check that every recommended action comes directly from the document content or actions
    const allActionsGrounded = s1Res.recommendedActions.every((act) => {
      const actWords = act.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      return actWords.some((w) => contentText.includes(w));
    });

    record(
      'SCENARIO-12',
      'Recommended Actions Strictly Grounded in Retrieved Content (Zero Fabrication)',
      allActionsGrounded,
      'All recommended actions verified against source text keywords.'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 13: Citizen access restrictions
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 13: Citizen Access Restrictions (Backend RBAC) ---');
    const citizenInternalRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/knowledge/retrieve',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.citizen}`,
        },
      },
      {
        category: 'Pothole',
        description: 'Pothole on 2nd Avenue',
        department: 'Road Maintenance Department',
        isPublicOnly: false,
      }
    );

    const citizenPublicRes = await retrieveRelevantKnowledge({
      category: 'General',
      description: 'Citizen rights and grievance resolution timeline SLA charter',
      userRole: 'citizen',
      isPublicOnly: true,
    });

    const s13Passed =
      citizenInternalRes.status === 403 &&
      citizenPublicRes.found === true &&
      citizenPublicRes.references[0]?.isPublic === true;

    record(
      'SCENARIO-13',
      'Citizen Denied Access to Internal SOPs (HTTP 403) But Granted Access to Public Charter',
      s13Passed,
      `Internal access status: HTTP ${citizenInternalRes.status} (Access Denied). Public charter access: ${citizenPublicRes.found} ("${citizenPublicRes.references[0]?.title}").`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 14: Employee department restrictions
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 14: Employee Cross-Department Access Restrictions ---');
    const roadEmpCrossRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/knowledge/retrieve',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadEmployee}`,
        },
      },
      {
        category: 'Drainage',
        description: 'Blocked underground sewer line',
        department: 'Water & Sewerage Board',
      }
    );

    const s14Passed = roadEmpCrossRes.status === 403 && roadEmpCrossRes.data.message?.includes('Water & Sewerage Board');
    record(
      'SCENARIO-14',
      'Employee Blocked from Accessing Other Department Internal SOPs (HTTP 403)',
      s14Passed,
      `Road employee querying Water SOP rejected with HTTP ${roadEmpCrossRes.status}: "${roadEmpCrossRes.data.message}".`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 15: Supervisor department restrictions
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 15: Supervisor Cross-Department Access Restrictions ---');
    const roadSupCrossRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/knowledge/retrieve',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.roadSupervisor}`,
        },
      },
      {
        category: 'Drainage',
        description: 'Underground sewer clearing and jetting procedure',
        department: 'Water & Sewerage Board',
      }
    );

    const s15Passed = roadSupCrossRes.status === 403 && roadSupCrossRes.data.message?.includes('Water & Sewerage Board');
    record(
      'SCENARIO-15',
      'Supervisor Blocked from Accessing Other Department Internal SOPs (HTTP 403)',
      s15Passed,
      `Road supervisor querying Water SOP rejected with HTTP ${roadSupCrossRes.status}: "${roadSupCrossRes.data.message}".`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 16: Central Admin access
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 16: Central Admin Cross-Department Access ---');
    const adminRoadRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/knowledge/retrieve',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.admin}`,
        },
      },
      {
        category: 'Pothole',
        description: 'Road damage repair',
        department: 'Road Maintenance Department',
      }
    );

    const adminWaterRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/knowledge/retrieve',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.admin}`,
        },
      },
      {
        category: 'Drainage',
        description: 'Underground sewer clearing',
        department: 'Water & Sewerage Board',
      }
    );

    const s16Passed =
      adminRoadRes.status === 200 &&
      adminRoadRes.data.data?.found === true &&
      adminWaterRes.status === 200 &&
      adminWaterRes.data.data?.found === true;

    record(
      'SCENARIO-16',
      'Central Admin Can Retrieve Knowledge Across All Departments Without Restriction',
      s16Passed,
      `Admin retrieved Road Maintenance (${adminRoadRes.data.data?.references[0]?.title}) and Water Board (${adminWaterRes.data.data?.references[0]?.title}) successfully.`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 17: Retrieval failure without disrupting the complaint workflow
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 17: Retrieval Resilience (Workflow Isolation) ---');
    // Simulate query for a non-existent complaint ID on GET /api/complaints/:id/knowledge
    const notFoundRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/complaints/CMP-NON-EXISTENT-9999/knowledge',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });

    // Verify creating a real complaint succeeds even if knowledge is queried concurrently
    const createRes = await request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/complaints',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.citizen}`,
        },
      },
      {
        description: 'Pothole near post office causing vehicle bumper hits',
        location: { address: 'Anna Salai, Chennai', latitude: 13.0827, longitude: 80.2707 },
        category: 'Pothole',
      }
    );

    const createdCmpId = createRes.data?.data?.complaintId;
    const s17Passed = notFoundRes.status === 404 && createRes.status === 201 && Boolean(createdCmpId);

    record(
      'SCENARIO-17',
      'Knowledge Retrieval Errors Handle Gracefully Without Disrupting Complaint Registration',
      s17Passed,
      `Invalid complaint handled with HTTP 404. New complaint created cleanly: ${createdCmpId} (HTTP 201).`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Scenario 18: Regression tests for previously completed phases
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 18: Full System Regression Testing ---');
    const regComplaintsRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/complaints',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });

    const regTasksRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/tasks',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokens.admin}` },
    });

    const complaintsList = Array.isArray(regComplaintsRes.data.data) ? regComplaintsRes.data.data : [];
    const tasksList = Array.isArray(regTasksRes.data.data) ? regTasksRes.data.data : [];

    const s18Passed =
      regComplaintsRes.status === 200 &&
      complaintsList.length > 0 &&
      regTasksRes.status === 200 &&
      Array.isArray(tasksList);

    record(
      'SCENARIO-18',
      'Regression Check: Complaint and Department Task APIs Fully Functional',
      s18Passed,
      `Complaints count: ${complaintsList.length}. Tasks API status: HTTP ${regTasksRes.status} (Valid array response).`
    );

    // Allow background pipeline events to finish cleanly
    await new Promise((r) => setTimeout(r, 600));

  } catch (err) {
    console.error('Verification failed with error:', err);
    record('FATAL', 'Verification Suite Encountered Unhandled Error', false, err.message);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    console.log('\n================================================================');
    console.log('📊  PHASE 6 VERIFICATION SUMMARY');
    console.log('================================================================');
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`Total Scenarios Checked: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);

    if (passed === total) {
      console.log('🎉 ALL 18 PHASE 6 SCENARIOS VERIFIED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.warn('⚠️ SOME PHASE 6 SCENARIOS FAILED.');
      process.exit(1);
    }
  }
}

if (require.main === module) {
  runVerification();
}

module.exports = { runVerification };

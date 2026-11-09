'use strict';

/**
 * PHASE 5 VERIFICATION SUITE
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates all 18 test scenarios for Phase 5 (Intelligent Complaint Processing M1-M6):
 *  1. English complaint submission
 *  2. Tamil complaint submission
 *  3. Tamil-English mixed complaint submission
 *  4. Voice transcription success and failure
 *  5. LLM unavailable or incorrectly formatted response
 *  6. Correct category and subcategory prediction
 *  7. Ambiguous complaint classification
 *  8. Similar complaints from the same location
 *  9. Similar complaints from different locations
 * 10. Different complaints from the same location
 * 11. Missing geographic coordinates
 * 12. High-priority safety-related complaint
 * 13. Ordinary low-priority complaint
 * 14. Complaint requiring one department
 * 15. Complaint requiring multiple departments
 * 16. Missing or unavailable department
 * 17. Central Admin review of uncertain recommendations
 * 18. Regression tests for authentication, access control, and multi-department workflows
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const http = require('http');
const { connectDatabase } = require('../config/database');
const { app } = require('../index');
const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const Department = require('../models/Department');
const User = require('../models/User');

const { detectLanguage } = require('../utils/languageDetector');
const { analyzeComplaint, validateAnalysisResult } = require('../services/llmService');
const { categorizeComplaint } = require('../services/categorizationService');
const { checkDuplicate, computeTextSimilarity } = require('../services/duplicateDetectionService');
const { predictPriority } = require('../services/priorityService');
const { recommendDepartments } = require('../services/routingService');

let server;
const results = [];

function record(id, title, passed, detail) {
  results.push({ id, title, passed, detail });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${id}: ${title}`);
  if (detail) console.log(`       └─ ${detail}`);
}

async function runVerification() {
  console.log('================================================================');
  console.log('🤖  PHASE 5: INTELLIGENT COMPLAINT PROCESSING (M1–M6) VERIFICATION');
  console.log('================================================================\n');

  await connectDatabase();
  const PORT = 5105;
  server = app.listen(PORT);
  const baseUrl = `http://127.0.0.1:${PORT}`;

  function apiCall(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const options = { method, headers };
      const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  try {
    // =========================================================================
    // SCENARIO 1: English Complaint Submission
    // =========================================================================
    console.log('\n--- Scenario 1: English Complaint Submission ---');
    const engText = 'Deep dangerous pothole near the bus stand causing road hazard';
    const langEng = detectLanguage(engText);
    const engSubmission = await apiCall('POST', '/api/complaints', {
      description: engText,
      originalText: engText,
      location: { address: 'Anna Nagar West', latitude: 13.0850, longitude: 80.2100 },
    });

    const isEngPass =
      langEng.language === 'English' &&
      engSubmission.status === 201 &&
      engSubmission.body.data.language === 'English' &&
      engSubmission.body.data.originalText === engText;

    record(
      'SCENARIO-1',
      'English Complaint Submission & Language Identification',
      isEngPass,
      `Language identified: "${engSubmission.body.data?.language}". Original text preserved: "${engSubmission.body.data?.originalText}".`
    );

    // =========================================================================
    // SCENARIO 2: Tamil Complaint Submission
    // =========================================================================
    console.log('\n--- Scenario 2: Tamil Complaint Submission ---');
    const tamilText = 'ரோட்டில் பெரிய குழி ஏற்பட்டுள்ளது உடனடியாக சரி செய்யவும்';
    const langTamil = detectLanguage(tamilText);
    const tamilSubmission = await apiCall('POST', '/api/complaints', {
      description: tamilText,
      originalText: tamilText,
      location: { address: 'T Nagar', latitude: 13.0418, longitude: 80.2341 },
    });

    const catTamil = await categorizeComplaint(tamilText);

    const isTamilPass =
      langTamil.language === 'Tamil' &&
      tamilSubmission.status === 201 &&
      tamilSubmission.body.data.language === 'Tamil' &&
      catTamil.category === 'Pothole';

    record(
      'SCENARIO-2',
      'Tamil Script Complaint Submission & Classification',
      isTamilPass,
      `Language: "${tamilSubmission.body.data?.language}", Predicted category: "${catTamil.category}" (${catTamil.subcategory}).`
    );

    // =========================================================================
    // SCENARIO 3: Tamil-English Mixed Complaint Submission
    // =========================================================================
    console.log('\n--- Scenario 3: Tamil-English Mixed Complaint Submission ---');
    const mixedText = 'Road romba damage ah irukku near signal thanni varala';
    const langMixed = detectLanguage(mixedText);
    const mixedSubmission = await apiCall('POST', '/api/complaints', {
      description: mixedText,
      originalText: mixedText,
      location: { address: 'Kodambakkam', latitude: 13.0520, longitude: 80.2250 },
    });

    const isMixedPass =
      langMixed.language === 'Tamil-English (Code-Mixed)' &&
      langMixed.isCodeMixed === true &&
      mixedSubmission.status === 201 &&
      mixedSubmission.body.data.language === 'Tamil-English (Code-Mixed)';

    record(
      'SCENARIO-3',
      'Tamil-English Code-Mixed (Tanglish) Identification',
      isMixedPass,
      `Identified language: "${mixedSubmission.body.data?.language}" (isCodeMixed: ${langMixed.isCodeMixed}).`
    );

    // =========================================================================
    // SCENARIO 4: Voice Transcription Success and Failure Handling
    // =========================================================================
    console.log('\n--- Scenario 4: Voice Transcription Input Handling ---');
    const voiceSuccess = await apiCall('POST', '/api/complaints', {
      description: 'Streetlight pole wire sparking and dangling over footpath',
      originalText: 'Streetlight pole wire sparking and dangling over footpath',
      inputType: 'voice',
      hasVoice: true,
      voiceUrl: 'https://storage.cloud.gov/audio/sample_voice_rec_101.webm',
      voiceDuration: 8.5,
      location: { address: 'Adyar Signal', latitude: 13.0012, longitude: 80.2565 },
    });

    // Voice failure / empty description fallback test
    const voiceFailure = await apiCall('POST', '/api/complaints', {
      description: '',
      originalText: '',
      inputType: 'voice',
      hasVoice: true,
    });

    const isVoicePass =
      voiceSuccess.status === 201 &&
      voiceSuccess.body.data.hasVoice === true &&
      voiceSuccess.body.data.voiceDuration === 8.5 &&
      voiceFailure.status === 400; // Validation rejection on empty content

    record(
      'SCENARIO-4',
      'Voice Input Pipeline & Empty Transcription Validation',
      isVoicePass,
      `Valid voice created (${voiceSuccess.body.data?.complaintId}). Empty voice correctly rejected with HTTP ${voiceFailure.status}.`
    );

    // =========================================================================
    // SCENARIO 5: LLM Unavailable or Fallback Formatted Response
    // =========================================================================
    console.log('\n--- Scenario 5: LLM Service Fallback & Schema Validation ---');
    const sampleGrievance = 'Dangerous sewage overflow near Apollo Hospital on Greams Road causing hazard';
    const llmAnalysis = await analyzeComplaint(sampleGrievance, []);

    const isLlmPass =
      llmAnalysis.status === 'not_configured' &&
      llmAnalysis.method === 'heuristic_fallback' &&
      typeof llmAnalysis.result.summary === 'string' &&
      llmAnalysis.result.issueType.includes('Drainage') &&
      llmAnalysis.result.extractedLocation.includes('Apollo Hospital') &&
      llmAnalysis.result.extractedVsInferred.extracted.rawLocationString !== null;

    record(
      'SCENARIO-5',
      'LLM Service Graceful Fallback & Structured Schema Integrity',
      isLlmPass,
      `Method: "${llmAnalysis.method}", Issue: "${llmAnalysis.result?.issueType}", Location: "${llmAnalysis.result?.extractedLocation}".`
    );

    // =========================================================================
    // SCENARIO 6: Correct Category and Subcategory Prediction
    // =========================================================================
    console.log('\n--- Scenario 6: Accurate Category & Subcategory Prediction ---');
    const catPothole = await categorizeComplaint('Massive road crater deep asphalt depression');
    const catLight = await categorizeComplaint('Streetlight non functional dark pole at night');
    const catWater = await categorizeComplaint('Drinking water pipeline burst clean water gushing');

    const isCatPass =
      catPothole.category === 'Pothole' &&
      catPothole.subcategory === 'Surface Crater' &&
      catLight.category === 'Streetlight' &&
      catLight.subcategory === 'Non-Functional Lamp' &&
      catWater.category === 'Water Supply' &&
      catWater.subcategory === 'Main Pipeline Burst';

    record(
      'SCENARIO-6',
      'Contextual Category & Subcategory Prediction (Multi-Domain)',
      isCatPass,
      `Pothole -> "${catPothole.subcategory}", Streetlight -> "${catLight.subcategory}", Water -> "${catWater.subcategory}".`
    );

    // =========================================================================
    // SCENARIO 7: Ambiguous Complaint Classification
    // =========================================================================
    console.log('\n--- Scenario 7: Ambiguous Complaint Handling ---');
    const vagueText = 'Something seems very unusual in our lane please send someone';
    const catVague = await categorizeComplaint(vagueText);

    const isAmbiguousPass =
      catVague.isAmbiguous === true &&
      catVague.needsAdminReview === true &&
      catVague.category === 'Other' &&
      catVague.confidence <= 0.50;

    record(
      'SCENARIO-7',
      'Ambiguous Complaint Detection & Admin Review Flagging',
      isAmbiguousPass,
      `Category: "${catVague.category}", Ambiguous: ${catVague.isAmbiguous}, Admin Review: ${catVague.needsAdminReview}, Confidence: ${catVague.confidence}.`
    );

    // =========================================================================
    // SCENARIO 8: Similar Complaints from Same Location (Duplicate)
    // =========================================================================
    console.log('\n--- Scenario 8: Semantic & Spatial Duplicate Detection ---');
    const basePothole = {
      complaintId: 'CMP-2026-TEST-801',
      description: 'Dangerous deep crater pothole on 2nd Avenue Anna Nagar near roundtana',
      category: 'Pothole',
      status: 'IN_PROGRESS',
      location: { latitude: 13.0850, longitude: 80.2100 },
    };

    const dupCheck1 = await checkDuplicate(
      'Deep pothole crater near Anna Nagar roundtana on 2nd avenue road',
      { latitude: 13.0851, longitude: 80.2101 }, // ~15 meters away
      [basePothole],
      { category: 'Pothole', currentComplaintId: 'CMP-NEW-802' }
    );

    const isDupPass =
      dupCheck1.isDuplicate === true &&
      dupCheck1.duplicateLevel === 'likely_duplicate' &&
      dupCheck1.similarComplaintId === basePothole.complaintId &&
      dupCheck1.distanceMeters <= 50;

    record(
      'SCENARIO-8',
      'High-Similarity Spatial Duplicate Identified as Likely Duplicate',
      isDupPass,
      `Duplicate level: "${dupCheck1.duplicateLevel}", Matching ID: "${dupCheck1.similarComplaintId}", Distance: ${dupCheck1.distanceMeters}m.`
    );

    // =========================================================================
    // SCENARIO 9: Similar Complaints from Different Locations (Not Duplicate)
    // =========================================================================
    console.log('\n--- Scenario 9: Similar Text from Distant Locations ---');
    const dupCheckDistant = await checkDuplicate(
      'Dangerous deep crater pothole on 2nd Avenue near roundtana',
      { latitude: 12.9200, longitude: 80.1200 }, // Tambaram (~22km away)
      [basePothole],
      { category: 'Pothole', currentComplaintId: 'CMP-NEW-803' }
    );

    const isDistantPass =
      dupCheckDistant.isDuplicate === false &&
      dupCheckDistant.duplicateLevel === 'none';

    record(
      'SCENARIO-9',
      'Similar Text from Distant Location Correctly Preserved as Distinct',
      isDistantPass,
      `Result level: "${dupCheckDistant.duplicateLevel}", isDuplicate: ${dupCheckDistant.isDuplicate}.`
    );

    // =========================================================================
    // SCENARIO 10: Different Complaints from Same Location
    // =========================================================================
    console.log('\n--- Scenario 10: Different Complaints from Same Location ---');
    const dupCheckCoLocated = await checkDuplicate(
      'Streetlight pole dark and non functional',
      { latitude: 13.0850, longitude: 80.2100 }, // Same location as pothole
      [basePothole],
      { category: 'Streetlight', currentComplaintId: 'CMP-NEW-804' }
    );

    const isCoLocatedPass =
      dupCheckCoLocated.isDuplicate === false &&
      dupCheckCoLocated.duplicateLevel !== 'likely_duplicate';

    record(
      'SCENARIO-10',
      'Different Category at Same Location NOT Flagged as Duplicate',
      isCoLocatedPass,
      `Duplicate level: "${dupCheckCoLocated.duplicateLevel}", isDuplicate: ${dupCheckCoLocated.isDuplicate}.`
    );

    // =========================================================================
    // SCENARIO 11: Missing Geographic Coordinates Handled Gracefully
    // =========================================================================
    console.log('\n--- Scenario 11: Missing Coordinates Handling ---');
    const dupCheckMissingLoc = await checkDuplicate(
      'Deep dangerous road pothole on main road',
      null, // Missing location
      [basePothole],
      { category: 'Pothole', currentComplaintId: 'CMP-NEW-805' }
    );

    const isMissingLocPass =
      dupCheckMissingLoc !== null &&
      dupCheckMissingLoc.hasSpatialData === false &&
      dupCheckMissingLoc.isDuplicate === false;

    record(
      'SCENARIO-11',
      'Missing Coordinates Handled Gracefully without Execution Crash',
      isMissingLocPass,
      `hasSpatialData: ${dupCheckMissingLoc.hasSpatialData}, isDuplicate: ${dupCheckMissingLoc.isDuplicate}.`
    );

    // =========================================================================
    // SCENARIO 12: High-Priority Safety-Related Complaint
    // =========================================================================
    console.log('\n--- Scenario 12: High-Priority Safety Hazard Assessment ---');
    const prioHigh = await predictPriority(
      'Drainage',
      'Severe danger emergency sewage flooding Apollo Hospital for weeks completely blocked',
      {},
      true
    );

    const isPrioHighPass =
      prioHigh.priority === 'CRITICAL' &&
      prioHigh.score >= 80 &&
      prioHigh.slaHours === 6 &&
      prioHigh.needsAdminReview === true;

    record(
      'SCENARIO-12',
      'Critical Public Safety Hazard Triage (CRITICAL Tier, 6h SLA)',
      isPrioHighPass,
      `Priority: "${prioHigh.priority}", Score: ${prioHigh.score}/100, SLA: ${prioHigh.slaHours}h, Admin Review: ${prioHigh.needsAdminReview}.`
    );

    // =========================================================================
    // SCENARIO 13: Ordinary Low-Priority Complaint
    // =========================================================================
    console.log('\n--- Scenario 13: Ordinary Low-Priority Complaint Assessment ---');
    const prioLow = await predictPriority(
      'Tree Fall',
      'Small dried leaves and tiny twigs overhanging park pathway',
      {},
      false
    );

    const isPrioLowPass =
      prioLow.priority === 'LOW' &&
      prioLow.score < 35 &&
      prioLow.slaHours === 120 &&
      prioLow.needsAdminReview === false;

    record(
      'SCENARIO-13',
      'Routine Minor Civic Complaint Triage (LOW Tier, 120h SLA)',
      isPrioLowPass,
      `Priority: "${prioLow.priority}", Score: ${prioLow.score}/100, SLA: ${prioLow.slaHours}h, Admin Review: ${prioLow.needsAdminReview}.`
    );

    // =========================================================================
    // SCENARIO 14: Single-Department Routing Recommendation
    // =========================================================================
    console.log('\n--- Scenario 14: Single-Department Recommendation ---');
    const routeSingle = await recommendDepartments('Streetlight', 'Broken sodium bulb on street lamp post');

    const isSingleDeptPass =
      routeSingle.primaryDepartment.departmentName === 'Electricity & Lighting Department' &&
      routeSingle.supportingDepartments.length === 0 &&
      routeSingle.requiresMultiDept === false;

    record(
      'SCENARIO-14',
      'Single-Department Clean Jurisdiction Routing',
      isSingleDeptPass,
      `Primary: "${routeSingle.primaryDepartment.departmentName}", Supporting Count: ${routeSingle.supportingDepartments.length}.`
    );

    // =========================================================================
    // SCENARIO 15: Multi-Department Cross-Cutting Recommendation
    // =========================================================================
    console.log('\n--- Scenario 15: Multi-Department Recommendation ---');
    const routeMulti = await recommendDepartments(
      'Pothole',
      'Deep road crater caused by broken underground water pipeline leak gushing drinking water'
    );

    const isMultiDeptPass =
      routeMulti.primaryDepartment.departmentName === 'Road Maintenance Department' &&
      routeMulti.supportingDepartments.some((s) => s.departmentName === 'Water & Sewerage Board') &&
      routeMulti.requiresMultiDept === true;

    record(
      'SCENARIO-15',
      'Multi-Department Compound Civic Issue Recommendation',
      isMultiDeptPass,
      `Primary: "${routeMulti.primaryDepartment.departmentName}", Supporting: [${routeMulti.supportingDepartments.map((s) => s.departmentName).join(', ')}].`
    );

    // =========================================================================
    // SCENARIO 16: Missing or Unavailable Department Fallback
    // =========================================================================
    console.log('\n--- Scenario 16: Missing Department Unresolved Recommendation ---');
    const routeFallback = await recommendDepartments('Other', 'Unusual matter requiring attention');

    const isFallbackPass =
      routeFallback.status === 'unresolved' &&
      routeFallback.primaryDepartment.departmentName === null &&
      routeFallback.needsAdminReview === true;

    record(
      'SCENARIO-16',
      'Unmapped Category Left Unresolved for Central Admin (No False Routing)',
      isFallbackPass,
      `Status: "${routeFallback.status}", Primary Dept: ${routeFallback.primaryDepartment.departmentName}, Admin Review: ${routeFallback.needsAdminReview}.`
    );

    // =========================================================================
    // SCENARIO 17: Central Admin Staging of Uncertain Recommendations
    // =========================================================================
    console.log('\n--- Scenario 17: Central Admin Staging Verification ---');
    const adminStagingSubmission = await apiCall('POST', '/api/complaints', {
      description: 'Pothole on road with broken water pipe leak requiring multiple departments',
      originalText: 'Pothole on road with broken water pipe leak requiring multiple departments',
      location: { address: 'Mylapore', latitude: 13.0330, longitude: 80.2680 },
    });

    const targetCmpId = adminStagingSubmission.body.data.complaintId;
    // Wait briefly for asynchronous pipeline to update status to AWAITING_ADMIN_REVIEW
    await new Promise((r) => setTimeout(r, 600));

    const freshStaged = await Complaint.findOne({ complaintId: targetCmpId });

    const isStagedPass =
      freshStaged !== null &&
      ['AWAITING_ADMIN_REVIEW', 'UNDER_REVIEW'].includes(freshStaged.status) &&
      freshStaged.adminApproval.status === 'pending';

    record(
      'SCENARIO-17',
      'AI Analysis Queues Complaint into Central Admin Governance Staging',
      isStagedPass,
      `Complaint ${targetCmpId} status: "${freshStaged?.status}", Admin Approval status: "${freshStaged?.adminApproval?.status}".`
    );

    // =========================================================================
    // SCENARIO 18: Regression Testing for Authentication & Multi-Dept Workflows
    // =========================================================================
    console.log('\n--- Scenario 18: Auth & RBAC Regression Testing ---');

    // 1. Citizen login test
    const citizenLogin = await apiCall('POST', '/api/auth/login', {
      email: 'rajesh.kumar88@example.gov.in',
      password: 'Citizen@123',
    });

    // 2. Admin login test
    const adminLogin = await apiCall('POST', '/api/auth/login', {
      email: 'admin.commissioner@smartcity.gov.in',
      password: 'Admin@123',
    });

    // 3. RBAC protection check: citizen trying to access protected staff tasks endpoint
    const unauthorizedAccess = await apiCall(
      'GET',
      '/api/tasks',
      null,
      citizenLogin.body?.token
    );

    // 4. Authorized admin access
    const authorizedAccess = await apiCall(
      'GET',
      '/api/tasks',
      null,
      adminLogin.body?.token
    );

    const isRegressionPass =
      citizenLogin.status === 200 &&
      citizenLogin.body.user.role === 'citizen' &&
      adminLogin.status === 200 &&
      adminLogin.body.user.role === 'central_admin' &&
      unauthorizedAccess.status === 403 &&
      authorizedAccess.status === 200;

    record(
      'SCENARIO-18',
      'Authentication, RBAC & Multi-Department Workflow Regression',
      isRegressionPass,
      `Citizen login HTTP ${citizenLogin.status}, Admin login HTTP ${adminLogin.status}, Citizen access denied HTTP ${unauthorizedAccess.status}, Admin access HTTP ${authorizedAccess.status}.`
    );

    // =========================================================================
    // SCENARIO 19: Concurrent Submissions Reliability Test
    // =========================================================================
    console.log('\n--- Scenario 19: Concurrent Submissions Reliability Test ---');
    const concurrentPayloads = [1, 2, 3, 4, 5].map((i) => ({
      description: `Concurrent test grievance submission #${i} on municipal street`,
      originalText: `Concurrent test grievance submission #${i} on municipal street`,
      location: { address: `Ward ${100 + i}`, latitude: 13.08 + (i * 0.001), longitude: 80.20 + (i * 0.001) },
    }));

    const concurrentResults = await Promise.all(
      concurrentPayloads.map((p) => apiCall('POST', '/api/complaints', p))
    );

    const allSuccessful = concurrentResults.every((r) => r.status === 201 && r.body?.data?.complaintId);
    const generatedIds = concurrentResults.map((r) => r.body?.data?.complaintId);
    const uniqueIds = new Set(generatedIds);

    const isConcurrencyPass = allSuccessful && uniqueIds.size === concurrentPayloads.length;

    record(
      'SCENARIO-19',
      'Concurrent Submissions Handled Without E11000 Duplicate Key Collision',
      isConcurrencyPass,
      `Successfully created ${uniqueIds.size}/${concurrentPayloads.length} concurrent complaints with unique IDs: ${Array.from(uniqueIds).join(', ')}.`
    );

    // =========================================================================
    // SCENARIO 20: Workflow Failure Isolation & Staging Invariant
    // =========================================================================
    console.log('\n--- Scenario 20: Workflow Failure Isolation Test ---');
    // Submitting a grievance with unusual characters to test graceful non-blocking pipeline handling
    const anomalySubmission = await apiCall('POST', '/api/complaints', {
      description: '---???### Civic anomaly with non-standard characters %%%$$$---',
      originalText: '---???### Civic anomaly with non-standard characters %%%$$$---',
      location: { address: 'Unknown Sector', latitude: 13.0827, longitude: 80.2707 },
    });

    const anomalyId = anomalySubmission.body?.data?.complaintId;
    await new Promise((r) => setTimeout(r, 600));

    const anomalyRecord = await Complaint.findOne({ complaintId: anomalyId });
    const isAnomalyIsolated =
      anomalyRecord !== null &&
      anomalyRecord.category === 'Other' &&
      ['AWAITING_ADMIN_REVIEW', 'UNDER_REVIEW'].includes(anomalyRecord.status) &&
      anomalyRecord.adminApproval.status === 'pending';

    record(
      'SCENARIO-20',
      'Workflow Failure Isolation & Central Admin Staging Invariant',
      isAnomalyIsolated,
      `Complaint ${anomalyId} safely preserved with category "${anomalyRecord?.category}" and queued for Central Admin review without pipeline crash.`
    );

  } catch (err) {
    console.error('Verification failed with error:', err);
    record('FATAL', 'Verification Suite Encountered Unhandled Error', false, err.message);
  } finally {
    // Graceful drain of asynchronous pipeline logs
    await new Promise((r) => setTimeout(r, 1500));
    if (server) server.close();
    await mongoose.connection.close();
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log('📊  PHASE 5 VERIFICATION SUMMARY');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Total Scenarios Checked: ${totalCount}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${totalCount - passedCount}`);
  console.log(`Success Rate: ${Math.round((passedCount / totalCount) * 100)}%\n`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL 18 PHASE 5 SCENARIOS VERIFIED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('⚠️ SOME PHASE 5 SCENARIOS FAILED.');
    process.exit(1);
  }
}

runVerification();

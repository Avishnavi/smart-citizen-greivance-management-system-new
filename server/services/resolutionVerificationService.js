'use strict';

/**
 * Evidence-Based Resolution Verification Service (Module 12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-dimensional evidence-based assessment of submitted grievance resolutions.
 *
 * Evaluates 6 key factors:
 *   1. Resolution Description Completeness (detail, action performed, outcome)
 *   2. Complaint & Task Relevance (category, context, department alignment)
 *   3. Evidence Availability & Validity (attachments, URI validity, before/after)
 *   4. Task-Specific Checklist Requirements (category completion checklists)
 *   5. Knowledge SOP Alignment (M8 Grounded Standard Operating Procedures)
 *   6. Consistency & Contradiction Detection (inconsistencies, non-performance flags)
 *
 * Research Transparency Note:
 *   Assessment produces an explainable, structured scoring rubric (0-100) with
 *   factor breakdowns. It does NOT claim independent physical sight or computer
 *   vision completion without dedicated model evaluation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const KnowledgeDocument = require('../models/KnowledgeDocument');

// Standardized minimum lengths
const MIN_RESOLUTION_NOTES_LENGTH = 30;
const COMPREHENSIVE_NOTES_LENGTH = 80;

/**
 * Standardized Category Completion Checklists
 * Reflecting real-world municipal engineering protocols.
 */
const CATEGORY_CHECKLISTS = {
  Pothole: [
    { id: 'boundary_clearing', label: 'Excavation and squaring of damaged pothole edges', keywords: ['excavat', 'clean loose', 'squar', 'cut edge', 'saw-cut', 'trench'] },
    { id: 'tack_coat', label: 'Application of bituminous tack coat / emulsion primer', keywords: ['tack', 'emulsion', 'coat', 'primer', 'bitumen'] },
    { id: 'asphalt_filling', label: 'Hot/cold bituminous concrete or aggregate filling', keywords: ['asphalt', 'aggregate', 'bituminous mix', 'filling', 'patch mix'] },
    { id: 'mechanical_compaction', label: 'Vibratory roller or mechanical plate compaction', keywords: ['roller', 'compact', 'tamper', 'vibro'] },
    { id: 'surface_level_test', label: 'Evenness verification flush with existing road grade', keywords: ['flush', 'grade even', 'smooth finish', 'resurfac', 'camber'] },
  ],
  'Water Supply': [
    { id: 'pressure_isolation', label: 'Distribution main pressure isolation and valve shutoff', keywords: ['valv', 'isolat', 'shut', 'turn off', 'pressure'] },
    { id: 'pipe_replacement', label: 'Excavation and defective pipe section excision/replacement', keywords: ['pipe', 'coupl', 'replac', 'excision', 'weld', 'fit', 'joint'] },
    { id: 'joint_sealing', label: 'Pressure-tight mechanical coupling or joint sealing', keywords: ['seal', 'coupl', 'tight', 'gasket', 'clamp'] },
    { id: 'hydrostatic_test', label: 'Hydrostatic pressure and leak testing', keywords: ['pressure test', 'leak test', 'hydrostat', 'tested', 'leakage'] },
    { id: 'flow_restoration', label: 'Chlorination flush and normal water supply restoration', keywords: ['flow', 'restor', 'suppl', 'flush', 'chlorin', 'normal'] },
  ],
  Drainage: [
    { id: 'safety_ventilation', label: 'Sewer manhole opening and gas safety venting', keywords: ['vent', 'gas', 'open', 'manhole', 'safet', 'chamber'] },
    { id: 'desilting_obstruction', label: 'Manual/mechanical desilting and solid blockage extraction', keywords: ['desilt', 'clear', 'extract', 'debris', 'silt', 'block', 'sludge'] },
    { id: 'jetting_flush', label: 'High-pressure water jetting and pipeline scouring', keywords: ['jetting', 'high-pressure', 'flush', 'scour', 'wash'] },
    { id: 'cover_seating', label: 'Heavy-duty manhole frame and cover replacement/seating', keywords: ['cover', 'frame', 'seat', 'slab', 'grate'] },
    { id: 'gravity_flow_check', label: 'Free-gravity sewage/stormwater flow confirmation', keywords: ['flow', 'free flow', 'drain', 'gravit', 'smooth'] },
  ],
  Streetlight: [
    { id: 'circuit_isolation', label: 'Circuit de-energization and electrical lockout/tagout', keywords: ['de-energiz', 'circuit', 'power off', 'isolat', 'lockout', 'switch'] },
    { id: 'luminaire_replacement', label: 'Defective lamp, LED driver, or ignitor replacement', keywords: ['lamp', 'led', 'driver', 'bulb', 'fixture', 'replac', 'ignitor'] },
    { id: 'wiring_continuity', label: 'Grounding, cable junction, and continuity check', keywords: ['wire', 'ground', 'cable', 'junction', 'continu', 'volt'] },
    { id: 'contactor_timer_test', label: 'Feeder pillar contactor or astronomical timer test', keywords: ['contactor', 'timer', 'feeder', 'switch', 'pillar'] },
    { id: 'illuminance_verification', label: 'Nighttime operational illuminance / lux test', keywords: ['illumin', 'light on', 'lux', 'operat', 'glow', 'work'] },
  ],
  Garbage: [
    { id: 'waste_removal', label: 'Solid waste mechanical clearance and truck loading', keywords: ['clear', 'load', 'collect', 'truck', 'remov', 'tipper'] },
    { id: 'source_segregation', label: 'Segregation of wet, dry, and domestic hazardous waste', keywords: ['segregat', 'wet', 'dry', 'sort', 'separat'] },
    { id: 'site_disinfection', label: 'Bleaching powder and disinfectant spraying', keywords: ['disinfect', 'bleach', 'spray', 'sanitiz', 'powder'] },
    { id: 'bin_maintenance', label: 'Community dumpster bin washing and repositioning', keywords: ['bin', 'dumpster', 'wash', 'clean', 'reposition'] },
    { id: 'yard_transit', label: 'Transportation to designated processing / waste-to-energy plant', keywords: ['transit', 'disposal', 'process', 'dumping ground', 'landfill', 'yard'] },
  ],
  Traffic: [
    { id: 'signal_controller', label: 'Signal controller logic and timing circuit restoration', keywords: ['signal', 'controller', 'timer', 'logic', 'phase'] },
    { id: 'signage_installation', label: 'Road regulatory / cautionary signage replacement', keywords: ['sign', 'board', 'post', 'caution', 'speed'] },
    { id: 'pavement_marking', label: 'Reflective thermoplastic zebra/lane marking application', keywords: ['marking', 'zebra', 'thermoplast', 'paint', 'strip'] },
    { id: 'corridor_flow_check', label: 'Traffic flow observation and bottleneck clearance', keywords: ['traffic', 'flow', 'clear', 'bottleneck', 'lane'] },
  ],
  Default: [
    { id: 'site_inspection', label: 'Site arrival and civic fault inspection', keywords: ['visit', 'inspect', 'examin', 'site', 'locat'] },
    { id: 'corrective_repair', label: 'Corrective civil, mechanical, or electrical work executed', keywords: ['repair', 'fix', 'replac', 'patch', 'clear', 'work'] },
    { id: 'debris_cleanup', label: 'Site cleanup and hazardous debris removal', keywords: ['clean', 'debris', 'clear', 'tid'] },
    { id: 'functional_test', label: 'Operational verification test and safety confirmation', keywords: ['test', 'verif', 'function', 'safet', 'check', 'complet'] },
  ],
};

/**
 * Domain-specific keyword dictionaries to verify task & department relevance.
 */
const DOMAIN_KEYWORDS = {
  Pothole: ['pothole', 'road', 'asphalt', 'tar', 'bitumen', 'crater', 'roller', 'compaction', 'pavement', 'patch', 'resurfaced', 'street'],
  'Water Supply': ['water', 'pipe', 'pipeline', 'valve', 'leak', 'pressure', 'burst', 'plumbing', 'joint', 'coupling', 'flow'],
  Drainage: ['drain', 'sewer', 'manhole', 'sewage', 'silt', 'desilt', 'blockage', 'clog', 'jetting', 'overflow', 'gully'],
  Streetlight: ['light', 'pole', 'lamp', 'fixture', 'bulb', 'cable', 'wire', 'luminaire', 'illumination', 'phase', 'contactor'],
  Garbage: ['garbage', 'waste', 'trash', 'dump', 'bin', 'debris', 'clearing', 'sanitation', 'litter', 'disposal', 'disinfect'],
  Traffic: ['traffic', 'signal', 'junction', 'sign', 'zebra', 'crossing', 'lane', 'divider', 'barrier', 'congestion'],
  'Tree Fall': ['tree', 'branch', 'trunk', 'horticulture', 'chainsaw', 'pruning', 'wood', 'avenue'],
  'Illegal Construction': ['construction', 'encroachment', 'building', 'structure', 'demolition', 'unauthorized', 'plot', 'setback'],
  Default: ['repair', 'maintenance', 'fix', 'civic', 'work', 'issue', 'complaint', 'site', 'inspect', 'completed'],
};

/**
 * Phrases indicating non-performance, incomplete work, or contradictions.
 */
const CONTRADICTION_SIGNALS = [
  'could not fix',
  'unable to fix',
  'work pending',
  'material shortage',
  'not completed',
  'not done',
  'unable to locate',
  'postponed',
  'deferred',
  'contractor absent',
  'equipment broke',
  'equipment broken',
  'insufficient funds',
  'weather prevented',
  'will do later',
  'will visit tomorrow',
  'false complaint',
  'wrong address',
];

/**
 * Calculate multi-dimensional evidence-based resolution assessment.
 *
 * @param {string} complaintDescription - Description of original grievance
 * @param {string} resolutionNotes - Employee's submitted work report
 * @param {string} category - Complaint category (e.g., 'Pothole', 'Water Supply')
 * @param {Array<string>} evidenceUrls - Attached photo or file URLs
 * @param {object} options - Optional context: { departmentName, taskTitle, actionsTaken }
 * @returns {Promise<object>} Structured verification assessment
 */
async function assessResolutionEvidence(
  complaintDescription = '',
  resolutionNotes = '',
  category = 'Default',
  evidenceUrls = [],
  options = {}
) {
  // Polymorphic argument handling: support single object payload or positional arguments
  if (complaintDescription && typeof complaintDescription === 'object' && !Array.isArray(complaintDescription)) {
    const params = complaintDescription;
    complaintDescription =
      typeof params.complaintDescription === 'string'
        ? params.complaintDescription
        : typeof params.description === 'string'
        ? params.description
        : params.task?.description || '';
    resolutionNotes = params.resolutionNotes || params.notes || '';
    category = params.category || 'Default';
    evidenceUrls = params.evidenceUrls || params.evidence || [];
    options = params.options || params;
  }

  const safeNotes = typeof resolutionNotes === 'string' ? resolutionNotes : '';
  const safeDesc = typeof complaintDescription === 'string' ? complaintDescription : '';
  const notesLower = safeNotes.toLowerCase().trim();
  const descLower = safeDesc.toLowerCase().trim();
  const actionsList = Array.isArray(options.actionsTaken) ? options.actionsTaken : [];
  const department = options.departmentName || '';

  // Factor Scores Container
  const factorScores = {
    descriptionCompleteness: { score: 0, max: 25, details: '' },
    taskRelevance: { score: 0, max: 25, details: '' },
    evidenceAvailability: { score: 0, max: 20, details: '' },
    checklistCompliance: { score: 0, max: 15, details: '' },
    sopAlignment: { score: 0, max: 15, details: '' },
  };

  const missingRequirements = [];
  const identifiedInconsistencies = [];

  // ───────────────────────────────────────────────────────────────────────────
  // Factor 1: Resolution Description Completeness (Max 25 points)
  // ───────────────────────────────────────────────────────────────────────────
  let compScore = 0;
  if (notesLower.length >= COMPREHENSIVE_NOTES_LENGTH) {
    compScore += 15;
    factorScores.descriptionCompleteness.details = 'Comprehensive and detailed work description.';
  } else if (notesLower.length >= MIN_RESOLUTION_NOTES_LENGTH) {
    compScore += 10;
    factorScores.descriptionCompleteness.details = 'Adequate description length meeting minimum 30-character threshold.';
  } else if (notesLower.length >= 15) {
    compScore += 4;
    missingRequirements.push('Resolution description is brief; please provide detailed engineering action.');
    factorScores.descriptionCompleteness.details = 'Very brief notes (< 30 chars).';
  } else {
    compScore += 0;
    missingRequirements.push('Resolution notes missing or too short to describe physical work performed.');
    factorScores.descriptionCompleteness.details = 'Unacceptable length (< 15 chars).';
  }

  // Physical action verbs
  const actionVerbs = [
    'repair', 'replac', 'fill', 'patch', 'compact', 'clear', 'desilt', 'weld',
    'seal', 'install', 'clean', 'flush', 'excavat', 'scour', 'disinfect', 'rectif'
  ];
  const hasAction = actionVerbs.some((v) => notesLower.includes(v) || actionsList.some(a => a.toLowerCase().includes(v)));
  if (hasAction) {
    compScore += 5;
  } else {
    missingRequirements.push('Specific physical action verbs (e.g., repaired, replaced, cleared) missing in report.');
  }

  // Outcome description
  const outcomeKeywords = [
    'restor', 'operat', 'level', 'flush', 'smooth', 'normal', 'tested', 'flow',
    'clean', 'safet', 'functional', 'complet', 'cleared', 'intact', 'pressur'
  ];
  const hasOutcome = outcomeKeywords.some((v) => notesLower.includes(v));
  if (hasOutcome) {
    compScore += 5;
  } else {
    missingRequirements.push('Outcome verification statement (e.g., traffic restored, water pressure normal) missing.');
  }
  factorScores.descriptionCompleteness.score = Math.min(25, compScore);

  // ───────────────────────────────────────────────────────────────────────────
  // Factor 2: Complaint and Task Relevance (Max 25 points)
  // ───────────────────────────────────────────────────────────────────────────
  let relScore = 0;
  const domainKws = DOMAIN_KEYWORDS[category] || DOMAIN_KEYWORDS.Default;
  const matchedDomain = domainKws.filter((kw) => notesLower.includes(kw));

  if (matchedDomain.length >= 3) {
    relScore += 15;
    factorScores.taskRelevance.details = `Strong contextual alignment with ${category} category (${matchedDomain.join(', ')}).`;
  } else if (matchedDomain.length >= 1) {
    relScore += 10;
    factorScores.taskRelevance.details = `Basic contextual keyword match for ${category}.`;
  } else {
    relScore += 2;
    missingRequirements.push(`Report lacks expected domain terms for ${category} category.`);
    factorScores.taskRelevance.details = `Minimal domain keywords found for ${category}.`;
  }

  // Check overlap with original complaint text keywords
  const complaintWords = descLower.split(/\W+/).filter((w) => w.length >= 4);
  const overlap = complaintWords.filter((w) => notesLower.includes(w));
  if (overlap.length >= 2) {
    relScore += 10;
  } else if (overlap.length === 1) {
    relScore += 5;
  } else {
    relScore += 2;
  }
  factorScores.taskRelevance.score = Math.min(25, relScore);

  // Cross-Domain Contradiction Check: e.g. task is Streetlight but notes talk about digging sewer
  for (const [otherCat, otherKws] of Object.entries(DOMAIN_KEYWORDS)) {
    if (otherCat !== category && otherCat !== 'Default') {
      const otherMatches = otherKws.filter((kw) => notesLower.includes(kw));
      if (otherMatches.length >= 3 && matchedDomain.length === 0) {
        identifiedInconsistencies.push(
          `Resolution notes describe work related to "${otherCat}" (${otherMatches.join(', ')}), but task is categorized as "${category}".`
        );
        factorScores.taskRelevance.score = Math.max(0, factorScores.taskRelevance.score - 15);
        break;
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Factor 3: Evidence Availability & Validity (Max 20 points)
  // Note: Uploaded evidence establishes only that an attachment was submitted.
  // Visual authenticity and physical completion must be verified by human supervisor.
  // ───────────────────────────────────────────────────────────────────────────
  let evScore = 0;
  const validUrls = (Array.isArray(evidenceUrls) ? evidenceUrls : [])
    .filter((url) => typeof url === 'string' && url.trim().length > 0)
    .map((url) => url.trim());

  if (validUrls.length === 0) {
    missingRequirements.push('Mandatory photographic or on-site completion evidence is missing.');
    factorScores.evidenceAvailability.details = 'No evidence attachments provided. Mandatory on-site proof is missing.';
    factorScores.evidenceAvailability.score = 0;
  } else {
    // 1. Base attachment availability (10 points)
    evScore += 10;

    // 2. Format & metadata validity check (5 points)
    const validFormatCount = validUrls.filter(
      (url) => /^https?:\/\//i.test(url) || /^\/?([a-zA-Z0-9_\-.]+\/)+[a-zA-Z0-9_\-.]+\.(jpg|jpeg|png|webp|pdf)$/i.test(url)
    ).length;

    if (validFormatCount > 0) {
      evScore += 5;
    } else {
      missingRequirements.push('Evidence attachment format appears invalid or unresolvable.');
    }

    // 3. Explicit report cross-referencing (5 points)
    // Checks if written narrative explicitly references photo proof or documented visual state
    const explicitPhotoReference =
      notesLower.includes('photo') ||
      notesLower.includes('image') ||
      notesLower.includes('proof') ||
      notesLower.includes('photograph') ||
      notesLower.includes('attached') ||
      notesLower.includes('before') ||
      notesLower.includes('after') ||
      notesLower.includes('inspection');

    if (explicitPhotoReference) {
      evScore += 5;
    } else {
      evScore += 0;
    }

    factorScores.evidenceAvailability.score = Math.min(20, evScore);
    factorScores.evidenceAvailability.details = `${validUrls.length} attachment reference(s) submitted with valid format. Note: Image availability does not constitute visual verification of physical work; visual inspection is reserved for human supervisor.`;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Factor 4: Task-Specific Checklist Compliance (Max 15 points)
  // Note: Matches reflect employee-reported actions and serve as supervisor review points.
  // ───────────────────────────────────────────────────────────────────────────
  const checklist = CATEGORY_CHECKLISTS[category] || CATEGORY_CHECKLISTS.Default;
  let matchedChecklistCount = 0;
  const missingChecklistItems = [];
  const reportedChecklistItems = [];

  for (const item of checklist) {
    const isMatched = item.keywords.some(
      (kw) => notesLower.includes(kw) || actionsList.some((a) => a.toLowerCase().includes(kw))
    );
    if (isMatched) {
      matchedChecklistCount++;
      reportedChecklistItems.push(item.label);
    } else {
      missingChecklistItems.push(item.label);
    }
  }

  const checklistRatio = checklist.length > 0 ? matchedChecklistCount / checklist.length : 1;
  const chScore = Math.round(checklistRatio * 15);
  factorScores.checklistCompliance.score = chScore;
  factorScores.checklistCompliance.details = `Reported ${matchedChecklistCount} of ${checklist.length} standard reference steps in written notes. (These reflect self-reported actions and serve as review points for supervisor verification).`;

  if (missingChecklistItems.length > 0) {
    missingRequirements.push(`Review points for supervisor: Unmentioned standard steps: ${missingChecklistItems.slice(0, 3).join('; ')}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Factor 5: Knowledge SOP Alignment (Max 15 points)
  // Strict Rules:
  // - Award points ONLY when relevant approved SOP content is retrieved and matched.
  // - Never award a default 10 points when no relevant SOP is found.
  // - Explicitly distinguish: no applicable SOP, retrieval failure, unmatched, and matched.
  // - Preserve source title and section.
  // - Accurately describe as lexical keyword match (never claim semantic retrieval).
  // ───────────────────────────────────────────────────────────────────────────
  let sopScore = 0;
  let retrievedSops = [];
  let sopRetrievalStatus = 'no_applicable_sop';
  let sopDetails = '';
  let matchedSopInfo = null;

  try {
    retrievedSops = await retrieveKnowledge(category, department);
    if (!Array.isArray(retrievedSops) || retrievedSops.length === 0) {
      sopRetrievalStatus = 'no_applicable_sop';
      sopScore = 0;
      sopDetails = `No approved official municipal SOP document exists for category "${category}" / department "${department}". 0 SOP points awarded.`;
    }
  } catch (sopErr) {
    sopRetrievalStatus = 'retrieval_failed';
    sopScore = 0;
    sopDetails = `SOP knowledge retrieval failed (${sopErr.message}). 0 SOP points awarded.`;
  }

  let applicablePrecautions = [];
  if (retrievedSops && retrievedSops.length > 0) {
    const topDoc = retrievedSops[0];
    const recActions = Array.isArray(topDoc.recommendedActions) ? topDoc.recommendedActions : [];
    applicablePrecautions = Array.isArray(topDoc.precautions) ? topDoc.precautions : [];

    // Lexical keyword match against recommended actions
    let sopMatches = 0;
    const matchedActions = [];
    for (const rec of recActions) {
      const recWords = rec.toLowerCase().split(/\W+/).filter((w) => w.length >= 5);
      if (recWords.some((w) => notesLower.includes(w))) {
        sopMatches++;
        matchedActions.push(rec);
      }
    }

    if (sopMatches >= 2) {
      sopScore = 15;
      sopRetrievalStatus = 'sop_matched';
      sopDetails = `Lexical keyword match with official procedures in "${topDoc.title}" (Source: "${topDoc.source || 'Municipal Engineering Manual'}", Section: "${topDoc.section || topDoc.title}").`;
      matchedSopInfo = {
        title: topDoc.title,
        source: topDoc.source || 'Municipal Engineering Manual',
        section: topDoc.section || topDoc.title,
        matchedCount: sopMatches,
        matchedActions,
      };
    } else if (sopMatches === 1) {
      sopScore = 10;
      sopRetrievalStatus = 'sop_matched';
      sopDetails = `Partial lexical match with procedures in "${topDoc.title}" (Source: "${topDoc.source || 'Municipal Engineering Manual'}", Section: "${topDoc.section || topDoc.title}").`;
      matchedSopInfo = {
        title: topDoc.title,
        source: topDoc.source || 'Municipal Engineering Manual',
        section: topDoc.section || topDoc.title,
        matchedCount: sopMatches,
        matchedActions,
      };
    } else {
      sopScore = 0; // ZERO POINTS when no keywords match!
      sopRetrievalStatus = 'sop_unmatched';
      sopDetails = `Consulted approved SOP "${topDoc.title}". No procedural keywords were matched in the resolution notes. 0 SOP points awarded.`;
      matchedSopInfo = {
        title: topDoc.title,
        source: topDoc.source || 'Municipal Engineering Manual',
        section: topDoc.section || topDoc.title,
        matchedCount: 0,
      };
    }
  }

  factorScores.sopAlignment.score = Math.min(15, sopScore);
  factorScores.sopAlignment.details = sopDetails;
  factorScores.sopAlignment.status = sopRetrievalStatus;
  factorScores.sopAlignment.matchedSop = matchedSopInfo;

  // ───────────────────────────────────────────────────────────────────────────
  // Factor 6: Consistency & Contradiction Penalty
  // ───────────────────────────────────────────────────────────────────────────
  for (const signal of CONTRADICTION_SIGNALS) {
    if (notesLower.includes(signal)) {
      identifiedInconsistencies.push(
        `Resolution text contains explicit non-completion phrase: "${signal}". Work may be incomplete or deferred.`
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Total Score Calculation & Status Mapping
  // ───────────────────────────────────────────────────────────────────────────
  let rawTotal =
    factorScores.descriptionCompleteness.score +
    factorScores.taskRelevance.score +
    factorScores.evidenceAvailability.score +
    factorScores.checklistCompliance.score +
    factorScores.sopAlignment.score;

  // Apply contradiction deductions
  if (identifiedInconsistencies.length > 0) {
    rawTotal = Math.max(10, rawTotal - (identifiedInconsistencies.length * 25));
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(rawTotal)));
  const normalizedScore = parseFloat((overallScore / 100).toFixed(2));

  // Determine Verification Recommendation (Advisory only; never a verification decision)
  let recommendation = 'HUMAN_REVIEW_REQUIRED';
  if (overallScore >= 70 && identifiedInconsistencies.length === 0 && validUrls.length > 0) {
    recommendation = 'APPROVE_RECOMMENDED';
  } else if (overallScore < 40 || notesLower.length < 20 || identifiedInconsistencies.length > 0 || validUrls.length === 0) {
    recommendation = 'REWORK_RECOMMENDED';
  } else {
    recommendation = 'HUMAN_REVIEW_REQUIRED';
  }

  // CRITICAL RULE: Automated assessment NEVER verifies tasks or makes a verification decision!
  // It provides an objective assessment and recommendation. The verification decision rests
  // strictly with the authorized department supervisor.
  const verified = false;
  const verificationStatus = 'requires_review';

  // Explanatory Synthesis
  const explanation = `Automated rubric assessment: ${overallScore}/100 (${recommendation.replace(/_/g, ' ')}). Recommendation is advisory for supervisor inspection. Physical verification and final decision rest strictly with the authorized department supervisor.`;

  const evidenceCompleteness =
    validUrls.length >= 2
      ? 'multiple_attachments_provided'
      : validUrls.length === 1
      ? 'single_attachment_provided'
      : 'missing';

  const taskRelevance =
    relScore >= 20 ? 'high' : relScore >= 12 ? 'moderate' : 'low';

  return {
    verificationScore: normalizedScore,
    overallScore,
    verified: false,
    verificationStatus: 'requires_review',
    recommendation,
    reason: explanation,
    explanation,
    factorScores,
    evidenceCompleteness,
    taskRelevance,
    missingRequirements,
    identifiedInconsistencies,
    sopRetrievalStatus,
    matchedSop: matchedSopInfo,
    reportedChecklistItems,
    unmentionedReferenceSteps: missingChecklistItems,
    sopGuidance: {
      references: (retrievedSops || []).map((d) => ({
        documentId: d._id,
        title: d.title,
        source: d.source || 'Municipal Engineering Manual',
        department: d.department,
        documentType: d.documentType,
      })),
      applicablePrecautions,
      disclaimer: 'SOP guidance is supporting municipal reference criteria and does not independently prove physical completion.',
    },
    knowledgeDocumentsUsed: (retrievedSops || []).map((d) => d._id),
    method: 'evidence_based_multidimensional_rubric',
    evaluatedAt: new Date(),
  };
}

/**
 * Retrieve approved SOP knowledge documents for this category/department.
 */
async function retrieveKnowledge(category, department = null) {
  try {
    const query = {
      active: true,
      approvalStatus: 'approved',
      isDeleted: { $ne: true },
    };

    if (category && category !== 'Default') {
      query.applicableCategories = category;
    }
    if (department) {
      query.department = department;
    }

    const docs = await KnowledgeDocument.find(query).limit(3);
    if (docs.length > 0) return docs;

    // Fallback: search by category only if department-specific wasn't found
    if (department) {
      return await KnowledgeDocument.find({
        applicableCategories: category,
        active: true,
        approvalStatus: 'approved',
        isDeleted: { $ne: true },
      }).limit(3);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Main verification entry point.
 * Preserves legacy signature: verifyResolution(complaintDescription, resolutionNotes, category, evidenceUrls, options)
 */
async function verifyResolution(
  complaintDescription,
  resolutionNotes,
  category,
  evidenceUrls = [],
  options = {}
) {
  try {
    return await assessResolutionEvidence(
      complaintDescription,
      resolutionNotes,
      category,
      evidenceUrls,
      options
    );
  } catch (err) {
    // Fail-safe: Record failure and require human supervisor review rather than silently verifying
    console.error('[M12] Resolution verification assessment error:', err);
    return {
      verificationScore: 0.3,
      overallScore: 30,
      verified: false,
      verificationStatus: 'requires_review',
      recommendation: 'HUMAN_REVIEW_REQUIRED',
      reason: 'Automated assessment encountered an unexpected issue; flagged for mandatory human supervisor review.',
      explanation: 'System error during automated evidence rubric evaluation; requiring human supervisor verification.',
      factorScores: {
        descriptionCompleteness: { score: 10, max: 25, details: 'Evaluation interrupted' },
        taskRelevance: { score: 10, max: 25, details: 'Evaluation interrupted' },
        evidenceAvailability: { score: 5, max: 20, details: 'Evaluation interrupted' },
        checklistCompliance: { score: 5, max: 15, details: 'Evaluation interrupted' },
        sopAlignment: { score: 0, max: 15, details: 'Evaluation interrupted' },
      },
      evidenceCompleteness: 'partial',
      taskRelevance: 'moderate',
      missingRequirements: ['Mandatory human supervisor physical verification required'],
      identifiedInconsistencies: [],
      sopGuidance: {
        references: [],
        applicablePrecautions: [],
        disclaimer: 'Automated evaluation fallback mode.',
      },
      knowledgeDocumentsUsed: [],
      method: 'fallback_human_review',
      evaluatedAt: new Date(),
    };
  }
}

module.exports = {
  verifyResolution,
  assessResolutionEvidence,
  retrieveKnowledge,
  CATEGORY_CHECKLISTS,
  DOMAIN_KEYWORDS,
  CONTRADICTION_SIGNALS,
};

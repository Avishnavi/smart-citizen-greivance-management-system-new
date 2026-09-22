'use strict';

/**
 * Resolution Verification Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Research contribution: Automated resolution quality verification using LLM + RAG.
 *
 * Current state: Rule-based completeness check (keyword coverage, length check).
 * Integration point: Replace verifyWithRules with llmService.verifyResolution()
 * when LLM is configured.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const llmService = require('./llmService');
const KnowledgeDocument = require('../models/KnowledgeDocument');

const MIN_RESOLUTION_NOTES_LENGTH = 30;

const RESOLUTION_QUALITY_KEYWORDS = {
  Pothole: ['patched', 'repaired', 'filled', 'leveled', 'asphalt', 'concrete', 'tested'],
  Drainage: ['cleared', 'cleaned', 'dredged', 'jetting', 'desilted', 'sanitized', 'treated'],
  Streetlight: ['replaced', 'repaired', 'operational', 'tested', 'lights on', 'fixture', 'lamp'],
  'Water Supply': ['repaired', 'sealed', 'pressure tested', 'welded', 'fixed', 'pipe'],
  Garbage: ['cleared', 'collected', 'emptied', 'sanitized', 'disinfected', 'compacted'],
  Default: ['completed', 'resolved', 'fixed', 'repaired', 'done', 'finished'],
};

/**
 * Rule-based resolution verification (transparent, auditable).
 * @returns {{ verificationScore, verified, reason, method }}
 */
function verifyWithRules(complaintDescription, resolutionNotes, category) {
  const notesLower = resolutionNotes.toLowerCase();
  let score = 0;
  const reasons = [];

  // Check 1: Length / detail
  if (resolutionNotes.length >= MIN_RESOLUTION_NOTES_LENGTH) {
    score += 0.3;
  } else {
    reasons.push('Resolution notes too brief (minimum 30 characters required).');
  }

  // Check 2: Quality keywords
  const qualityKws = RESOLUTION_QUALITY_KEYWORDS[category] || RESOLUTION_QUALITY_KEYWORDS.Default;
  const matchedKws = qualityKws.filter((kw) => notesLower.includes(kw));
  if (matchedKws.length >= 2) {
    score += 0.4;
  } else if (matchedKws.length === 1) {
    score += 0.2;
    reasons.push(`Only ${matchedKws.length} resolution quality keyword found. Expected 2+.`);
  } else {
    reasons.push('No relevant resolution action keywords found in notes.');
  }

  // Check 3: Does it mention what was actually done (action verbs)?
  const actionVerbs = ['repair', 'replac', 'clear', 'fix', 'complet', 'resolv', 'patch', 'clean'];
  if (actionVerbs.some((v) => notesLower.includes(v))) {
    score += 0.3;
  } else {
    reasons.push('No action verb detected. Please describe what was physically done.');
  }

  const verified = score >= 0.7;
  return {
    verificationScore: parseFloat(score.toFixed(2)),
    verified,
    verificationStatus: verified ? 'verified' : 'requires_review',
    reason: verified
      ? `Resolution notes verified with quality score ${(score * 100).toFixed(0)}%.`
      : `Verification failed: ${reasons.join(' ')}`,
    method: 'rule_based', // Will become 'llm_rag' when LLM is connected
  };
}

/**
 * Retrieve relevant knowledge documents for this complaint category.
 */
async function retrieveKnowledge(category) {
  try {
    const docs = await KnowledgeDocument.find({
      applicableCategories: category,
      active: true,
    }).limit(3);
    return docs;
  } catch {
    return [];
  }
}

/**
 * Main verification entry point.
 * Tries LLM first; falls back to rule-based if not configured.
 */
async function verifyResolution(complaintDescription, resolutionNotes, category) {
  const knowledgeDocs = await retrieveKnowledge(category);

  // Attempt LLM verification if configured
  if (llmService.isConfigured()) {
    const llmResult = await llmService.verifyResolution(
      complaintDescription,
      resolutionNotes,
      knowledgeDocs
    );
    if (llmResult.status === 'completed') {
      return {
        ...llmResult,
        knowledgeDocumentsUsed: knowledgeDocs.map((d) => d._id),
        verifierType: 'ai',
        method: 'llm_rag',
      };
    }
  }

  // Fallback: rule-based
  const ruleResult = verifyWithRules(complaintDescription, resolutionNotes, category);
  return {
    ...ruleResult,
    knowledgeDocumentsUsed: knowledgeDocs.map((d) => d._id),
    verifierType: 'ai',
  };
}

module.exports = { verifyResolution, retrieveKnowledge };

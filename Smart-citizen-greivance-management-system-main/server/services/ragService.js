'use strict';

/**
 * RAG Knowledge Support Service (Module 8)
 * ─────────────────────────────────────────────────────────────────────────────
 * Grounded Municipal Procedure & Guideline Retrieval for Grievance Handling.
 * Uses domain-filtered lexical and metadata ranking to retrieve approved SOPs.
 * Strictly prevents hallucinated or unsupported municipal instructions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const KnowledgeDocument = require('../models/KnowledgeDocument');
const KnowledgeChunk = require('../models/KnowledgeChunk');

// Civic domain stop words
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'into', 'near', 'please', 'complaint', 'grievance', 'issue', 'problem', 'facing',
  'there', 'this', 'that', 'our', 'area', 'ward', 'road', 'street', 'city', 'it', 'has', 'have',
  'been', 'very', 'severe', 'kindly', 'help', 'urgent', 'immediately', 'now', 'today', 'daily',
]);

/**
 * Tokenizes text and removes punctuation + stop words.
 */
function extractQueryTokens(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 2 && !STOP_WORDS.has(tok));
}

/**
 * Computes token overlap score (0 to 1) between query tokens and target text.
 */
function computeTokenOverlap(queryTokens, targetText) {
  if (!queryTokens.length || !targetText) return 0;
  const targetLower = targetText.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (targetLower.includes(token)) {
      matches++;
    }
  }
  return matches / queryTokens.length;
}

/**
 * Domain-specific high-impact keyword mapping.
 */
const DOMAIN_KEYWORDS = {
  'Road Maintenance Department': ['pothole', 'asphalt', 'bitumen', 'crater', 'resurfacing', 'compaction', 'cold-mix', 'roller', 'tack-coat', 'corridor', 'pavement', 'edge'],
  'Electricity & Lighting Department': ['streetlight', 'lamp', 'cable', 'wire', 'contactor', 'mcb', 'feeder', 'led', 'pole', 'transformer', 'tripping', 'photometrics', 'fuse'],
  'Water & Sewerage Board': ['drainage', 'sewer', 'manhole', 'jetting', 'desilting', 'pipe', 'leak', 'burst', 'water', 'super-sucker', 'hypochlorite', 'overflow', 'contamination'],
  'Solid Waste & Sanitation': ['garbage', 'dump', 'waste', 'bin', 'sweeping', 'sanitation', 'bioculture', 'clearing', 'litter', 'compost', 'disposal'],
  'Public Health & Sanitation': ['mosquito', 'fogging', 'vector', 'dengue', 'malaria', 'larvicide', 'health', 'stray', 'dog', 'animal', 'rabies', 'vaccination'],
};

/**
 * Core Knowledge Retrieval Function (Module 8)
 *
 * @param {Object} params
 * @param {string} params.category - Complaint category (e.g. 'Pothole', 'Streetlight')
 * @param {string} params.subcategory - Subcategory if identified
 * @param {string} params.description - Verbatim or normalized complaint description
 * @param {string} params.issue - Identified issue title/summary
 * @param {string} params.department - Target department name
 * @param {string} params.userRole - Requesting user's role ('central_admin', 'department_supervisor', 'department_employee', 'citizen')
 * @param {string} params.userDepartment - Requesting user's assigned department
 * @param {boolean} params.isPublicOnly - Restrict to public citizen charter docs only
 * @param {number} params.minScore - Minimum relevance threshold (default: 35)
 * @param {number} params.limit - Max number of grounded chunks to return (default: 3)
 * @returns {Promise<Object>} Grounded knowledge guidance payload
 */
async function retrieveRelevantKnowledge({
  category = '',
  subcategory = '',
  description = '',
  issue = '',
  department = '',
  userRole = 'central_admin',
  userDepartment = '',
  isPublicOnly = false,
  minScore = 35,
  limit = 3,
}) {
  const queryTokens = extractQueryTokens(`${category} ${subcategory} ${issue} ${description}`);

  // 1. Role-Based Access Control Filtering
  if (userRole === 'citizen' && !isPublicOnly) {
    // Citizens cannot access internal departmental procedures
    return {
      found: false,
      accessDenied: true,
      summary: 'Access restricted: Department SOPs and internal resolution guidelines are reserved for municipal officers.',
      recommendedActions: [],
      precautions: [],
      references: [],
      retrievalMethod: 'access_controlled_rejection',
    };
  }

  // Determine allowed departments for staff
  let allowedDepartments = null;
  if (userRole === 'department_supervisor' || userRole === 'department_employee') {
    // Staff can only access their department's docs, or generic/public docs
    allowedDepartments = [userDepartment, 'All', 'General', 'Municipal Corporation'];

    // Cross-department access prevention:
    if (department && department !== userDepartment && !['All', 'General'].includes(department)) {
      return {
        found: false,
        accessDenied: true,
        summary: `Access restricted: You cannot retrieve internal SOPs for "${department}". Your authorized department is "${userDepartment}".`,
        recommendedActions: [],
        precautions: [],
        references: [],
        retrievalMethod: 'cross_department_blocked',
      };
    }
  }

  // 2. Build Base Mongo Query (Active, Approved, Non-Deleted)
  const baseFilter = {
    active: true,
    isDeleted: { $ne: true },
    approvalStatus: 'approved',
  };

  if (isPublicOnly || userRole === 'citizen') {
    baseFilter.isPublic = true;
  } else if (allowedDepartments) {
    baseFilter.$or = [
      { department: { $in: allowedDepartments } },
      { isPublic: true },
    ];
  }

  // 3. Query candidate chunks from DB
  const candidateChunks = await KnowledgeChunk.find(baseFilter).populate('documentId').lean();

  if (!candidateChunks || candidateChunks.length === 0) {
    return {
      found: false,
      summary: 'No relevant knowledge source was found for this complaint.',
      recommendedActions: [],
      precautions: [],
      references: [],
      retrievalMethod: 'lexical_domain_matching',
    };
  }

  const effectiveDept = department || userDepartment;

  // 4. Rank Candidate Chunks using Multi-Factor Grounding Rubric
  const scoredCandidates = [];

  for (const chunk of candidateChunks) {
    const parentDoc = chunk.documentId || {};
    let score = 0;
    const matchFactors = [];

    // Factor 1: Department Alignment (0 - 40 pts)
    if (effectiveDept && chunk.department === effectiveDept) {
      score += 40;
      matchFactors.push('exact_department_match');
    } else if (chunk.department === 'All' || chunk.department === 'General') {
      score += 15;
      matchFactors.push('general_municipal_match');
    }

    // Factor 2: Category & Subcategory Alignment (0 - 35 pts)
    const catList = (chunk.applicableCategories || []).map((c) => c.toLowerCase());
    const targetCat = (category || '').toLowerCase();
    if (targetCat && catList.includes(targetCat)) {
      score += 25;
      matchFactors.push('exact_category_match');
    } else if (targetCat && catList.some((c) => c.includes(targetCat) || targetCat.includes(c))) {
      score += 15;
      matchFactors.push('partial_category_match');
    }

    const subList = (chunk.applicableSubcategories || []).map((s) => s.toLowerCase());
    const targetSub = (subcategory || '').toLowerCase();
    if (targetSub && subList.includes(targetSub)) {
      score += 10;
      matchFactors.push('exact_subcategory_match');
    }

    // Factor 3: Lexical Token Overlap (0 - 30 pts)
    const chunkCombinedText = `${chunk.title} ${chunk.sectionHeading} ${chunk.content}`;
    const overlapRatio = computeTokenOverlap(queryTokens, chunkCombinedText);
    const overlapPoints = Math.round(overlapRatio * 30);
    score += overlapPoints;
    if (overlapPoints >= 10) {
      matchFactors.push(`token_overlap_${Math.round(overlapRatio * 100)}%`);
    }

    // Factor 4: Domain High-Impact Keywords (0 - 15 pts)
    const deptKeywords = DOMAIN_KEYWORDS[chunk.department] || [];
    let domainKwMatches = 0;
    const textLower = chunkCombinedText.toLowerCase();
    for (const kw of deptKeywords) {
      if (textLower.includes(kw) && (description.toLowerCase().includes(kw) || issue.toLowerCase().includes(kw))) {
        domainKwMatches++;
      }
    }
    const kwPoints = Math.min(domainKwMatches * 5, 15);
    score += kwPoints;
    if (kwPoints > 0) {
      matchFactors.push(`domain_keywords_matched_${domainKwMatches}`);
    }

    // Factor 5: Recency Bonus (0 - 5 pts)
    const updatedDate = chunk.updatedAt || parentDoc.updatedAt || new Date(0);
    const ageDays = (Date.now() - new Date(updatedDate).getTime()) / (24 * 3600 * 1000);
    if (ageDays <= 30) {
      score += 5;
    } else if (ageDays <= 90) {
      score += 2;
    }

    if (score >= minScore) {
      scoredCandidates.push({
        chunk,
        parentDoc,
        score,
        matchFactors,
      });
    }
  }

  // Sort descending by relevance score
  scoredCandidates.sort((a, b) => b.score - a.score);

  // 5. Evaluate if any candidates passed relevance threshold
  if (scoredCandidates.length === 0) {
    return {
      found: false,
      summary: 'No relevant knowledge source was found for this complaint.',
      recommendedActions: [],
      precautions: [],
      references: [],
      retrievalMethod: 'lexical_domain_matching',
      score: 0,
    };
  }

  // 6. Deduplicate & Select Top-K Chunks
  const topMatches = scoredCandidates.slice(0, limit);
  const primaryMatch = topMatches[0];

  // Synthesize grounded recommended actions
  const actionSet = new Set();
  const precautionSet = new Set();
  const references = [];

  for (const item of topMatches) {
    const { chunk, parentDoc, score } = item;

    // Collect actions
    (chunk.recommendedActions || []).forEach((a) => actionSet.add(a));
    (parentDoc.recommendedActions || []).forEach((a) => actionSet.add(a));

    // Collect precautions
    (chunk.precautions || []).forEach((p) => precautionSet.add(p));
    (parentDoc.precautions || []).forEach((p) => precautionSet.add(p));

    // Build formal citation reference
    references.push({
      documentId: parentDoc._id || chunk.documentId,
      chunkId: chunk._id,
      title: parentDoc.title || chunk.title,
      source: parentDoc.source || 'Municipal Corporation Manual',
      department: chunk.department || parentDoc.department,
      documentType: chunk.documentType || parentDoc.documentType || 'guideline',
      applicableCategories: chunk.applicableCategories || [],
      sectionHeading: chunk.sectionHeading || 'General Procedure',
      pageReference: chunk.pageReference || 'N/A',
      relevanceScore: Math.min(1.0, parseFloat((score / 100).toFixed(2))),
      isPublic: Boolean(chunk.isPublic),
      version: parentDoc.version || '1.0',
    });
  }

  // Formulate concise grounded summary
  const topChunkContent = primaryMatch.chunk.content;
  const firstSentence = topChunkContent.split(/[.!?]\s+/)[0] + '.';
  const docTitle = primaryMatch.parentDoc.title || primaryMatch.chunk.title;
  const sourceName = primaryMatch.parentDoc.source || 'Municipal Corporation Manual';

  const isOfficial = ['procedure', 'resolution_standard'].includes(primaryMatch.chunk.documentType);
  const guidanceLabel = isOfficial ? 'Official Municipal SOP' : 'General Resolution Guidance';

  const summary = `Grounded in ${sourceName} ("${docTitle}"): ${firstSentence}`;

  return {
    found: true,
    guidanceType: guidanceLabel,
    isOfficialInstruction: isOfficial,
    summary,
    recommendedActions: Array.from(actionSet).slice(0, 5),
    precautions: Array.from(precautionSet).slice(0, 4),
    references,
    topRelevanceScore: primaryMatch.score,
    retrievalMethod: 'lexical_domain_matching',
  };
}

/**
 * Builds formatted text context for RAG verification or LLM prompts.
 */
function buildRAGContext(referencesOrDocs) {
  if (!referencesOrDocs || referencesOrDocs.length === 0) {
    return 'No relevant knowledge documents found for this category.';
  }

  return referencesOrDocs
    .map((item, idx) => {
      const title = item.title || 'Municipal SOP';
      const source = item.source || 'Municipal Corporation Manual';
      const section = item.sectionHeading ? ` [${item.sectionHeading}]` : '';
      const text = item.content || item.summary || (item.recommendedActions || []).join('; ');
      return `[Source ${idx + 1}: ${title} - ${source}${section}]\n${text}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Backward compatibility: retrieve documents by category and description.
 */
async function retrieveRelevantDocuments(category, description) {
  const result = await retrieveRelevantKnowledge({
    category,
    description,
    userRole: 'central_admin',
    minScore: 20,
    limit: 5,
  });

  if (!result.found || !result.references.length) {
    return [];
  }

  const docIds = result.references.map((r) => r.documentId).filter(Boolean);
  return KnowledgeDocument.find({ _id: { $in: docIds } });
}

module.exports = {
  retrieveRelevantKnowledge,
  retrieveRelevantDocuments,
  buildRAGContext,
  extractQueryTokens,
  computeTokenOverlap,
  DOMAIN_KEYWORDS,
};

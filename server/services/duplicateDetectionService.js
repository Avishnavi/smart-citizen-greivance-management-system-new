'use strict';

/**
 * Duplicate Detection Service (M4 – Lexical & Geographical Duplicate Detection)
 * ─────────────────────────────────────────────────────────────────────────────
 * Accurately identifies repeated or related complaints while preventing false positives.
 * Uses token-level Jaccard & Dice lexical similarity coupled with Haversine spatial proximity.
 * (Not embedding-based semantic detection; fully explainable lexical-spatial heuristic).
 *
 * Guarantees:
 * - Requires both semantic similarity AND spatial proximity to flag a likely duplicate.
 * - Same text at distant locations is NOT flagged as a duplicate.
 * - Same location with different issue category is NOT flagged as a duplicate.
 * - Handles missing/invalid coordinates gracefully without crashing.
 * - Excludes the current complaint from self-comparison.
 * - Distinguishes between 'likely_duplicate', 'related', and 'unrelated'.
 * - Advisory only: never automatically discards or auto-rejects citizen submissions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'for', 'to',
  'of', 'with', 'from', 'by', 'as', 'it', 'this', 'that', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'please',
  'kindly', 'urgent', 'urgently', 'sir', 'madam', 'complaint', 'grievance', 'issue'
]);

/**
 * Haversine distance between two lat/lng points in meters.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Validate geographic coordinates.
 */
function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    !isNaN(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    !isNaN(lng) &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Compute text token and n-gram similarity (0.0 to 1.0).
 */
function computeTextSimilarity(textA, textB) {
  if (!textA || !textB) return 0;

  const clean = (t) =>
    t
      .toLowerCase()
      .replace(/[^\w\s\u0B80-\u0BFF]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const tokensA = clean(textA);
  const tokensB = clean(textB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let matchCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      matchCount++;
    }
  }

  // Jaccard token overlap
  const unionSize = new Set([...setA, ...setB]).size;
  const tokenJaccard = unionSize > 0 ? matchCount / unionSize : 0;

  // Dice overlap bonus for high-overlap short sentences
  const dice = (2 * matchCount) / (setA.size + setB.size);

  return parseFloat(Math.min(1.0, (tokenJaccard * 0.6) + (dice * 0.4)).toFixed(3));
}

/**
 * Check whether a complaint is a duplicate or related to any existing active complaint.
 *
 * @param {string} description - New complaint description
 * @param {object} location    - { latitude, longitude }
 * @param {Array}  existingComplaints - Existing complaints from DB
 * @param {object} options     - { category, subcategory, currentComplaintId }
 * @returns {Promise<object>} Detailed duplicate analysis
 */
async function checkDuplicate(description, location, existingComplaints = [], options = {}) {
  const {
    category = 'Other',
    subcategory = '',
    currentComplaintId = null,
  } = options;

  const hasNewLoc = Boolean(location && isValidCoord(location.latitude, location.longitude));

  // Filter candidate pool: exclude self, closed/rejected tickets
  const activeCandidates = (existingComplaints || []).filter((c) => {
    if (currentComplaintId && (c.complaintId === currentComplaintId || c.id === currentComplaintId)) {
      return false; // Prevent self-comparison
    }
    const status = c.status?.toUpperCase?.() || '';
    return !['CLOSED', 'REJECTED'].includes(status);
  });

  let bestMatch = null;
  let highestScore = 0;

  for (const candidate of activeCandidates) {
    const candidateText = candidate.description || candidate.originalText || '';
    const candCategory = candidate.category || 'Other';
    const candSubcategory = candidate.subcategory || '';

    const textSim = computeTextSimilarity(description, candidateText);
    const categoryMatches = (category === candCategory && category !== 'Other');

    const hasCandLoc = candidate.location && isValidCoord(candidate.location.latitude, candidate.location.longitude);
    let distance = null;
    let distanceMatches = false;

    if (hasNewLoc && hasCandLoc) {
      distance = haversineDistance(
        location.latitude,
        location.longitude,
        candidate.location.latitude,
        candidate.location.longitude
      );
      distanceMatches = distance <= 400; // Within 400m radius
    }

    // ── Evaluate Duplicate Level ─────────────────────────────────────────────
    let level = 'unrelated';
    let matchScore = 0;
    let reason = '';

    if (hasNewLoc && hasCandLoc) {
      if (categoryMatches && distance <= 200 && textSim >= 0.50) {
        // High text similarity + close proximity + same category
        level = 'likely_duplicate';
        matchScore = 0.60 + (textSim * 0.30) + ((200 - distance) / 200 * 0.10);
        reason = `Identical issue (${category}) reported ${distance}m away with ${(textSim * 100).toFixed(0)}% text similarity.`;
      } else if (categoryMatches && distance <= 50 && textSim >= 0.35) {
        // Very close proximity (same building / corner) with same category
        level = 'likely_duplicate';
        matchScore = 0.55 + (textSim * 0.30);
        reason = `Same civic problem reported at immediate vicinity (${distance}m away).`;
      } else if (categoryMatches && distance <= 400 && textSim >= 0.40) {
        // Moderate similarity nearby in same category
        level = 'related';
        matchScore = 0.40 + (textSim * 0.25);
        reason = `Related ${category} grievance reported within neighborhood (${distance}m away).`;
      } else if (!categoryMatches && distance <= 60) {
        // Co-located different civic issue (e.g., street light & pothole at same corner)
        level = 'related';
        matchScore = 0.35;
        reason = `Distinct civic issue (${candCategory}) reported at the same location. Not a duplicate.`;
      }
    } else {
      // Location data missing or invalid: cannot confirm spatial duplicate
      if (categoryMatches && textSim >= 0.80) {
        level = 'related';
        matchScore = textSim * 0.70;
        reason = `High text overlap with ${candidate.complaintId || candidate.id}, but location could not be verified.`;
      }
    }

    if (matchScore > highestScore) {
      highestScore = matchScore;
      bestMatch = {
        candidate,
        level,
        similarityScore: parseFloat(matchScore.toFixed(2)),
        textSimilarity: textSim,
        distanceMeters: distance,
        reason,
        categoryMatches,
      };
    }
  }

  // ── Construct Structured Result ────────────────────────────────────────────
  if (bestMatch && bestMatch.level === 'likely_duplicate') {
    const matchId = bestMatch.candidate.complaintId || bestMatch.candidate.id;
    return {
      isDuplicate: true,
      duplicateLevel: 'likely_duplicate',
      status: 'checked',
      method: 'lexical_haversine_heuristic',
      similarComplaintId: matchId,
      similarityScore: bestMatch.similarityScore,
      textSimilarity: bestMatch.textSimilarity,
      distanceMeters: bestMatch.distanceMeters,
      hasSpatialData: bestMatch.distanceMeters !== null,
      reason: bestMatch.reason,
      recommendation: `Potential duplicate of active complaint ${matchId}. Forwarded to Central Admin for review/merge confirmation. Complaint will not be discarded.`,
      categoryMatches: bestMatch.categoryMatches,
    };
  }

  if (bestMatch && bestMatch.level === 'related') {
    const matchId = bestMatch.candidate.complaintId || bestMatch.candidate.id;
    return {
      isDuplicate: false,
      duplicateLevel: 'related',
      status: 'checked',
      method: 'lexical_haversine_heuristic',
      similarComplaintId: matchId,
      similarityScore: bestMatch.similarityScore,
      textSimilarity: bestMatch.textSimilarity,
      distanceMeters: bestMatch.distanceMeters,
      hasSpatialData: bestMatch.distanceMeters !== null,
      reason: bestMatch.reason,
      recommendation: `Related active complaint ${matchId} detected in area. Retained as distinct complaint for independent tracking.`,
      categoryMatches: bestMatch.categoryMatches,
    };
  }

  return {
    isDuplicate: false,
    duplicateLevel: 'none',
    status: 'checked',
    method: 'lexical_haversine_heuristic',
    similarComplaintId: null,
    similarityScore: 0,
    textSimilarity: 0,
    distanceMeters: null,
    hasSpatialData: hasNewLoc,
    reason: 'No similar active complaints found within spatial and semantic thresholds.',
    recommendation: 'Unique complaint verified. Proceed with standard triage.',
    categoryMatches: false,
  };
}

module.exports = {
  checkDuplicate,
  haversineDistance,
  computeTextSimilarity,
  isValidCoord,
};

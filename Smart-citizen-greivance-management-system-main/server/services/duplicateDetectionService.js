'use strict';

/**
 * Duplicate Detection Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Research module: SBERT Semantic Similarity + Haversine Distance
 *
 * Current state: Keyword overlap + Haversine geo-proximity (transparent logic).
 * Integration point: Replace `computeTextSimilarity` with real SBERT embedding
 * call when sentence-transformers / inference API is available.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Haversine distance between two lat/lng points (meters).
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Token overlap similarity (Jaccard-style).
 * Replaced by SBERT cosine similarity when model is connected.
 */
function computeTextSimilarity(textA, textB) {
  const tokenize = (t) =>
    new Set(
      t
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  let intersection = 0;
  setA.forEach((w) => { if (setB.has(w)) intersection++; });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

const DUPLICATE_RADIUS_METERS = 400;
const SIMILARITY_THRESHOLD = 0.35;

/**
 * Check whether a new complaint is a duplicate of any existing active complaint.
 * @param {string} description - New complaint text
 * @param {object} location    - { latitude, longitude }
 * @param {Array}  existingComplaints - Array of Complaint documents from DB
 * @returns {object} DuplicateAnalysis result
 */
async function checkDuplicate(description, location, existingComplaints) {
  // Future: embed description with SBERT; compare cosine similarity against stored embeddings

  const active = existingComplaints.filter(
    (c) => !['CLOSED', 'REJECTED'].includes(c.status)
  );

  for (const existing of active) {
    const dist = haversineDistance(
      location.latitude,
      location.longitude,
      existing.location.latitude,
      existing.location.longitude
    );

    if (dist <= DUPLICATE_RADIUS_METERS) {
      const similarity = computeTextSimilarity(description, existing.description);

      if (similarity >= SIMILARITY_THRESHOLD) {
        return {
          isDuplicate: true,
          status: 'checked',
          method: 'keyword_overlap_haversine', // Will become 'sbert' when model connected
          similarComplaintId: existing.complaintId,
          similarityScore: parseFloat(Math.min(0.96, 0.5 + similarity).toFixed(2)),
          distanceMeters: dist,
          recommendation: `A similar active complaint (${existing.complaintId}) exists ~${dist}m away. You can upvote it or submit as a distinct complaint.`,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    status: 'checked',
    method: 'keyword_overlap_haversine',
    recommendation: 'No duplicate found within the search radius.',
  };
}

module.exports = { checkDuplicate, haversineDistance };

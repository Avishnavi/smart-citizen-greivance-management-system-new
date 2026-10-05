'use strict';

/**
 * Priority Prediction Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Research module: XGBoost / Gradient Boosting priority prediction.
 *
 * Current state: Deterministic rule engine (transparent, auditable).
 * Integration point: Replace with real XGBoost inference endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CATEGORY_BASE_SCORES = {
  Drainage: 25,
  'Water Supply': 22,
  Pothole: 18,
  Traffic: 15,
  Streetlight: 12,
  Garbage: 10,
  'Tree Fall': 10,
  'Stray Animals': 8,
  'Illegal Construction': 6,
  'Air & Noise': 5,
  Other: 5,
};

const URGENCY_KEYWORDS = [
  { keywords: ['danger', 'hazard', 'unsafe', 'risk', 'accident', 'emergency'], score: 20 },
  { keywords: ['overflow', 'flooding', 'flood'], score: 18 },
  { keywords: ['hospital', 'school', 'child', 'elderly', 'senior'], score: 15 },
  { keywords: ['severe', 'major', 'critical', 'urgent', 'immediate'], score: 12 },
  { keywords: ['blocked', 'complete', 'totally', 'entire street'], score: 8 },
];

const HIGH_FOOTFALL_KEYWORDS = [
  'main road', 'avenue', 'bus stand', 'junction', 'market', 'station',
  'roundtana', 'arterial', 'highway',
];

/**
 * Predict complaint priority using a rule-based scoring engine.
 * @param {string} category
 * @param {string} description
 * @param {object} location
 * @param {boolean} hasMedia
 * @returns {{ priority, score, factors, method }}
 */
async function predictPriority(category, description, location, hasMedia = false) {
  // Future: POST /ml/predict-priority { category, description, location, hasMedia }

  const lower = description.toLowerCase();
  let score = 30; // Baseline
  const factors = [];

  // 1. Category-based score
  const categoryScore = CATEGORY_BASE_SCORES[category] ?? 5;
  score += categoryScore;
  if (categoryScore >= 15) factors.push(`${category} — Critical Infrastructure`);

  // 2. Urgency keywords
  for (const rule of URGENCY_KEYWORDS) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      score += rule.score;
      factors.push('Urgency / Safety Hazard Indicators Detected');
      break; // Only count once for the highest matched group
    }
  }

  // 3. High-footfall location
  if (HIGH_FOOTFALL_KEYWORDS.some((kw) => lower.includes(kw))) {
    score += 12;
    factors.push('High-Footfall Arterial / Transit Corridor');
  }

  // 4. Media evidence
  if (hasMedia) {
    score += 5;
    factors.push('Visual / Audio Evidence Submitted');
  }

  score = Math.min(98, Math.max(20, score));

  const priority = score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';

  return {
    priority,
    score,
    factors: factors.length > 0 ? factors : ['Standard Citizen Grievance SLA'],
    method: 'rule_based', // Will become 'xgboost' when model connected
    status: 'completed',
  };
}

module.exports = { predictPriority };

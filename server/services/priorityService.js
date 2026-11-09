'use strict';

/**
 * Priority Estimation Service (M5 – Explainable Priority Recommendation)
 * ─────────────────────────────────────────────────────────────────────────────
 * Transparent 4-factor scoring engine that estimates grievance priority.
 *
 * Scoring Rubric (Total Maximum: 100 points):
 * 1. Public Safety Risk & Immediate Hazard        (Max: 35 pts)
 * 2. Essential Public Infrastructure Criticality  (Max: 25 pts)
 * 3. Affected Population & Critical Facilities   (Max: 20 pts)
 * 4. Persistence, Progression & Escalation        (Max: 20 pts)
 *
 * Guarantees:
 * - Exactly 4 orthogonal factors that sum to at most 100 points.
 * - No unexplained baseline or fixed offset additions.
 * - Media presence is treated as evidentiary proof, NOT an urgency multiplier.
 * - Maps score (0-100) to standard municipal tiers: LOW, MEDIUM, HIGH, CRITICAL.
 * - Explicitly identified as an explainable heuristic scoring engine (not trained ML).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CATEGORY_BASE_WEIGHTS = {
  Drainage: 25,               // Severe contamination / wastewater overflow
  'Water Supply': 22,         // Vital life-sustaining utility network
  Pothole: 18,                // Vehicular accident and road hazard
  Traffic: 15,                // Arterial gridlock and transit delay
  Streetlight: 12,            // Nighttime pedestrian visibility and safety
  Garbage: 10,                // Vector-borne hygiene risk
  'Tree Fall': 10,            // Route obstruction / storm hazard
  'Stray Animals': 8,         // Animal bite hazard and public space safety
  'Illegal Construction': 6,  // Zoning and footpath obstruction
  'Air & Noise': 5,           // Environmental health
  Other: 5,                   // Unclassified civic requests
};

// Factor 1: Safety hazard signals (English, Tamil Unicode, Tanglish)
const LIFE_SAFETY_SIGNALS = [
  'accident', 'emergency', 'danger', 'hazard', 'sparking', 'live wire', 'shock',
  'death', 'casualty', 'drowning', 'toxic', 'collapsed', 'fire', 'explosion',
  'ஆபத்து', 'விபத்து', 'உயிருக்கு ஆபத்து',
  'aabathu', 'uyir aabathu', 'accident aachu', 'periya risk', 'spark varuthu'
];

// Factor 3: Vulnerable healthcare & educational facilities
const HEALTHCARE_FACILITIES = [
  'hospital', 'clinic', 'nursing home', 'maternity', 'ambulance', 'ambulances', 'ambulance route',
  'மருத்துவமனை', 'maruthuvamanai'
];

const EDUCATIONAL_FACILITIES = [
  'school', 'college', 'kindergarten', 'creche', 'elderly', 'senior citizen',
  'பள்ளி', 'school kitta'
];

const HIGH_FOOTFALL_CORRIDORS = [
  'main road', 'arterial', 'avenue', 'bus stand', 'bus stop', 'metro station',
  'railway station', 'junction', 'signal', 'market', 'bazaar', 'highway',
  'பேருந்து நிலையம்', 'ரயில் நிலையம்',
  'roundtana', 'signal kitta', 'main salai'
];

// Factor 4: Persistence signals
const CHRONIC_PERSISTENCE_SIGNALS = [
  'days', 'weeks', 'month', 'months', 'repeated', 'already complained', 'worsening',
  'spreading', 'completely blocked', 'entire street', 'submerged',
  'பல நாட்கள்', 'ஒரு வாரமாக',
  'romba naala', 'oru varama', 'worse aaguthu', 'full block'
];

/**
 * Predict priority using an explainable 4-factor heuristic scoring engine.
 *
 * @param {string} category - Complaint category
 * @param {string} description - Complaint description
 * @param {object} location - Location metadata
 * @param {boolean} hasMedia - Whether photo/audio evidence was uploaded
 * @returns {Promise<object>} Priority assessment result
 */
async function predictPriority(category, description, location = {}, hasMedia = false) {
  const textLower = (description || '').toLowerCase();
  const factors = [];
  const scoreBreakdown = {};

  // ── Factor 1: Public Safety Risk & Immediate Hazard (Max: 35 pts) ─────────
  let safetyScore = 0;
  const matchedSafety = LIFE_SAFETY_SIGNALS.filter((kw) => textLower.includes(kw));
  if (matchedSafety.length >= 2) {
    safetyScore = 35;
    factors.push(`Severe Public Safety Threat: multiple hazard signals detected (${matchedSafety.slice(0, 2).join(', ')}) [+35 pts]`);
  } else if (matchedSafety.length === 1) {
    safetyScore = 22;
    factors.push(`Safety Hazard Risk Detected (${matchedSafety[0]}) [+22 pts]`);
  }
  scoreBreakdown.publicSafetyHazard = safetyScore;

  // ── Factor 2: Essential Public Infrastructure Criticality (Max: 25 pts) ───
  const baseCategoryScore = CATEGORY_BASE_WEIGHTS[category] ?? 5;
  scoreBreakdown.infrastructureCriticality = baseCategoryScore;
  factors.push(`Infrastructure Domain Weight (${category}) [+${baseCategoryScore} pts]`);

  // ── Factor 3: Impact on Critical Facilities & Transit (Max: 20 pts) ────────
  let facilityScore = 0;
  const matchedHospital = HEALTHCARE_FACILITIES.filter((kw) => textLower.includes(kw));
  const matchedSchool = EDUCATIONAL_FACILITIES.filter((kw) => textLower.includes(kw));
  const matchedCorridor = HIGH_FOOTFALL_CORRIDORS.filter((kw) => textLower.includes(kw));

  if (matchedHospital.length > 0) {
    facilityScore = 20; // Critical medical facility
    factors.push(`Proximity to Healthcare Facility / Ambulance Route (${matchedHospital[0]}) [+20 pts]`);
  } else if (matchedSchool.length > 0) {
    facilityScore = 15; // School zone
    factors.push(`Proximity to Educational / Child Zone (${matchedSchool[0]}) [+15 pts]`);
  } else if (matchedCorridor.length > 0) {
    facilityScore = 10; // Transit corridor
    factors.push(`High-Footfall Arterial Transit Route (${matchedCorridor[0]}) [+10 pts]`);
  }
  scoreBreakdown.facilityAndTransitImpact = facilityScore;

  // ── Factor 4: Persistence, Escalation Risk & Duration (Max: 20 pts) ────────
  let persistenceScore = 0;
  const matchedPersistence = CHRONIC_PERSISTENCE_SIGNALS.filter((kw) => textLower.includes(kw));
  if (matchedPersistence.length >= 2) {
    persistenceScore = 20;
    factors.push(`Chronic / Widespread Civic Degradation: multiple duration signals [+20 pts]`);
  } else if (matchedPersistence.length === 1) {
    persistenceScore = 12;
    factors.push(`Persistent Issue (${matchedPersistence[0]}) [+12 pts]`);
  }
  scoreBreakdown.persistenceAndDuration = persistenceScore;

  // Total Score: Pure sum of exactly 4 factors, strictly bounded [0, 100]
  const rawScore = safetyScore + baseCategoryScore + facilityScore + persistenceScore;
  const finalScore = Math.min(100, Math.max(0, rawScore));

  // ── Map Score to SLA Tiers ─────────────────────────────────────────────────
  let priority = 'MEDIUM';
  let slaHours = 72;

  if (finalScore >= 80) {
    priority = 'CRITICAL';
    slaHours = 6;
  } else if (finalScore >= 60) {
    priority = 'HIGH';
    slaHours = 24;
  } else if (finalScore >= 35) {
    priority = 'MEDIUM';
    slaHours = 72;
  } else {
    priority = 'LOW';
    slaHours = 120;
  }

  // Flag boundary scores or CRITICAL issues for administrative review
  const isNearBoundary =
    (finalScore >= 77 && finalScore <= 82) ||
    (finalScore >= 57 && finalScore <= 62) ||
    (finalScore >= 32 && finalScore <= 37);

  const needsAdminReview = isNearBoundary || priority === 'CRITICAL';

  const priorityReason = factors.join('; ');

  return {
    priority,
    score: finalScore,
    slaHours,
    factors,
    scoreBreakdown,
    priorityReason,
    needsAdminReview,
    evidenceInfo: {
      hasSupportingEvidence: Boolean(hasMedia),
      note: hasMedia
        ? 'Visual or acoustic evidence attached; preserved for audit verification.'
        : 'No media evidence attached.',
    },
    method: 'explainable_weighted_heuristic',
    status: 'completed',
  };
}

module.exports = {
  predictPriority,
  CATEGORY_BASE_WEIGHTS,
  LIFE_SAFETY_SIGNALS,
};

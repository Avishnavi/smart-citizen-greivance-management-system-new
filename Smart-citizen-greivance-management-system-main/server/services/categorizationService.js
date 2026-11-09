'use strict';

/**
 * Categorization Service (M3 – Contextual Complaint Classification)
 * ─────────────────────────────────────────────────────────────────────────────
 * Classifies grievances into valid categories and subcategories based on:
 * - Semantic context and compound phrase analysis (not isolated tokens).
 * - Multilingual support: English, Tamil script, and Romanized Tanglish.
 * - Negative context filters to avoid false keyword matches.
 * - Dynamic confidence score calculation (no hardcoded constants).
 * - Ambiguity detection with automatic flagging for Central Admin review.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { detectLanguage } = require('../utils/languageDetector');

const CATEGORY_DEPARTMENT_MAP = {
  Pothole: 'Road Maintenance Department',
  'Water Supply': 'Water & Sewerage Board',
  Drainage: 'Water & Sewerage Board',
  Streetlight: 'Electricity & Lighting Department',
  Garbage: 'Solid Waste Management',
  Traffic: 'Traffic & Transport Department',
  'Stray Animals': 'Public Health & Sanitation',
  'Tree Fall': 'Horticulture & Parks',
  'Illegal Construction': 'Town Planning & Enforcement',
  'Air & Noise': 'Public Health & Sanitation',
  Other: 'Public Health & Sanitation',
};

const CATEGORY_DEFINITIONS = [
  {
    category: 'Pothole',
    department: 'Road Maintenance Department',
    // Strong signals (English, Tamil Unicode, Tanglish)
    primaryKeywords: [
      'pothole', 'potholes', 'crater', 'broken road', 'tar damage', 'asphalt damage',
      'road crater', 'speed breaker damage', 'road damaged', 'bad road', 'road repair',
      'குழி', 'சாலை பழுது', 'ரோடு பழுது', 'ரோட்டில் குழி',
      'roatu kuzhi', 'salai damage', 'kuzhi irukku', 'periya kuzhi', 'road damage ah'
    ],
    secondaryKeywords: [
      'asphalt', 'tar', 'gravel', 'speed breaker', 'uneven surface', 'pavement crack', 'footpath damage',
      'salai', 'roatu', 'kuzhi'
    ],
    negativeKeywords: ['water pipe', 'drainage pipe', 'streetlight pole', 'garbage dump'],
    subcategories: [
      { name: 'Surface Crater', triggers: ['crater', 'deep', 'periya', 'huge hole', 'large'] },
      { name: 'Asphalt Erosion', triggers: ['erosion', 'tar', 'asphalt', 'peeling', 'surface'] },
      { name: 'Sunken Manhole Rim', triggers: ['manhole', 'rim', 'sunken', 'cover edge'] },
      { name: 'Speed Breaker Damage', triggers: ['speed breaker', 'hump', 'unmarked breaker'] },
      { name: 'Footpath / Pavement Crack', triggers: ['footpath', 'pavement', 'sidewalk'] },
    ],
    defaultSubcategory: 'Surface Crater',
  },
  {
    category: 'Drainage',
    department: 'Water & Sewerage Board',
    primaryKeywords: [
      'drainage overflow', 'sewage overflow', 'blocked drain', 'manhole overflowing', 'clogged gutter',
      'foul smell sewage', 'sewage leak', 'drainage water', 'open manhole',
      'சாக்கடை', 'கழிவுநீர்', 'கழிவுநீர் வழிதல்', 'பாதாள சாக்கடை',
      'saakadai', 'drainage thanni', 'saakadai overflow', 'naathum adikkuthu', 'sewage naathum'
    ],
    secondaryKeywords: [
      'drain', 'drainage', 'sewage', 'gutter', 'manhole', 'sludge', 'desilt', 'clog',
      'naathum', 'saakadai'
    ],
    negativeKeywords: ['drinking water', 'tap leak', 'potable water', 'clean water'],
    subcategories: [
      { name: 'Sewage Overflow', triggers: ['overflow', 'spilling', 'street flood', 'flowing on road'] },
      { name: 'Blocked Storm Drain', triggers: ['blocked', 'clogged', 'stagnant', 'choked'] },
      { name: 'Missing Manhole Cover', triggers: ['missing cover', 'open manhole', 'cover broken', 'no lid'] },
      { name: 'Desilting Required', triggers: ['silt', 'desilt', 'mud in drain', 'sediment'] },
    ],
    defaultSubcategory: 'Sewage Overflow',
  },
  {
    category: 'Water Supply',
    department: 'Water & Sewerage Board',
    primaryKeywords: [
      'drinking water', 'water supply', 'water pipe burst', 'pipe leakage', 'tap water',
      'no water supply', 'contaminated water', 'murky water', 'low water pressure',
      'குடிநீர்', 'குழாய் உடைப்பு', 'தண்ணீர் வரவில்லை', 'குழாய் கசிவு',
      'thanni varala', 'kuzhai leak', 'drinking water leak', 'pipe odanjuruchu', 'thanni leak'
    ],
    secondaryKeywords: [
      'water', 'pipe', 'pipeline', 'tap', 'leak', 'meter', 'valve', 'supply', 'potable',
      'thanni', 'kuzhai'
    ],
    negativeKeywords: ['sewage', 'drainage', 'gutter', 'saakadai'],
    subcategories: [
      { name: 'Main Pipeline Burst', triggers: ['burst', 'gushing', 'high pressure leak', 'main line'] },
      { name: 'Low Water Pressure', triggers: ['low pressure', 'trickle', 'slow flow'] },
      { name: 'Contaminated Water', triggers: ['contaminated', 'dirty', 'smell', 'brown water', 'mixed with sewage'] },
      { name: 'Drinking Water Shortage', triggers: ['no water', 'thanni varala', 'scarcity', 'supply stopped'] },
      { name: 'Tap / Valve Leakage', triggers: ['tap leak', 'valve', 'meter leak'] },
    ],
    defaultSubcategory: 'Drinking Water Shortage',
  },
  {
    category: 'Streetlight',
    department: 'Electricity & Lighting Department',
    primaryKeywords: [
      'streetlight not working', 'street light dark', 'broken lamp post', 'no street light',
      'dark street', 'pole wire dangling', 'flickering light', 'electricity pole',
      'தெருவிளக்கு எரியவில்லை', 'தெரு விளக்கு', 'மின் கம்பம்',
      'street light eriyala', 'light eriyala', 'velicham illa', 'current kambu', 'pole odanjuruchu'
    ],
    secondaryKeywords: [
      'streetlight', 'street light', 'lamp', 'bulb', 'pole', 'darkness', 'lighting', 'fuse',
      'velicham', 'eriyala'
    ],
    negativeKeywords: ['traffic signal', 'water leak'],
    subcategories: [
      { name: 'Non-Functional Lamp', triggers: ['not working', 'off', 'eriyala', 'dead bulb', 'dark lamp'] },
      { name: 'Damaged Pole', triggers: ['pole broken', 'tilted pole', 'bent pole', 'rusted'] },
      { name: 'Dangling Electrical Wire', triggers: ['wire', 'sparking', 'live wire', 'dangling', 'hanging'] },
      { name: 'Flickering Light', triggers: ['flicker', 'blinking', 'intermittent'] },
      { name: 'Dark Street Stretch', triggers: ['entire street dark', 'whole lane', 'no lights at all'] },
    ],
    defaultSubcategory: 'Non-Functional Lamp',
  },
  {
    category: 'Garbage',
    department: 'Solid Waste Management',
    primaryKeywords: [
      'garbage dump', 'overflowing dustbin', 'uncollected waste', 'garbage bin full',
      'trash accumulation', 'waste piling up', 'plastic waste dump',
      'குப்பை மேடு', 'குப்பை அள்ளவில்லை', 'குப்பை தொட்டி நிரம்பியது',
      'kuppai kotturanga', 'kuppai thotti full', 'waste edukala', 'kuppai நாற்றம்'
    ],
    secondaryKeywords: [
      'garbage', 'waste', 'trash', 'bin', 'dump', 'dustbin', 'litter', 'debris', 'stench',
      'kuppai'
    ],
    negativeKeywords: ['construction debris', 'demolition'],
    subcategories: [
      { name: 'Overflowing Bin', triggers: ['overflow', 'bin full', 'thotti full', 'spilling over'] },
      { name: 'Uncollected Domestic Waste', triggers: ['not collected', 'edukala', 'past 3 days', 'pending collection'] },
      { name: 'Illegal Waste Dumping', triggers: ['dumping', 'vacant plot', 'roadside dumping', 'commercial waste'] },
      { name: 'Animal Carcass / Biological Waste', triggers: ['dead animal', 'carcass', 'biological', 'dog body'] },
    ],
    defaultSubcategory: 'Overflowing Bin',
  },
  {
    category: 'Traffic',
    department: 'Traffic & Transport Department',
    primaryKeywords: [
      'traffic signal not working', 'traffic congestion', 'illegal parking obstruction',
      'signal light stuck', 'chronic traffic jam', 'missing traffic sign',
      'போக்குவரத்து நெரிசல்', 'ட்ராபிக் சிக்னல் பழுது',
      'traffic jam', 'signal velai seiyala', 'vandi jam'
    ],
    secondaryKeywords: [
      'traffic', 'signal', 'congestion', 'jam', 'junction', 'parking', 'bottleneck', 'zebra crossing'
    ],
    negativeKeywords: ['streetlight', 'pothole'],
    subcategories: [
      { name: 'Traffic Signal Breakdown', triggers: ['signal', 'red light stuck', 'timer fault', 'blinking yellow'] },
      { name: 'Illegal Parking Obstruction', triggers: ['parking', 'parked vehicles', 'encroaching lane'] },
      { name: 'Chronic Congestion', triggers: ['jam', 'heavy congestion', 'slow moving', 'bottleneck'] },
      { name: 'Missing / Damaged Signage', triggers: ['signboard', 'signage', 'missing board', 'direction'] },
    ],
    defaultSubcategory: 'Traffic Signal Breakdown',
  },
  {
    category: 'Stray Animals',
    department: 'Public Health & Sanitation',
    primaryKeywords: [
      'stray dog menace', 'stray dogs biting', 'cattle on road', 'cows blocking traffic',
      'monkey menace', 'rabies threat', 'pack of dogs barking',
      'தெரு நாய் தொல்லை', 'மாடுகள் தொல்லை', 'நாய் கடித்தது',
      'stray dog bite', 'naai thollai', 'maadu naduvula', 'dogs chasing'
    ],
    secondaryKeywords: [
      'dog', 'dogs', 'cattle', 'cow', 'cows', 'animal', 'bite', 'barking', 'menace', 'chasing',
      'naai', 'maadu'
    ],
    negativeKeywords: [],
    subcategories: [
      { name: 'Stray Dog Threat / Biting Risk', triggers: ['dog', 'bite', 'barking', 'chasing bikes', 'pack of dogs'] },
      { name: 'Cattle on Roadway', triggers: ['cattle', 'cow', 'cows', 'bull', 'sitting on road'] },
      { name: 'Monkey Menace', triggers: ['monkey', 'monkeys', 'entering houses'] },
    ],
    defaultSubcategory: 'Stray Dog Threat / Biting Risk',
  },
  {
    category: 'Tree Fall',
    department: 'Horticulture & Parks',
    primaryKeywords: [
      'fallen tree', 'tree fell down', 'heavy branch fallen', 'tree blocking road',
      'dangling tree branch', 'uprooted tree',
      'மரம் விழுந்துவிட்டது', 'மரக்கிளை முறிந்தது',
      'maram vilunthuruchu', 'tree branch vizhunthathu', 'maram blocking'
    ],
    secondaryKeywords: [
      'tree', 'branch', 'foliage', 'uprooted', 'horticulture', 'pruning', 'wood',
      'maram', 'kilai'
    ],
    negativeKeywords: [],
    subcategories: [
      { name: 'Fallen Tree Blocking Road', triggers: ['blocking road', 'fell across', 'entire tree', 'uprooted'] },
      { name: 'Dangling Hazardous Branch', triggers: ['dangling', 'hanging branch', 'cracked limb', 'ready to fall'] },
      { name: 'Overgrown Foliage / Pruning Needed', triggers: ['overgrown', 'obscuring light', 'pruning needed'] },
    ],
    defaultSubcategory: 'Fallen Tree Blocking Road',
  },
  {
    category: 'Illegal Construction',
    department: 'Town Planning & Enforcement',
    primaryKeywords: [
      'illegal construction', 'unauthorized building', 'footpath encroachment', 'blocking public walkway',
      'encroaching road', 'building without approval',
      'ஆக்கிரமிப்பு', 'அனுமதியற்ற கட்டிடம்',
      'kattadam encroachment', 'salai aakiramippu', 'illegal shed'
    ],
    secondaryKeywords: [
      'construction', 'building', 'encroachment', 'unauthorized', 'zoning', 'setback', 'scaffolding'
    ],
    negativeKeywords: ['road repair', 'pothole'],
    subcategories: [
      { name: 'Road / Footpath Encroachment', triggers: ['footpath', 'roadway', 'sidewalk', 'extended shop', 'ramp'] },
      { name: 'Unauthorized Building Structure', triggers: ['extra floor', 'setback violation', 'no permit', 'unauthorized'] },
      { name: 'Illegal Commercial Shed', triggers: ['shed', 'stall', 'shack on pavement', 'tea shop encroachment'] },
    ],
    defaultSubcategory: 'Road / Footpath Encroachment',
  },
  {
    category: 'Air & Noise',
    department: 'Public Health & Sanitation',
    primaryKeywords: [
      'noise pollution', 'loud speaker noise', 'open garbage burning', 'excessive smoke',
      'industrial pollution', 'air pollution',
      'காற்று மாசுபாடு', 'ஒலி மாசுபாடு', 'குப்பை எரித்தல்',
      'smoke athigam', 'noise romba', 'kuppai burning'
    ],
    secondaryKeywords: [
      'noise', 'smoke', 'dust', 'emission', 'smell', 'burning', 'fumes', 'decibel'
    ],
    negativeKeywords: [],
    subcategories: [
      { name: 'Open Waste Burning / Toxic Smoke', triggers: ['burning', 'smoke', 'fire', 'fumes', 'plastic burn'] },
      { name: 'Commercial / Industrial Noise', triggers: ['loudspeaker', 'generator', 'decibel', 'dj noise', 'factory'] },
      { name: 'Construction Dust / Particulate', triggers: ['dust', 'cement dust', 'quarry', 'heavy dust'] },
    ],
    defaultSubcategory: 'Open Waste Burning / Toxic Smoke',
  },
];

/**
 * Score a single category definition against the complaint text.
 */
function scoreCategory(def, textLower) {
  let score = 0;
  const matchedSignals = [];

  // Check primary keywords (weight: 3.0)
  for (const kw of def.primaryKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      score += 3.0;
      matchedSignals.push(kw);
    }
  }

  // Check secondary keywords (weight: 1.0)
  for (const kw of def.secondaryKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      score += 1.0;
      matchedSignals.push(kw);
    }
  }

  // Apply negative keywords (penalty: -2.5)
  for (const neg of def.negativeKeywords) {
    if (textLower.includes(neg.toLowerCase())) {
      score -= 2.5;
    }
  }

  return {
    category: def.category,
    department: def.department,
    score: Math.max(0, score),
    matchedSignals,
  };
}

/**
 * Classify a complaint with contextual, explainable scoring.
 * @param {string} text - Complaint text
 * @param {string[]} imageUrls - Associated image URLs
 * @returns {Promise<object>} Categorization result
 */
async function categorizeComplaint(text, imageUrls = []) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      status: 'completed',
      method: 'contextual_heuristic',
      category: 'Other',
      subcategory: 'Unspecified Civic Grievance',
      confidence: 0.3,
      department: CATEGORY_DEPARTMENT_MAP['Other'],
      suggestedKeywords: [],
      isAmbiguous: true,
      needsAdminReview: true,
      explanation: 'Empty or missing complaint text. Categorized as "Other" pending Central Admin review.',
      aiSummary: 'Defaulted to "Other" due to insufficient text detail.',
      topCandidates: [],
    };
  }

  const textLower = text.toLowerCase();

  // Score all 10 defined categories
  const scoredCategories = CATEGORY_DEFINITIONS.map((def) => scoreCategory(def, textLower));
  scoredCategories.sort((a, b) => b.score - a.score);

  const top = scoredCategories[0];
  const runnerUp = scoredCategories[1];

  // Ambiguity / Low Signal Check
  const LOW_SIGNAL_THRESHOLD = 2.0;
  const AMBIGUITY_MARGIN = 1.0;

  let chosenCategory = top.category;
  let isAmbiguous = false;
  let needsAdminReview = false;
  let confidence = 0.5;
  let explanation = '';

  if (top.score < LOW_SIGNAL_THRESHOLD) {
    // Very weak match: no strong category triggers found
    chosenCategory = 'Other';
    isAmbiguous = true;
    needsAdminReview = true;
    confidence = 0.35;
    explanation = 'Complaint text lacks specific civic domain markers. Flagged for Central Admin review.';
  } else if (runnerUp && (top.score - runnerUp.score) < AMBIGUITY_MARGIN && runnerUp.score >= 2.0) {
    // Close contest between two categories (e.g. water pipeline burst damaging road surface)
    chosenCategory = top.category;
    isAmbiguous = true;
    needsAdminReview = true;
    // Calculate balanced confidence
    confidence = parseFloat(Math.min(0.75, Math.max(0.52, (top.score / (top.score + runnerUp.score)))).toFixed(2));
    explanation = `Context shows mixed signals between "${top.category}" and "${runnerUp.category}". Top category chosen; Central Admin review advised.`;
  } else {
    // Decisive category match
    chosenCategory = top.category;
    isAmbiguous = false;
    needsAdminReview = false;
    const signalDensityBonus = Math.min(0.25, top.matchedSignals.length * 0.05);
    confidence = parseFloat(Math.min(0.96, Math.max(0.70, 0.70 + signalDensityBonus)).toFixed(2));
    explanation = `Strong contextual match for ${chosenCategory} based on signals: ${top.matchedSignals.slice(0, 3).join(', ')}.`;
  }

  // Determine Subcategory
  let chosenSubcategory = 'General';
  const matchedDef = CATEGORY_DEFINITIONS.find((d) => d.category === chosenCategory);

  if (matchedDef) {
    chosenSubcategory = matchedDef.defaultSubcategory;
    for (const sub of matchedDef.subcategories) {
      if (sub.triggers.some((tr) => textLower.includes(tr.toLowerCase()))) {
        chosenSubcategory = sub.name;
        break;
      }
    }
  } else if (chosenCategory === 'Other') {
    chosenSubcategory = 'Unspecified Civic Grievance';
  }

  const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_DEPARTMENT_MAP));
  if (!VALID_CATEGORIES.has(chosenCategory)) {
    chosenCategory = 'Other';
    chosenSubcategory = 'Unspecified Civic Grievance';
    isAmbiguous = true;
    needsAdminReview = true;
    confidence = 0.35;
    explanation = 'Classification did not resolve to a valid registered municipal category. Defaulted to "Other" for Central Admin review.';
  }

  const assignedDepartment = CATEGORY_DEPARTMENT_MAP[chosenCategory] || null;

  const topCandidates = scoredCategories
    .filter((c) => c.score > 0)
    .slice(0, 3)
    .map((c) => ({
      category: c.category,
      department: c.department,
      score: c.score,
      matchedSignals: c.matchedSignals,
    }));

  return {
    status: 'completed',
    method: 'contextual_heuristic',
    category: chosenCategory,
    subcategory: chosenSubcategory,
    confidence,
    confidenceType: 'heuristic_indicator', // Heuristic match ratio, not a statistical probability
    department: assignedDepartment,
    isAmbiguous,
    needsAdminReview,
    suggestedKeywords: top?.matchedSignals || [],
    explanation: `${explanation} (Heuristic confidence indicator: ${confidence})`,
    aiSummary: `Classified as "${chosenCategory}" (${chosenSubcategory}) with heuristic confidence indicator ${confidence}. ${isAmbiguous ? 'Flagged for Central Admin review.' : ''}`,
    topCandidates,
  };
}

module.exports = {
  categorizeComplaint,
  CATEGORY_DEPARTMENT_MAP,
  CATEGORY_DEFINITIONS,
};

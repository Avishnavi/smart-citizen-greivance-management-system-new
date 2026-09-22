'use strict';

/**
 * Categorization Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Research module: XLM-RoBERTa / Multilingual NLU for complaint classification.
 *
 * Current state: Rule-based deterministic classifier (transparent, not random).
 * Integration point: Replace `classifyWithRules` with a real LLM API call when
 * the model is available (see llmService.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

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

const KEYWORD_RULES = [
  {
    category: 'Pothole',
    keywords: ['pothole', 'road', 'asphalt', 'crater', 'tar', 'speed breaker', 'broken road'],
    confidence: 0.96,
    keywords_output: ['road damage', 'pothole', 'surface depression', 'traffic hazard'],
  },
  {
    category: 'Drainage',
    keywords: ['sewage', 'drain', 'gutter', 'manhole', 'overflow', 'clog', 'foul', 'blocked drain'],
    confidence: 0.93,
    keywords_output: ['sewage overflow', 'drainage blockage', 'sanitation', 'manhole'],
  },
  {
    category: 'Streetlight',
    keywords: ['light', 'lamp', 'dark', 'electricity', 'pole', 'streetlight', 'no light'],
    confidence: 0.95,
    keywords_output: ['public lighting', 'dark street', 'pole fixture', 'pedestrian safety'],
  },
  {
    category: 'Water Supply',
    keywords: ['water', 'pipe', 'leak', 'drinking water', 'tap', 'contamination', 'supply'],
    confidence: 0.91,
    keywords_output: ['water supply', 'pipe leakage', 'distribution loss', 'scarcity'],
  },
  {
    category: 'Garbage',
    keywords: ['garbage', 'waste', 'trash', 'bin', 'dump', 'plastic', 'debris', 'litter'],
    confidence: 0.94,
    keywords_output: ['solid waste', 'bin overflow', 'littering', 'civic cleanliness'],
  },
  {
    category: 'Traffic',
    keywords: ['traffic', 'signal', 'parking', 'jam', 'congestion', 'accident', 'junction'],
    confidence: 0.89,
    keywords_output: ['traffic management', 'signal glitch', 'congestion', 'road safety'],
  },
  {
    category: 'Stray Animals',
    keywords: ['dog', 'cattle', 'cow', 'animal', 'bite', 'stray', 'monkeys'],
    confidence: 0.92,
    keywords_output: ['stray animal control', 'public safety', 'animal welfare'],
  },
  {
    category: 'Tree Fall',
    keywords: ['tree', 'branch', 'fallen', 'park', 'greenery', 'storm tree', 'uprooted'],
    confidence: 0.95,
    keywords_output: ['tree branch clearance', 'horticulture', 'storm debris'],
  },
  {
    category: 'Illegal Construction',
    keywords: ['building', 'construction', 'encroachment', 'illegal', 'unauthorized'],
    confidence: 0.87,
    keywords_output: ['unauthorized construction', 'encroachment', 'zoning violation'],
  },
  {
    category: 'Air & Noise',
    keywords: ['noise', 'pollution', 'dust', 'smoke', 'emission', 'smog', 'air quality'],
    confidence: 0.88,
    keywords_output: ['air pollution', 'noise complaint', 'environmental health'],
  },
];

/**
 * Classify a complaint text using deterministic keyword rules.
 * This will be replaced with an LLM API call when the model is configured.
 */
function classifyWithRules(text) {
  const lower = text.toLowerCase();

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      const dept = CATEGORY_DEPARTMENT_MAP[rule.category];
      return {
        status: 'completed',
        method: 'rule_based', // Will be 'llm' when real model is connected
        category: rule.category,
        confidence: rule.confidence,
        department: dept,
        suggestedKeywords: rule.keywords_output,
        aiSummary: `Classified as "${rule.category}" under "${dept}" (rule-based, ${Math.round(rule.confidence * 100)}% match). LLM module pending integration.`,
      };
    }
  }

  return {
    status: 'completed',
    method: 'rule_based',
    category: 'Other',
    confidence: 0.6,
    department: CATEGORY_DEPARTMENT_MAP['Other'],
    suggestedKeywords: [],
    aiSummary: 'Could not determine specific category. Defaulted to "Other". LLM analysis pending.',
  };
}

/**
 * Main exported function — orchestration layer.
 * When llmService is configured, this will call the real LLM first
 * and fall back to rule-based only on failure.
 */
async function categorizeComplaint(text, imageUrls = []) {
  // Future: const llm = require('./llmService');
  // Future: if (llm.isConfigured()) return await llm.classify(text, imageUrls);

  const result = classifyWithRules(text);
  return result;
}

module.exports = { categorizeComplaint, CATEGORY_DEPARTMENT_MAP };

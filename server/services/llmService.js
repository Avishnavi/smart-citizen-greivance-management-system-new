'use strict';

/**
 * LLM Service (M2 – Intelligent Complaint Understanding)
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides structured complaint understanding via:
 * 1. LLM API (Google Gemini / OpenAI compatible) if configured.
 * 2. Transparent Heuristic Fallback Parser if LLM is unconfigured or fails.
 *
 * Guarantees:
 * - Always preserves original citizen input.
 * - Distinguishes directly extracted facts from inferred properties.
 * - Never pretends LLM succeeded when running on fallback heuristic.
 * - Returns a strictly validated structured output schema.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { detectLanguage } = require('../utils/languageDetector');

function isConfigured() {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_PROVIDER);
}

/**
 * Validate and sanitize structured analysis output.
 * @param {object} raw
 * @param {string} originalText
 * @returns {object} Validated structured object
 */
function validateAnalysisResult(raw, originalText) {
  const summary = (typeof raw?.summary === 'string' && raw.summary.trim())
    ? raw.summary.trim()
    : (originalText.slice(0, 150) + (originalText.length > 150 ? '...' : ''));

  const issueType = (typeof raw?.issueType === 'string' && raw.issueType.trim())
    ? raw.issueType.trim()
    : 'General Civic Grievance';

  const affectedService = (typeof raw?.affectedService === 'string' && raw.affectedService.trim())
    ? raw.affectedService.trim()
    : 'Public Municipal Infrastructure';

  const requestedAction = (typeof raw?.requestedAction === 'string' && raw.requestedAction.trim())
    ? raw.requestedAction.trim()
    : 'Inspect and resolve reported issue';

  const extractedLocation = (typeof raw?.extractedLocation === 'string' && raw.extractedLocation.trim())
    ? raw.extractedLocation.trim()
    : null;

  const urgencyIndicators = Array.isArray(raw?.urgencyIndicators)
    ? raw.urgencyIndicators.filter((x) => typeof x === 'string' && x.trim().length > 0)
    : [];

  const extractedEntities = Array.isArray(raw?.extractedEntities)
    ? raw.extractedEntities.filter((x) => typeof x === 'string' && x.trim().length > 0)
    : [];

  const contextualDetails = Array.isArray(raw?.contextualDetails)
    ? raw.contextualDetails.filter((x) => typeof x === 'string' && x.trim().length > 0)
    : [];

  const confidence = (typeof raw?.confidence === 'number' && !isNaN(raw.confidence))
    ? Math.max(0.1, Math.min(1.0, raw.confidence))
    : 0.75;

  return {
    summary,
    issueType,
    affectedService,
    requestedAction,
    extractedLocation,
    urgencyIndicators,
    extractedEntities,
    contextualDetails,
    confidence,
    extractedVsInferred: {
      extracted: {
        rawLocationString: extractedLocation,
        urgencyTokensFound: urgencyIndicators,
        entitiesIdentified: extractedEntities,
      },
      inferred: {
        issueType,
        affectedService,
        requestedAction,
      },
    },
  };
}

/**
 * Deterministic Heuristic Fallback Parser.
 * Operates on English, Tamil, and Tanglish text without external API calls.
 */
function extractWithHeuristics(text, imageUrls = []) {
  const lower = (text || '').toLowerCase();
  const langInfo = detectLanguage(text);

  // 1. Entity Extraction via civic domain lexicon
  const ENTITY_PATTERNS = [
    { entity: 'road surface / pavement', keywords: ['road', 'asphalt', 'tar', 'pavement', 'salai', 'roatu', 'footpath'] },
    { entity: 'pothole / crater', keywords: ['pothole', 'crater', 'kuzhi', 'hole', 'depression'] },
    { entity: 'drainage / manhole', keywords: ['drain', 'drainage', 'sewage', 'manhole', 'gutter', 'saakadai', 'kallikku'] },
    { entity: 'water pipeline', keywords: ['water pipe', 'pipeline', 'tap', 'drinking water', 'thanni', 'kuzhai'] },
    { entity: 'streetlight / electrical fixture', keywords: ['light', 'lamp', 'pole', 'streetlight', 'wire', 'cable', 'transformer', 'eriyala', 'velicham'] },
    { entity: 'garbage / waste bin', keywords: ['garbage', 'trash', 'waste', 'bin', 'dump', 'kuppai', 'debris'] },
    { entity: 'traffic / signal', keywords: ['traffic', 'signal', 'junction', 'congestion', 'parking'] },
    { entity: 'stray animals', keywords: ['dog', 'cattle', 'cow', 'naai', 'monkey', 'stray'] },
    { entity: 'tree / vegetation', keywords: ['tree', 'branch', 'maram', 'roots'] },
  ];

  const extractedEntities = [];
  for (const group of ENTITY_PATTERNS) {
    if (group.keywords.some((kw) => lower.includes(kw))) {
      extractedEntities.push(group.entity);
    }
  }

  // 2. Issue Type & Affected Service Mapping
  let issueType = 'General Civic Issue';
  let affectedService = 'Municipal Public Works';
  let requestedAction = 'Inspect and resolve';

  if (lower.includes('pothole') || lower.includes('kuzhi') || (lower.includes('road') && lower.includes('damage'))) {
    issueType = 'Road Surface Deterioration / Pothole Hazard';
    affectedService = 'Road Infrastructure & Traffic Safety';
    requestedAction = 'Pave asphalt and level road surface';
  } else if (lower.includes('sewage') || lower.includes('drain') || lower.includes('saakadai') || lower.includes('overflow')) {
    issueType = 'Drainage Blockage / Sewage Overflow';
    affectedService = 'Sanitation & Wastewater Management';
    requestedAction = 'Desilt drainage pipeline and clear sewage obstruction';
  } else if (lower.includes('water') && (lower.includes('leak') || lower.includes('supply') || lower.includes('varala'))) {
    issueType = 'Potable Water Supply Disruption / Pipeline Leak';
    affectedService = 'Public Water Supply Network';
    requestedAction = 'Inspect and repair pipeline connection';
  } else if (lower.includes('light') || lower.includes('lamp') || lower.includes('dark') || lower.includes('eriyala')) {
    issueType = 'Public Streetlight Non-Functional / Dark Stretch';
    affectedService = 'Public Lighting & Electrical Grid';
    requestedAction = 'Replace faulty lamp or repair electrical circuit';
  } else if (lower.includes('garbage') || lower.includes('trash') || lower.includes('kuppai')) {
    issueType = 'Solid Waste Accumulation / Uncollected Refuse';
    affectedService = 'Solid Waste Management & Hygiene';
    requestedAction = 'Deploy waste collection team and sanitize bin area';
  } else if (lower.includes('tree') || lower.includes('branch') || lower.includes('maram')) {
    issueType = 'Fallen Tree / Hazardous Overhanging Branch';
    affectedService = 'Horticulture & Urban Forestry';
    requestedAction = 'Cut and clear fallen tree branches from public way';
  } else if (lower.includes('dog') || lower.includes('stray') || lower.includes('naai')) {
    issueType = 'Stray Animal Public Threat';
    affectedService = 'Public Health & Veterinary Control';
    requestedAction = 'Dispatch animal control unit for inspection';
  }

  // 3. Location extraction from prepositions
  let extractedLocation = null;
  const locationRegex = /(?:near|opposite|opp|at|in|behind|beside|across|along)\s+([A-Za-z0-9\s,\.\-]+?)(?=\s+(?:causing|which|and|urgent|please|for|since|with|due)|$)/i;
  const locMatch = text.match(locationRegex);
  if (locMatch && locMatch[1] && locMatch[1].trim().length > 2) {
    extractedLocation = locMatch[1].trim();
  }

  // 4. Urgency Indicators
  const URGENCY_TERMS = [
    'danger', 'accident', 'hazard', 'emergency', 'unsafe', 'critical',
    'hospital', 'school', 'senior', 'child', 'severe', 'immediate',
    'risk', 'sparking', 'live wire', 'flood', 'flooding', 'aabathu'
  ];
  const urgencyIndicators = URGENCY_TERMS.filter((term) => lower.includes(term));

  // 5. Contextual Details
  const contextualDetails = [];
  if (lower.includes('hospital')) contextualDetails.push('Located along critical medical / hospital transit route');
  if (lower.includes('school')) contextualDetails.push('Located near school zone / child safety area');
  if (lower.includes('night') || lower.includes('dark')) contextualDetails.push('Poses pedestrian vulnerability during nighttime hours');
  if (lower.includes('overflow') || lower.includes('flood')) contextualDetails.push('High water-logging / public health hazard');
  if (imageUrls && imageUrls.length > 0) contextualDetails.push(`${imageUrls.length} photo evidence attached by citizen`);

  // 6. Summary generation (clean, factual)
  const cleanSummary = text.length > 120
    ? `${issueType}: ${text.slice(0, 115).trim()}...`
    : `${issueType}: ${text}`;

  const confidence = 0.78 + (extractedEntities.length * 0.04) + (urgencyIndicators.length * 0.03);

  return validateAnalysisResult({
    summary: cleanSummary,
    issueType,
    affectedService,
    requestedAction,
    extractedLocation,
    urgencyIndicators,
    extractedEntities: extractedEntities.length ? extractedEntities : ['Civic amenity'],
    contextualDetails,
    confidence: Math.min(0.88, parseFloat(confidence.toFixed(2))),
  }, text);
}

/**
 * Main exported function to analyze complaint.
 * Calls live LLM if configured, otherwise falls back to deterministic heuristic parsing.
 * @param {string} text - Complaint description
 * @param {string[]} imageUrls - Associated image URLs
 * @returns {Promise<object>} Structured complaint understanding result
 */
async function analyzeComplaint(text, imageUrls = []) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      status: 'failed',
      message: 'Complaint text is empty or invalid.',
      provider: null,
      result: null,
      method: 'none',
    };
  }

  // If LLM provider is not configured, transparently execute heuristic fallback
  if (!isConfigured()) {
    const heuristicResult = extractWithHeuristics(text, imageUrls);
    return {
      status: 'not_configured',
      message: 'LLM service not connected. Processed using deterministic civic understanding parser.',
      provider: null,
      method: 'heuristic_fallback',
      result: heuristicResult,
    };
  }

  // Attempt live LLM integration
  try {
    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    const apiKey = process.env.LLM_API_KEY;

    // Structured prompt ensuring JSON schema compliance
    const systemPrompt = `You are an expert municipal grievance understanding engine.
Analyze the following citizen complaint and return ONLY a valid JSON object matching this schema:
{
  "summary": "1-sentence factual summary",
  "issueType": "Specific civic fault",
  "affectedService": "Municipal department/infrastructure domain",
  "requestedAction": "Action citizen is seeking",
  "extractedLocation": "Explicit location or landmark mentioned, or null",
  "urgencyIndicators": ["array of explicit danger/hazard words"],
  "extractedEntities": ["array of physical objects/assets mentioned"],
  "contextualDetails": ["array of situational factors like school zone, hospital route"],
  "confidence": 0.95
}
Do not fabricate information. If location is not in the text, set extractedLocation to null.`;

    let parsedResponse = null;

    if (provider === 'gemini') {
      // Direct call to Gemini REST endpoint if apiKey present
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: `${systemPrompt}\n\nComplaint:\n"${text}"` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000), // 5-second timeout
      });

      if (res.ok) {
        const data = await res.json();
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          parsedResponse = JSON.parse(rawJsonText);
        }
      }
    } else if (provider === 'openai') {
      const url = 'https://api.openai.com/v1/chat/completions';
      const payload = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        const rawJsonText = data?.choices?.[0]?.message?.content;
        if (rawJsonText) {
          parsedResponse = JSON.parse(rawJsonText);
        }
      }
    }

    if (parsedResponse) {
      const validated = validateAnalysisResult(parsedResponse, text);
      return {
        status: 'completed',
        message: 'LLM analysis completed successfully.',
        provider,
        method: 'llm',
        result: validated,
      };
    }
  } catch (err) {
    console.warn('[llmService] Live LLM call failed or timed out. Falling back to heuristic parser:', err.message);
  }

  // Fallback to heuristic parser if live LLM failed or response was invalid
  const fallbackResult = extractWithHeuristics(text, imageUrls);
  return {
    status: 'completed',
    message: 'Processed using fallback civic understanding parser due to upstream LLM timeout/unavailability.',
    provider: process.env.LLM_PROVIDER || null,
    method: 'heuristic_fallback',
    result: fallbackResult,
  };
}

module.exports = {
  isConfigured,
  analyzeComplaint,
  extractWithHeuristics,
  validateAnalysisResult,
};

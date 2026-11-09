'use strict';

/**
 * Language Detector Utility (M1)
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects English, Tamil, and Tamil-English (Code-Mixed / Tanglish) input.
 * Preserves the exact original text and provides clean normalization.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Common Romanized Tamil / Tanglish words and stems
const TANGLISH_LEXICON = new Set([
  'romba', 'thanni', 'varala', 'eriyala', 'kuppai', 'kooda', 'salai', 'theru',
  'irukku', 'pannunga', 'mudiyala', 'veetula', 'vazhi', 'illai', 'seekiram',
  'kattadam', 'katturanga', 'naai', 'maram', 'vilunthu', 'odanjuruchu',
  'kuzhi', 'periya', 'chinna', 'velicham', 'naathum', 'saakadai', 'roatu',
  'edunga', 'paathingala', 'seri', 'panna', 'mudiyum', 'illama', 'aachu',
  'vandhu', 'solren', 'ungala', 'nalla', 'aabathu', 'apdiye', 'enga'
]);

// Common Tanglish suffix patterns: -ah, -la, -oda, -kitta, -ula
const TANGLISH_SUFFIX_REGEX = /\b\w+(?:ah|la|oda|kitta|ula|nu)\b/gi;

/**
 * Detect language of a given text.
 * @param {string} text - Raw input string
 * @returns {{ language: string, confidence: number, isCodeMixed: boolean, detectedScripts: string[], normalizedText: string }}
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      language: 'English',
      confidence: 0,
      isCodeMixed: false,
      detectedScripts: [],
      normalizedText: '',
    };
  }

  const raw = text.trim();
  // Normalize whitespace
  const normalizedText = raw.replace(/\s+/g, ' ');

  // Script detection
  const tamilChars = (normalizedText.match(/[\u0B80-\u0BFF]/g) || []).length;
  const latinChars = (normalizedText.match(/[a-zA-Z]/g) || []).length;
  const totalLetters = tamilChars + latinChars;

  const detectedScripts = [];
  if (tamilChars > 0) detectedScripts.push('Tamil');
  if (latinChars > 0) detectedScripts.push('Latin');

  // Case 1: Pure or overwhelmingly Tamil script
  if (totalLetters > 0 && tamilChars / totalLetters >= 0.75) {
    return {
      language: 'Tamil',
      confidence: Math.min(0.99, parseFloat((tamilChars / totalLetters).toFixed(2))),
      isCodeMixed: latinChars > 0,
      detectedScripts,
      normalizedText,
    };
  }

  // Case 2: Mixed scripts (both Tamil Unicode and Latin letters present)
  if (tamilChars > 3 && latinChars > 3) {
    return {
      language: 'Tamil-English (Code-Mixed)',
      confidence: 0.95,
      isCodeMixed: true,
      detectedScripts,
      normalizedText,
    };
  }

  // Case 3: Latin script with Tanglish tokens or suffixes
  const words = normalizedText.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean);
  let tanglishTokenMatches = 0;
  for (const w of words) {
    if (TANGLISH_LEXICON.has(w)) {
      tanglishTokenMatches++;
    }
  }

  const suffixMatches = (normalizedText.match(TANGLISH_SUFFIX_REGEX) || []).length;
  const totalTanglishSignals = tanglishTokenMatches + Math.floor(suffixMatches * 0.5);

  if (totalTanglishSignals >= 2 || (words.length <= 6 && totalTanglishSignals >= 1)) {
    const tanglishRatio = words.length > 0 ? totalTanglishSignals / words.length : 0;
    return {
      language: 'Tamil-English (Code-Mixed)',
      confidence: Math.min(0.95, parseFloat((0.7 + Math.min(0.25, tanglishRatio * 0.5)).toFixed(2))),
      isCodeMixed: true,
      detectedScripts: ['Latin'],
      normalizedText,
    };
  }

  // Case 4: Default to English
  return {
    language: 'English',
    confidence: totalLetters > 0 ? 0.92 : 0.5,
    isCodeMixed: false,
    detectedScripts: detectedScripts.length ? detectedScripts : ['Latin'],
    normalizedText,
  };
}

module.exports = { detectLanguage };


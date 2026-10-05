'use strict';

/**
 * LLM Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Central connector for Large Language Model APIs.
 * Supports: OpenAI GPT-4, Google Gemini, or any OpenAI-compatible endpoint.
 *
 * Status: Stub — returns "not_configured" until API key and model are set.
 * To activate: Set LLM_PROVIDER and LLM_API_KEY in .env
 * ─────────────────────────────────────────────────────────────────────────────
 */

function isConfigured() {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_PROVIDER);
}

/**
 * Analyze complaint text with LLM.
 * Returns structured JSON with classification, summary, and extracted entities.
 */
async function analyzeComplaint(text, imageUrls = []) {
  if (!isConfigured()) {
    return {
      status: 'not_configured',
      message: 'LLM service not connected. Set LLM_API_KEY and LLM_PROVIDER in .env to enable.',
      provider: null,
      result: null,
    };
  }

  // Placeholder for real implementation:
  // const provider = process.env.LLM_PROVIDER; // 'openai' | 'gemini'
  // const response = await callLLMAPI(provider, text, imageUrls);
  // return { status: 'completed', provider, result: response };

  return {
    status: 'not_configured',
    message: 'LLM provider configured but integration not yet implemented.',
    provider: process.env.LLM_PROVIDER,
    result: null,
  };
}

/**
 * Generate resolution guidance using RAG.
 * Combines retrieved knowledge documents with LLM generation.
 */
async function generateResolutionGuidance(complaintDescription, retrievedDocs) {
  if (!isConfigured()) {
    return {
      status: 'not_configured',
      guidance: null,
      sourceDocs: retrievedDocs.map((d) => d.title),
    };
  }

  // Placeholder: Build RAG prompt and call LLM
  return {
    status: 'not_configured',
    guidance: null,
    sourceDocs: [],
  };
}

/**
 * Verify resolution using LLM.
 * Compares resolution notes against complaint description and knowledge standards.
 */
async function verifyResolution(complaintDescription, resolutionNotes, knowledgeDocs) {
  if (!isConfigured()) {
    return {
      status: 'not_configured',
      verificationScore: null,
      verified: null,
      reason: 'LLM verification service not configured.',
    };
  }

  // Placeholder: Evaluate completeness and correctness
  return {
    status: 'not_configured',
    verificationScore: null,
    verified: null,
    reason: 'LLM verification pending integration.',
  };
}

module.exports = { isConfigured, analyzeComplaint, generateResolutionGuidance, verifyResolution };

'use strict';

/**
 * RAG Service — Retrieval-Augmented Generation
 * ─────────────────────────────────────────────────────────────────────────────
 * Research module: Knowledge retrieval for resolution guidance.
 *
 * Current state: Keyword-based document retrieval (no vector search).
 * Integration point: Replace with vector similarity search using embeddings
 * when embedding model (e.g., text-embedding-3-small) is connected.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const KnowledgeDocument = require('../models/KnowledgeDocument');

/**
 * Retrieve relevant knowledge documents for a complaint.
 * @param {string} category - Complaint category
 * @param {string} description - Complaint description
 * @returns {Promise<Array>} Relevant documents
 */
async function retrieveRelevantDocuments(category, description) {
  // Future: Embed description → vector search → retrieve top-k by cosine similarity

  // Current: Category match + keyword overlap
  const docs = await KnowledgeDocument.find({
    active: true,
    $or: [
      { applicableCategories: category },
      { department: { $regex: category, $options: 'i' } },
    ],
  }).limit(5);

  return docs;
}

/**
 * Build RAG context string from retrieved documents.
 * This is the "context" passed to the LLM prompt.
 */
function buildRAGContext(documents) {
  if (!documents || documents.length === 0) {
    return 'No relevant knowledge documents found for this category.';
  }

  return documents
    .map((doc, i) => `[Source ${i + 1}: ${doc.title}]\n${doc.content}`)
    .join('\n\n---\n\n');
}

module.exports = { retrieveRelevantDocuments, buildRAGContext };

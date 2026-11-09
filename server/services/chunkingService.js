'use strict';

const KnowledgeChunk = require('../models/KnowledgeChunk');

/**
 * Knowledge Chunking Service
 * Segment long municipal SOPs, resolution standards, and guidelines into
 * structured, context-preserving passages for RAG retrieval.
 */

const MIN_CHUNK_SIZE = 80;
const TARGET_CHUNK_SIZE = 500;
const MAX_CHUNK_SIZE = 900;

/**
 * Extracts action bullets (- Step, 1. Clean, * Repair) from text.
 */
function extractActionBullets(text) {
  const actions = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*•]\s+(.+)$/.test(trimmed)) {
      actions.push(trimmed.replace(/^[-*•]\s+/, ''));
    } else if (/^\d+\.\s+(.+)$/.test(trimmed)) {
      actions.push(trimmed.replace(/^\d+\.\s+/, ''));
    } else if (/^Step\s+\d+[:.-]\s*(.+)$/i.test(trimmed)) {
      actions.push(trimmed);
    }
  }
  return actions;
}

/**
 * Extracts precautions / safety notices from text.
 */
function extractPrecautions(text) {
  const precautions = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/(safety|caution|warning|mandatory|ppe|prohibited|danger|protocol requires|must be worn|cordon off)/i.test(trimmed)) {
      precautions.push(trimmed.replace(/^[-*•\d.]\s*/, ''));
    }
  }
  return precautions;
}

/**
 * Splits long section content into sentence-bounded chunks (300-600 chars).
 */
function splitSectionIntoChunks(heading, bodyText) {
  const cleanBody = bodyText.trim();
  if (cleanBody.length <= MAX_CHUNK_SIZE) {
    return [{
      sectionHeading: heading,
      content: cleanBody,
    }];
  }

  // Split by sentences
  const sentences = cleanBody.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [cleanBody];
  const chunks = [];
  let currentText = '';

  for (const sentence of sentences) {
    if ((currentText + sentence).length > TARGET_CHUNK_SIZE && currentText.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        sectionHeading: heading,
        content: currentText.trim(),
      });
      currentText = sentence;
    } else {
      currentText += (currentText ? ' ' : '') + sentence.trim();
    }
  }

  if (currentText.trim().length > 0) {
    if (chunks.length > 0 && currentText.trim().length < MIN_CHUNK_SIZE) {
      // Merge small tail with previous chunk
      chunks[chunks.length - 1].content += ' ' + currentText.trim();
    } else {
      chunks.push({
        sectionHeading: heading,
        content: currentText.trim(),
      });
    }
  }

  return chunks;
}

/**
 * Chunks a KnowledgeDocument and stores chunks in KnowledgeChunk collection.
 * Prevents duplicates by atomically wiping existing chunks for documentId first.
 *
 * @param {Object} doc - KnowledgeDocument mongoose document or POJO
 * @returns {Promise<Array>} Array of created KnowledgeChunk documents
 */
async function chunkDocument(doc) {
  if (!doc || !doc._id || !doc.content) {
    throw new Error('Valid KnowledgeDocument with _id and content is required for chunking.');
  }

  // 1. Wipe existing chunks for this document to prevent duplicate chunk buildup
  await KnowledgeChunk.deleteMany({ documentId: doc._id });

  // 2. Parse content into sections by markdown headings or paragraphs
  const rawContent = String(doc.content).trim();
  const rawSections = [];

  // Match Markdown headers (#, ##, ###, ####)
  const headerRegex = /^(#{1,4})\s+(.+)$/gm;
  let lastIndex = 0;
  let currentHeader = doc.title || 'General Procedure';
  let match;

  const headerMatches = [];
  while ((match = headerRegex.exec(rawContent)) !== null) {
    headerMatches.push({
      header: match[2].trim(),
      index: match.index,
      matchLength: match[0].length,
    });
  }

  if (headerMatches.length > 0) {
    for (let i = 0; i < headerMatches.length; i++) {
      const h = headerMatches[i];
      const startBody = h.index + h.matchLength;
      const endBody = (i + 1 < headerMatches.length) ? headerMatches[i + 1].index : rawContent.length;
      const sectionText = rawContent.substring(startBody, endBody).trim();

      if (sectionText.length > 0) {
        rawSections.push({
          heading: h.header,
          content: sectionText,
        });
      }
    }
  } else {
    // Split by paragraphs (double newlines)
    const paragraphs = rawContent.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (paragraphs.length === 1) {
      rawSections.push({
        heading: doc.title,
        content: paragraphs[0],
      });
    } else {
      paragraphs.forEach((p, idx) => {
        rawSections.push({
          heading: `${doc.title} - Part ${idx + 1}`,
          content: p,
        });
      });
    }
  }

  // 3. Subdivide sections that exceed MAX_CHUNK_SIZE
  const rawChunks = [];
  for (const sec of rawSections) {
    const subChunks = splitSectionIntoChunks(sec.heading, sec.content);
    rawChunks.push(...subChunks);
  }

  // Fallback if no chunks produced
  if (rawChunks.length === 0) {
    rawChunks.push({
      sectionHeading: doc.title,
      content: rawContent,
    });
  }

  // 4. Build chunk model payloads
  const isActive = Boolean(doc.active && doc.approvalStatus === 'approved' && !doc.isDeleted);
  const chunkDocs = rawChunks.map((c, index) => {
    const actions = extractActionBullets(c.content);
    const safetyNotes = extractPrecautions(c.content);

    // Approximate token count (words * 1.3)
    const wordCount = c.content.split(/\s+/).filter(Boolean).length;
    const tokenCount = Math.round(wordCount * 1.3);

    return {
      documentId: doc._id,
      chunkIndex: index,
      title: doc.title,
      sectionHeading: c.sectionHeading || doc.title,
      pageReference: `Sec ${index + 1}`,
      content: c.content,
      department: doc.department,
      applicableCategories: doc.applicableCategories || [],
      applicableSubcategories: doc.applicableSubcategories || [],
      documentType: doc.documentType || 'guideline',
      isPublic: Boolean(doc.isPublic),
      approvalStatus: doc.approvalStatus || 'approved',
      recommendedActions: actions.length > 0 ? actions : (doc.recommendedActions || []),
      precautions: safetyNotes.length > 0 ? safetyNotes : (doc.precautions || []),
      tokenCount,
      active: isActive,
      isDeleted: Boolean(doc.isDeleted),
      metadata: {
        source: doc.source || 'Municipal Corporation Manual',
        version: doc.version || '1.0',
        wordCount,
      },
    };
  });

  // 5. Insert new chunks
  const created = await KnowledgeChunk.insertMany(chunkDocs);
  return created;
}

/**
 * Synchronize document status changes (active, isDeleted, approvalStatus)
 * to all existing child chunks without re-chunking.
 */
async function syncDocumentChunks(doc) {
  if (!doc || !doc._id) return;

  const isActive = Boolean(doc.active && doc.approvalStatus === 'approved' && !doc.isDeleted);

  await KnowledgeChunk.updateMany(
    { documentId: doc._id },
    {
      $set: {
        active: isActive,
        isDeleted: Boolean(doc.isDeleted),
        approvalStatus: doc.approvalStatus || 'approved',
        isPublic: Boolean(doc.isPublic),
        department: doc.department,
        applicableCategories: doc.applicableCategories || [],
        applicableSubcategories: doc.applicableSubcategories || [],
        documentType: doc.documentType || 'guideline',
      },
    }
  );
}

/**
 * Rechunks all active, non-deleted documents in the database.
 */
async function rechunkAllDocuments(KnowledgeDocumentModel) {
  const KnowledgeDocument = KnowledgeDocumentModel || require('../models/KnowledgeDocument');
  const docs = await KnowledgeDocument.find({ isDeleted: { $ne: true } });
  let totalChunks = 0;

  for (const doc of docs) {
    const chunks = await chunkDocument(doc);
    totalChunks += chunks.length;
  }

  return { documentsProcessed: docs.length, totalChunksCreated: totalChunks };
}

module.exports = {
  chunkDocument,
  syncDocumentChunks,
  rechunkAllDocuments,
  splitSectionIntoChunks,
  extractActionBullets,
  extractPrecautions,
};


'use strict';

const KnowledgeDocument = require('../models/KnowledgeDocument');
const KnowledgeChunk = require('../models/KnowledgeChunk');
const Complaint = require('../models/Complaint');
const ComplaintTask = require('../models/ComplaintTask');
const { chunkDocument, syncDocumentChunks, rechunkAllDocuments } = require('../services/chunkingService');
const { retrieveRelevantKnowledge } = require('../services/ragService');

/**
 * GET /api/knowledge
 * Retrieve knowledge documents filtered by user role and department access.
 */
async function getAllDocuments(req, res, next) {
  try {
    const { department, category, documentType, search, active, approvalStatus } = req.query;

    const filter = { isDeleted: { $ne: true } };

    // Role-based document access control
    const userRole = req.user?.role || 'citizen';
    if (userRole === 'citizen') {
      filter.isPublic = true;
      filter.active = true;
      filter.approvalStatus = 'approved';
    } else if (userRole === 'department_supervisor' || userRole === 'department_employee') {
      filter.$or = [
        { department: req.user.departmentName },
        { isPublic: true },
      ];
      filter.active = true;
      filter.approvalStatus = 'approved';
    } else if (userRole === 'central_admin') {
      if (active !== undefined) filter.active = active === 'true';
      if (approvalStatus) filter.approvalStatus = approvalStatus;
    }

    if (department && userRole === 'central_admin') {
      filter.department = department;
    }
    if (category) {
      filter.applicableCategories = category;
    }
    if (documentType) {
      filter.documentType = documentType;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const docs = await KnowledgeDocument.find(filter).sort({ department: 1, title: 1 });
    res.json({
      success: true,
      count: docs.length,
      data: docs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/knowledge/:id
 * Retrieve a single knowledge document with its associated chunks.
 */
async function getDocumentById(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await KnowledgeDocument.findById(id);

    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Knowledge document not found.' });
    }

    // Role-based access validation
    const userRole = req.user?.role || 'citizen';
    if (userRole === 'citizen' && !doc.isPublic) {
      return res.status(403).json({ success: false, message: 'Access denied: Document is restricted to municipal staff.' });
    }
    if (
      ['department_supervisor', 'department_employee'].includes(userRole) &&
      !doc.isPublic &&
      doc.department !== req.user.departmentName
    ) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Document belongs to "${doc.department}". You are authorized for "${req.user.departmentName}".`,
      });
    }

    const chunks = await KnowledgeChunk.find({ documentId: doc._id }).sort({ chunkIndex: 1 });

    res.json({
      success: true,
      data: {
        document: doc,
        chunks,
        chunkCount: chunks.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/knowledge
 * Create a new knowledge document and auto-generate its knowledge chunks.
 */
async function createDocument(req, res, next) {
  try {
    const {
      title,
      description,
      department,
      content,
      source = 'Municipal Corporation Manual',
      documentType = 'guideline',
      applicableCategories = [],
      applicableSubcategories = [],
      version = '1.0',
      approvalStatus = 'approved',
      isPublic = false,
      recommendedActions = [],
      precautions = [],
      tags = [],
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const userRole = req.user?.role;
    let targetDept = department;

    if (userRole === 'department_supervisor') {
      targetDept = req.user.departmentName;
    } else if (userRole !== 'central_admin') {
      return res.status(403).json({ success: false, message: 'Access denied: Only Central Admin or Supervisors can author SOPs.' });
    }

    if (!targetDept) {
      return res.status(400).json({ success: false, message: 'Department is required.' });
    }

    const newDoc = new KnowledgeDocument({
      title: title.trim(),
      description: description ? description.trim() : '',
      department: targetDept.trim(),
      content: content.trim(),
      source: source.trim(),
      documentType,
      applicableCategories: Array.isArray(applicableCategories) ? applicableCategories : [applicableCategories],
      applicableSubcategories: Array.isArray(applicableSubcategories) ? applicableSubcategories : [],
      version,
      approvalStatus: userRole === 'central_admin' ? approvalStatus : 'under_review',
      isPublic: Boolean(isPublic),
      active: true,
      isDeleted: false,
      recommendedActions,
      precautions,
      tags,
      createdBy: req.user?.name || 'Central Admin',
      approvedBy: userRole === 'central_admin' ? (req.user?.name || 'Central Admin') : null,
      approvedAt: userRole === 'central_admin' ? new Date() : null,
    });

    await newDoc.save();

    // Auto-generate chunks
    const chunks = await chunkDocument(newDoc);

    res.status(201).json({
      success: true,
      message: 'Knowledge document created and segmented into chunks successfully.',
      data: {
        document: newDoc,
        chunkCount: chunks.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/knowledge/:id
 * Update an existing knowledge document and synchronize its chunks.
 */
async function updateDocument(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await KnowledgeDocument.findById(id);

    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Knowledge document not found.' });
    }

    const userRole = req.user?.role;
    if (userRole === 'department_supervisor' && doc.department !== req.user.departmentName) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only edit your own department documents.' });
    }
    if (!['central_admin', 'department_supervisor'].includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const {
      title,
      description,
      content,
      source,
      documentType,
      applicableCategories,
      applicableSubcategories,
      version,
      approvalStatus,
      isPublic,
      active,
      recommendedActions,
      precautions,
    } = req.body;

    let contentChanged = false;
    if (title !== undefined) doc.title = title.trim();
    if (description !== undefined) doc.description = description.trim();
    if (content !== undefined && content.trim() !== doc.content) {
      doc.content = content.trim();
      contentChanged = true;
    }
    if (source !== undefined) doc.source = source.trim();
    if (documentType !== undefined) doc.documentType = documentType;
    if (applicableCategories !== undefined) doc.applicableCategories = applicableCategories;
    if (applicableSubcategories !== undefined) doc.applicableSubcategories = applicableSubcategories;
    if (version !== undefined) doc.version = version;
    if (isPublic !== undefined) doc.isPublic = Boolean(isPublic);
    if (active !== undefined) doc.active = Boolean(active);
    if (recommendedActions !== undefined) doc.recommendedActions = recommendedActions;
    if (precautions !== undefined) doc.precautions = precautions;

    if (userRole === 'central_admin' && approvalStatus !== undefined) {
      doc.approvalStatus = approvalStatus;
      if (approvalStatus === 'approved') {
        doc.approvedBy = req.user.name || 'Central Admin';
        doc.approvedAt = new Date();
      }
    }

    await doc.save();

    let chunksCount = 0;
    if (contentChanged) {
      const chunks = await chunkDocument(doc);
      chunksCount = chunks.length;
    } else {
      await syncDocumentChunks(doc);
      chunksCount = await KnowledgeChunk.countDocuments({ documentId: doc._id });
    }

    res.json({
      success: true,
      message: 'Knowledge document updated and chunks synchronized successfully.',
      data: {
        document: doc,
        chunkCount: chunksCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/knowledge/:id
 * Soft delete a knowledge document and deactivate its child chunks.
 */
async function deleteDocument(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await KnowledgeDocument.findById(id);

    if (!doc || doc.isDeleted) {
      return res.status(404).json({ success: false, message: 'Knowledge document not found.' });
    }

    const userRole = req.user?.role;
    if (userRole === 'department_supervisor' && doc.department !== req.user.departmentName) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only delete your department documents.' });
    }
    if (!['central_admin', 'department_supervisor'].includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    doc.isDeleted = true;
    doc.active = false;
    await doc.save();

    await syncDocumentChunks(doc);

    res.json({
      success: true,
      message: 'Knowledge document deleted and chunks deactivated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/knowledge/retrieve
 * Context-aware RAG knowledge retrieval for complaint handling and task guidance.
 */
async function retrieveKnowledgeEndpoint(req, res, next) {
  try {
    const {
      complaintId,
      taskId,
      category: reqCategory,
      subcategory: reqSubcategory,
      description: reqDescription,
      issue: reqIssue,
      department: reqDepartment,
      isPublicOnly = false,
    } = req.body;

    let targetCategory = reqCategory || '';
    let targetSubcategory = reqSubcategory || '';
    let targetDescription = reqDescription || '';
    let targetIssue = reqIssue || '';
    let targetDepartment = reqDepartment || '';

    // 1. Resolve from Complaint if complaintId provided
    if (complaintId) {
      const complaint = await Complaint.findOne({ complaintId: complaintId.trim() });
      if (complaint) {
        targetCategory = targetCategory || complaint.category || '';
        targetDescription = targetDescription || complaint.description || complaint.originalText || '';
        targetIssue = targetIssue || complaint.category || '';
        if (!targetDepartment && complaint.routing?.departmentName) {
          targetDepartment = complaint.routing.departmentName;
        }
      }
    }

    // 2. Resolve from Task if taskId provided
    if (taskId) {
      const task = await ComplaintTask.findOne({ taskId: taskId.trim() });
      if (task) {
        targetDepartment = task.departmentName || targetDepartment;
        targetIssue = targetIssue || task.title;
        targetDescription = targetDescription || task.description;
      }
    }

    // 3. User Role & Assigned Department
    const userRole = req.user?.role || 'citizen';
    const userDepartment = req.user?.departmentName || '';

    // 4. Execute Retrieval
    const guidance = await retrieveRelevantKnowledge({
      category: targetCategory,
      subcategory: targetSubcategory,
      description: targetDescription,
      issue: targetIssue,
      department: targetDepartment,
      userRole,
      userDepartment,
      isPublicOnly,
      minScore: 35,
      limit: 3,
    });

    if (guidance.accessDenied) {
      return res.status(403).json({
        success: false,
        message: guidance.summary,
        data: guidance,
      });
    }

    // Attach retrieval audit record
    const auditInfo = {
      complaintId: complaintId || null,
      taskId: taskId || null,
      requestedBy: req.user?.email || 'Anonymous',
      userRole,
      targetDepartment: targetDepartment || userDepartment || 'All',
      retrievedAt: new Date().toISOString(),
      found: guidance.found,
      referenceCount: guidance.references.length,
    };

    res.json({
      success: true,
      data: {
        ...guidance,
        audit: auditInfo,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/knowledge/rechunk-all
 * Utility endpoint for Central Admin to refresh all chunks across the knowledge base.
 */
async function rechunkAllEndpoint(req, res, next) {
  try {
    const result = await rechunkAllDocuments(KnowledgeDocument);
    res.json({
      success: true,
      message: 'All knowledge documents re-chunked successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  retrieveKnowledgeEndpoint,
  rechunkAllEndpoint,
};


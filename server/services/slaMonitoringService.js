'use strict';

/**
 * SLA Monitoring Service (Module 9)
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides task-level SLA tracking, dynamic countdown calculations,
 * 5 SLA states (ON_TRACK, AT_RISK, OVERDUE, COMPLETED_WITHIN_SLA, COMPLETED_AFTER_SLA),
 * pause/resume controls with deadline extension, and threshold triggers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ComplaintTask = require('../models/ComplaintTask');
const WorkflowEvent = require('../models/WorkflowEvent');
const { triggerTaskEscalation } = require('./escalationService');

const SLA_HOURS_BY_PRIORITY = {
  CRITICAL: 6,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 120,
};

/**
 * Calculate dynamic SLA metrics for a task.
 * @param {object} task - ComplaintTask document or plain object
 * @param {Date} [now] - Current reference timestamp (defaults to new Date())
 * @returns {object} SLA status breakdown
 */
function calculateTaskSLA(task, now = new Date()) {
  const priority = (task.priority || 'MEDIUM').toUpperCase();
  const slaHours = task.slaHours || SLA_HOURS_BY_PRIORITY[priority] || 72;
  const createdAt = task.createdAt ? new Date(task.createdAt) : new Date(now.getTime() - 1000);
  const currentTime = new Date(now);

  // Compute total accumulated paused duration in milliseconds
  let totalPausedMs = 0;
  if (Array.isArray(task.pauseHistory)) {
    for (const entry of task.pauseHistory) {
      if (entry.pausedDurationMs && entry.pausedDurationMs > 0) {
        totalPausedMs += entry.pausedDurationMs;
      } else if (entry.pausedAt && entry.resumedAt) {
        totalPausedMs += Math.max(0, new Date(entry.resumedAt).getTime() - new Date(entry.pausedAt).getTime());
      } else if (entry.pausedAt && !entry.resumedAt && task.isPaused) {
        totalPausedMs += Math.max(0, currentTime.getTime() - new Date(entry.pausedAt).getTime());
      }
    }
  }

  // Calculate effective elapsed hours (excluding paused time)
  const totalElapsedMs = Math.max(0, currentTime.getTime() - createdAt.getTime() - totalPausedMs);
  const elapsedHours = totalElapsedMs / (1000 * 60 * 60);

  // Determine SLA deadline
  let deadline = task.slaDeadline ? new Date(task.slaDeadline) : new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);

  // Remaining hours until deadline
  const remainingMs = deadline.getTime() - currentTime.getTime();
  const remainingHours = remainingMs / (1000 * 60 * 60);

  const elapsedPercentage = Math.max(0, Math.round((elapsedHours / slaHours) * 100));

  // Determine 5-state SLA status
  let slaStatus = 'ON_TRACK';
  const isCompleted = ['VERIFIED', 'COMPLETED'].includes(task.status);

  if (isCompleted) {
    const completedAt = task.completedAt ? new Date(task.completedAt) : currentTime;
    if (completedAt.getTime() <= deadline.getTime()) {
      slaStatus = 'COMPLETED_WITHIN_SLA';
    } else {
      slaStatus = 'COMPLETED_AFTER_SLA';
    }
  } else {
    if (currentTime.getTime() > deadline.getTime()) {
      slaStatus = 'OVERDUE';
    } else if (elapsedPercentage >= 75 || remainingHours <= slaHours * 0.25) {
      slaStatus = 'AT_RISK';
    } else {
      slaStatus = 'ON_TRACK';
    }
  }

  const isBreached = slaStatus === 'OVERDUE' || slaStatus === 'COMPLETED_AFTER_SLA';

  return {
    taskId: task.taskId,
    priority,
    slaHours,
    slaDeadline: deadline,
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
    elapsedPercentage,
    slaStatus,
    isBreached,
    isPaused: Boolean(task.isPaused),
    totalPausedHours: Math.round((totalPausedMs / (1000 * 60 * 60)) * 10) / 10,
  };
}

/**
 * Pause the SLA clock for a specific task.
 * @param {string} taskId
 * @param {string} reason
 * @param {object} user - User document initiating the pause
 * @returns {Promise<object>} Updated task
 */
async function pauseTaskSLA(taskId, reason, user) {
  const task = await ComplaintTask.findOne({ taskId });
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  if (['VERIFIED', 'COMPLETED', 'REJECTED'].includes(task.status)) {
    throw new Error(`Cannot pause SLA for resolved task with status ${task.status}`);
  }

  if (task.isPaused) {
    throw new Error(`SLA for task ${taskId} is already paused`);
  }

  const now = new Date();
  task.isPaused = true;
  task.pauseHistory.push({
    pausedAt: now,
    resumedAt: null,
    pausedBy: user?._id,
    pausedByName: user?.name || 'Department Staff',
    reason: reason || 'Awaiting external resources or administrative clarification',
    pausedDurationMs: 0,
  });

  await task.save();

  try {
    await WorkflowEvent.create({
      complaintId: task.complaintId,
      taskId: task.taskId,
      eventType: 'TASK_SLA_PAUSED',
      actor: {
        type: 'supervisor',
        id: user?._id ? user._id.toString() : 'system',
        name: user?.name || 'Department Staff',
      },
      description: `SLA timer for task ${task.taskId} paused by ${user?.name || 'Staff'}. Reason: ${reason || 'Awaiting materials/access'}`,
      metadata: { taskId: task.taskId, reason },
    });
  } catch (err) {
    console.warn(`Failed to log TASK_SLA_PAUSED event for ${taskId}:`, err.message);
  }

  return task;
}

/**
 * Resume the SLA clock for a paused task, adjusting the deadline forward.
 * @param {string} taskId
 * @param {object} user - User document resuming the SLA
 * @returns {Promise<object>} Updated task
 */
async function resumeTaskSLA(taskId, user) {
  const task = await ComplaintTask.findOne({ taskId });
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  if (!task.isPaused) {
    throw new Error(`SLA for task ${taskId} is not paused`);
  }

  const now = new Date();
  // Find active pause entry
  const activePause = task.pauseHistory
    .slice()
    .reverse()
    .find((entry) => !entry.resumedAt);

  let durationMs = 0;
  if (activePause) {
    activePause.resumedAt = now;
    durationMs = Math.max(0, now.getTime() - new Date(activePause.pausedAt).getTime());
    activePause.pausedDurationMs = durationMs;
  }

  // Extend SLA deadline by the paused duration
  if (task.slaDeadline && durationMs > 0) {
    task.slaDeadline = new Date(new Date(task.slaDeadline).getTime() + durationMs);
  }

  task.isPaused = false;
  await task.save();

  try {
    await WorkflowEvent.create({
      complaintId: task.complaintId,
      taskId: task.taskId,
      eventType: 'TASK_SLA_RESUMED',
      actor: {
        type: 'supervisor',
        id: user?._id ? user._id.toString() : 'system',
        name: user?.name || 'Department Staff',
      },
      description: `SLA timer resumed for task ${task.taskId}. Deadline extended by ${Math.round((durationMs / 3600000) * 10) / 10}h.`,
      metadata: { taskId: task.taskId, durationMs, newDeadline: task.slaDeadline },
    });
  } catch (err) {
    console.warn(`Failed to log TASK_SLA_RESUMED event for ${taskId}:`, err.message);
  }

  return task;
}

/**
 * Batch evaluation of all open tasks for SLA state updates and automated escalations.
 * @returns {Promise<object>} Summary of evaluated tasks
 */
async function evaluateAllTasksSLA() {
  const activeTasks = await ComplaintTask.find({
    status: { $nin: ['VERIFIED', 'COMPLETED', 'REJECTED'] },
  });

  const now = new Date();
  let onTrackCount = 0;
  let atRiskCount = 0;
  let overdueCount = 0;
  let escalationsTriggered = 0;

  for (const task of activeTasks) {
    const sla = calculateTaskSLA(task, now);

    task.slaStatus = sla.slaStatus;
    task.slaBreached = sla.isBreached;

    if (sla.slaStatus === 'ON_TRACK') {
      onTrackCount++;
    } else if (sla.slaStatus === 'AT_RISK') {
      atRiskCount++;
      // Trigger Level 1 escalation if not already at Level 1 or higher
      if ((task.escalationLevel || 0) < 1) {
        const result = await triggerTaskEscalation(task, {
          escalationLevel: 1,
          triggerCondition: 'APPROACHING_BREACH_75',
          reasons: [`75% of SLA window (${task.slaHours}h) elapsed without completion`],
          recipientRole: 'department_supervisor',
        });
        if (result?.escalated) escalationsTriggered++;
      }
    } else if (sla.slaStatus === 'OVERDUE') {
      overdueCount++;
      // Determine escalation level: Level 2 for regular breach, Level 3 for Critical priority
      const targetLevel = task.priority === 'CRITICAL' ? 3 : 2;
      if ((task.escalationLevel || 0) < targetLevel) {
        const result = await triggerTaskEscalation(task, {
          escalationLevel: targetLevel,
          triggerCondition: 'SLA_BREACH',
          reasons: [`SLA breached! Deadline was ${new Date(task.slaDeadline).toISOString()}`],
          recipientRole: targetLevel === 3 ? 'central_admin' : 'department_supervisor',
        });
        if (result?.escalated) escalationsTriggered++;
      }
    }

    await task.save();
  }

  return {
    totalEvaluated: activeTasks.length,
    onTrackCount,
    atRiskCount,
    overdueCount,
    escalationsTriggered,
  };
}

module.exports = {
  SLA_HOURS_BY_PRIORITY,
  calculateTaskSLA,
  pauseTaskSLA,
  resumeTaskSLA,
  evaluateAllTasksSLA,
};

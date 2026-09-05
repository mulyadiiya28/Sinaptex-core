const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');
const config = require('../../../config/businessSuite.config');
const logger = require('../../../core/logger');
const { eventBus, EVENTS } = require('../../../core/eventBus');

async function createTask(data) {
  if (!config.task.enabled) {
    throw ApiError.badRequest('Task feature disabled', ErrorCodes.FEATURE_DISABLED);
  }

  const { partyId } = data;
  const count = await prisma.task.count({ where: { partyId } });
  if (count >= config.task.maxTasksPerParty) {
    throw ApiError.badRequest(`Batas maksimal task tercapai (${config.task.maxTasksPerParty})`, ErrorCodes.VALIDATION_ERROR);
  }

  const task = await prisma.task.create({
    data: {
      ...data,
      status: data.status || 'TODO',
      priority: data.priority || 'MEDIUM',
    },
    include: { contact: { select: { id: true, name: true } } },
  });

  // Create reminder if targetDate exists
  if (data.targetDate) {
    const remindAt = new Date(data.targetDate);
    remindAt.setDate(remindAt.getDate() - config.task.defaultReminderDays);
    if (remindAt > new Date()) {
      await prisma.taskReminder.create({
        data: { taskId: task.id, remindAt },
      });
    }
  }

  eventBus.emit(EVENTS.TASK_CREATED, { partyId, taskId: task.id });
  return task;
}

async function listTasks(partyId, { status, priority, assignedTo, contactId, overdue, page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const where = {
    partyId,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(assignedTo && { assignedTo }),
    ...(contactId && { contactId }),
    ...(overdue === 'true' && {
      targetDate: { lt: new Date() },
      status: { not: 'DONE' },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true } },
        reminders: { where: { sent: false } },
      },
      orderBy: [
        { priority: 'desc' },
        { targetDate: 'asc' },
      ],
      skip,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getTask(taskId, partyId) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, partyId },
    include: {
      contact: { select: { id: true, name: true } },
      reminders: true,
    },
  });
  if (!task) throw ApiError.notFound('Task tidak ditemukan', ErrorCodes.NOT_FOUND);
  return task;
}

async function updateTask(taskId, partyId, data) {
  const task = await getTask(taskId, partyId);

  const updateData = { ...data };
  if (data.status === 'DONE' && task.status !== 'DONE') {
    updateData.completedAt = new Date();
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: { contact: { select: { id: true, name: true } } },
  });

  eventBus.emit(EVENTS.TASK_UPDATED, { partyId, taskId, status: updated.status });
  return updated;
}

async function deleteTask(taskId, partyId) {
  await getTask(taskId, partyId);
  await prisma.task.delete({ where: { id: taskId } });
  eventBus.emit(EVENTS.TASK_DELETED, { partyId, taskId });
}

async function runTaskReminders() {
  const now = new Date();
  const reminders = await prisma.taskReminder.findMany({
    where: { sent: false, remindAt: { lte: now } },
    include: { task: { include: { party: true } } },
  });

  for (let i = 0; i < reminders.length; i++) {
    const item = reminders[i];

    try {
      const members = await prisma.businessRole.findMany({
        where: { partyId: item.task.partyId },
        select: { profileId: true },
      });

      for (let j = 0; j < members.length; j++) {
        const member = members[j];

        await prisma.notification.create({
          data: {
            profileId: member.profileId,
            type: 'TASK_REMINDER',
            title: `Task Reminder: ${item.task.title}`,
            message: `Task "${item.task.title}" deadline: ${item.task.targetDate?.toLocaleDateString('id-ID')}`,
            data: { taskId: item.task.id, targetDate: item.task.targetDate },
          },
        });
      }

      await prisma.taskReminder.update({
        where: { id: item.id },
        data: { sent: true, sentAt: new Date() },
      });
    } catch (e) {
      logger.error('Task reminder failed', { error: e.message, reminderId: item.id });
    }
  }
}

module.exports = { createTask, listTasks, getTask, updateTask, deleteTask, runTaskReminders };

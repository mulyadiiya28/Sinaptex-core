const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');
const ErrorCodes = require('../../../utils/errorCodes');
const config = require('../../../config/businessSuite.config');
const logger = require('../../../core/logger');

async function createAgenda(data) {
  if (!config.agenda.enabled) {
    throw ApiError.badRequest('Agenda feature disabled', ErrorCodes.FEATURE_DISABLED);
  }

  const { partyId } = data;
  const count = await prisma.agenda.count({ where: { partyId } });
  if (count >= config.agenda.maxAgendaPerParty) {
    throw ApiError.badRequest(`Batas maksimal agenda tercapai (${config.agenda.maxAgendaPerParty})`, ErrorCodes.VALIDATION_ERROR);
  }

  // Set reminder
  let { reminderAt } = data;
  if (!reminderAt && data.startAt) {
    reminderAt = new Date(data.startAt);
    reminderAt.setMinutes(reminderAt.getMinutes() - config.agenda.defaultReminderMinutes);
  }

  return prisma.agenda.create({
    data: {
      ...data,
      reminderAt,
    },
    include: { contact: { select: { id: true, name: true } } },
  });
}

async function listAgenda(partyId, { startDate, endDate, status, page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const where = {
    partyId,
    ...(status && { status }),
    ...(startDate && endDate && {
      startAt: { gte: new Date(startDate), lte: new Date(endDate) },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.agenda.findMany({
      where,
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { startAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.agenda.count({ where }),
  ]);

  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getAgenda(agendaId, partyId) {
  const agenda = await prisma.agenda.findFirst({
    where: { id: agendaId, partyId },
    include: { contact: { select: { id: true, name: true } } },
  });
  if (!agenda) throw ApiError.notFound('Agenda tidak ditemukan', ErrorCodes.NOT_FOUND);
  return agenda;
}

async function updateAgenda(agendaId, partyId, data) {
  await getAgenda(agendaId, partyId);
  return prisma.agenda.update({
    where: { id: agendaId },
    data,
    include: { contact: { select: { id: true, name: true } } },
  });
}

async function deleteAgenda(agendaId, partyId) {
  await getAgenda(agendaId, partyId);
  await prisma.agenda.delete({ where: { id: agendaId } });
}

async function runAgendaReminders() {
  const now = new Date();
  const upcoming = await prisma.agenda.findMany({
    where: {
      reminderSent: false,
      reminderAt: { lte: now },
      status: 'SCHEDULED',
    },
  });

  for (let i = 0; i < upcoming.length; i++) {
    const item = upcoming[i];

    try {
      const members = await prisma.businessRole.findMany({
        where: { partyId: item.partyId },
        select: { profileId: true },
      });

      for (let j = 0; j < members.length; j++) {
        const member = members[j];

        await prisma.notification.create({
          data: {
            profileId: member.profileId,
            type: 'AGENDA_REMINDER',
            title: `Agenda: ${item.title}`,
            message: `${item.title} pada ${item.startAt.toLocaleString('id-ID')}`,
            data: { agendaId: item.id, startAt: item.startAt },
          },
        });
      }

      await prisma.agenda.update({
        where: { id: item.id },
        data: { reminderSent: true },
      });
    } catch (e) {
      logger.error('Agenda reminder failed', { error: e.message, agendaId: item.id });
    }
  }
}

module.exports = { createAgenda, listAgenda, getAgenda, updateAgenda, deleteAgenda, runAgendaReminders };

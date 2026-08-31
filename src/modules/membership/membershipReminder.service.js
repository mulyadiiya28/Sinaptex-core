const prisma = require('../../config/prisma');
const logger = require('../../core/logger');
const constants = require('../../shared/constants');
const { sendEmail } = require('../../utils/mailer');

/**
 * Kirim pengingat membership H-3 dan H-1 (Asia/Jakarta calendar day).
 * Idempotent: cek notifikasi sejenis pada hari yang sama sebelum create.
 */
async function sendMembershipExpiryReminders(options = {}) {
  const asOf = options.asOfDate || new Date();
  const reminderDays = options.days || constants.MEMBERSHIP_REMINDER_DAYS || [3, 1];

  let totalNotified = 0;
  const details = [];

  // Sequential per day-bucket agar log jelas
  await reminderDays.reduce(async (prev, daysLeft) => {
    await prev;
    const start = startOfDayPlus(asOf, daysLeft);
    const end = endOfDayPlus(asOf, daysLeft);

    const memberships = await prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: start, lte: end },
      },
      include: {
        profile: {
          include: { user: { select: { email: true } } },
        },
      },
    });

    await memberships.reduce(async (chain, membership) => {
      await chain;
      const profileId = membership.profileId;
      const type = daysLeft === 1 ? 'MEMBERSHIP_REMINDER_H1' : 'MEMBERSHIP_REMINDER_H3';
      const dayStart = startOfDayPlus(asOf, 0);

      const already = await prisma.notification.findFirst({
        where: {
          profileId,
          type,
          createdAt: { gte: dayStart },
        },
      });
      if (already) return;

      const expiresLabel = membership.expiresAt
        ? membership.expiresAt.toLocaleDateString('id-ID')
        : '-';
      const title =
        daysLeft === 1
          ? 'Membership berakhir besok'
          : `Membership berakhir dalam ${daysLeft} hari`;
      const message =
        daysLeft === 1
          ? `Paket membership Anda berakhir besok (${expiresLabel}). Perpanjang sekarang agar kuota Offer/Need member tetap aktif.`
          : `Paket membership Anda berakhir pada ${expiresLabel} (H-${daysLeft}). Perpanjang untuk menghindari penyesuaian kuota gratis.`;

      try {
        await prisma.notification.create({
          data: {
            profileId,
            type,
            title,
            message,
            data: {
              membershipId: membership.id,
              expiresAt: membership.expiresAt?.toISOString(),
              daysLeft,
            },
          },
        });
      } catch (err) {
        logger.warn('membership reminder: failed in-app notif', {
          profileId,
          error: err.message,
        });
        return;
      }

      const email = membership.profile?.user?.email;
      if (email) {
        await sendEmail({
          to: email,
          subject: `[Sinaptex] ${title}`,
          text: `Halo ${membership.profile.fullName || 'Pengguna'},\n\n${message}\n\nPerpanjang membership: buka aplikasi Sinaptex → Membership → Checkout.\n`,
        });
      }

      totalNotified += 1;
      details.push({ profileId, daysLeft, membershipId: membership.id });
    }, Promise.resolve());
  }, Promise.resolve());

  logger.info('Membership expiry reminders done', { totalNotified, detailsCount: details.length });
  return { totalNotified, details };
}

function startOfDayPlus(base, days) {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function endOfDayPlus(base, days) {
  const d = startOfDayPlus(base, days);
  d.setHours(23, 59, 59, 999);
  return d;
}

module.exports = {
  sendMembershipExpiryReminders,
};

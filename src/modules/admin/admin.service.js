const prisma = require('../../config/prisma');

/**
 * ADMIN DASHBOARD (MVP Phase 12) — agregasi murni, tidak ada business logic
 * baru di sini, semua angka ditarik dari tabel yang sudah ada.
 */
async function getDashboardStats() {
  const [
    totalUsers,
    totalParties,
    opportunityByStatus,
    dealByStatus,
    activeMemberships,
    revenueResult,
    pendingVerifications,
    pendingReports,
    pendingFraudFlags,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.party.count(),
    prisma.opportunity.groupBy({ by: ['status'], _count: true }),
    prisma.deal.groupBy({ by: ['status'], _count: true }),
    prisma.membership.count({ where: { status: 'ACTIVE' } }),
    prisma.membershipTransaction.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.verificationDocument.count({ where: { status: 'PENDING' } }),
    prisma.userReport.count({ where: { status: 'PENDING' } }),
    prisma.fraudFlag.count({ where: { status: 'PENDING_REVIEW' } }), // dibekukan, tapi datanya tetap relevan dipantau
  ]);

  return {
    users: { total: totalUsers },
    parties: { total: totalParties },
    opportunities: Object.fromEntries(opportunityByStatus.map((o) => [o.status, o._count])),
    deals: Object.fromEntries(dealByStatus.map((d) => [d.status, d._count])),
    membership: {
      activeMemberships,
      totalRevenue: revenueResult._sum.amount || 0,
    },
    pending: {
      verifications: pendingVerifications,
      userReports: pendingReports,
      fraudFlags: pendingFraudFlags,
    },
  };
}

module.exports = { getDashboardStats };

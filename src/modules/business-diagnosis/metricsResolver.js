const prisma = require('../../config/prisma');
const diagnosisConfig = require('../../config/diagnosis.config');

/**
 * METRICS RESOLVER — bagian "hybrid" dari sumber data diagnosis: kalau Party
 * punya cukup histori di platform ini, hitung metriknya otomatis dari data
 * NYATA (bukan self-report). Kalau datanya belum cukup (mis. Party baru,
 * belum pernah kirim invitation), resolver mengembalikan `null` secara
 * eksplisit — TIDAK melaporkan angka 0 yang menyesatkan — sehingga caller
 * (diagnosis.service.js) tahu harus jatuh balik minta MANUAL_INPUT.
 *
 * Untuk menambah metrik baru: tambahkan fungsi di sini, daftarkan di
 * `resolvers`, lalu isi `DiagnosticFactor.autoSourceKey` dengan key yang sama
 * saat menambah basis pengetahuan lewat POST /business-diagnosis/knowledge.
 */

/** % Deal COMPLETED dari total Invitation yang dikirim Party dalam N hari terakhir. */
async function partyConversionRate(partyId) {
  const since = new Date(
    Date.now() - diagnosisConfig.autoMetrics.conversionRateWindowDays * 24 * 60 * 60 * 1000
  );

  const sentInvitations = await prisma.invitation.count({
    where: { fromPartyId: partyId, createdAt: { gte: since } },
  });
  if (sentInvitations === 0) return null; // belum cukup data untuk disimpulkan

  const completedDeals = await prisma.deal.count({
    where: {
      status: 'COMPLETED',
      invitation: { fromPartyId: partyId, createdAt: { gte: since } },
    },
  });

  return Math.round((completedDeals / sentInvitations) * 1000) / 10; // persentase, 1 desimal
}

/** Skor sentimen (0-100) dari rata-rata rating Review yang diterima owner Party dalam N hari terakhir. */
async function partyAvgReviewSentiment(partyId) {
  const since = new Date(
    Date.now() - diagnosisConfig.autoMetrics.reviewSentimentWindowDays * 24 * 60 * 60 * 1000
  );

  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { ownerId: true } });
  if (!party) return null;

  const reviews = await prisma.review.findMany({
    where: { revieweeId: party.ownerId, createdAt: { gte: since } },
    select: { rating: true },
  });
  if (reviews.length === 0) return null; // belum ada review = belum cukup data, bukan "sentimen 0"

  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return Math.round(avgRating * 20 * 10) / 10; // skala 1-5 -> 0-100
}

/** Cached responseScore dari Ranking Engine (Phase 06) — hanya valid kalau Party pernah menerima invitation. */
async function partyResponseScore(partyId) {
  const party = await prisma.party.findUnique({ where: { id: partyId }, select: { ownerId: true } });
  if (!party) return null;

  const receivedCount = await prisma.invitation.count({ where: { toPartyId: partyId } });
  if (receivedCount === 0) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: party.ownerId },
    select: { responseScore: true },
  });
  return profile?.responseScore ?? null;
}

const resolvers = {
  party_conversion_rate: partyConversionRate,
  party_avg_review_sentiment: partyAvgReviewSentiment,
  party_response_score: partyResponseScore,
};

/**
 * @param {string} autoSourceKey
 * @param {string} partyId
 * @returns {Promise<number|null>} null kalau data platform belum cukup untuk dihitung
 */
async function resolveAutoMetric(autoSourceKey, partyId) {
  const resolver = resolvers[autoSourceKey];
  if (!resolver || !partyId) return null;
  try {
    return await resolver(partyId);
  } catch {
    return null; // gagal hitung -> anggap tidak cukup data, jangan lempar error ke user
  }
}

module.exports = { resolveAutoMetric, resolvers };

module.exports = {
  // Ambang batas confidenceScore (0..1) untuk menentukan dataSufficiency.
  // Di bawah minPartial: dianggap INSUFFICIENT (belum layak dipakai buat rekomendasi).
  // Antara minPartial dan minSufficient: PARTIAL (masih perlu klarifikasi lagi).
  // >= minSufficient: SUFFICIENT (diagnosis Job dianggap cukup yakin).
  confidence: {
    minPartial: 0.3,
    minSufficient: 0.7,
  },

  // Kalau SolutionCategory hasil lookup keyword ternyata cuma punya SATU
  // JobToBeDone yang dipetakan (tidak ambigu), engine boleh langsung
  // mendiagnosis tanpa perlu klarifikasi tambahan.
  autoResolveWhenUnambiguous: true,

  // Berapa banyak kata kunci (token) dari statedWant yang harus overlap dengan
  // SolutionCategory.keywords supaya dianggap "match" di lookup awal.
  minKeywordOverlap: 1,

  // Saat mencari Opportunity nyata yang menjawab Job yang terdiagnosis, seberapa
  // mirip title/description/tags Opportunity harus dengan Job/SolutionCategory
  // supaya dianggap solusi yang valid (bukan cocok kebetulan).
  minSolutionRelevance: 0.15,
};

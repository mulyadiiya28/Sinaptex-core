module.exports = {
  autoMetrics: {
    conversionRateWindowDays: 30,
    reviewSentimentWindowDays: 90,
  },

  // Confidence pada saat RootCause terdiagnosis tergantung provenance data yang
  // dipakai rule yang match: data yang ditarik otomatis dari platform (AUTO_PLATFORM)
  // lebih bisa dipercaya daripada input manual self-reported (MANUAL_INPUT).
  confidenceByProvenance: {
    allAuto: 0.9,
    mixed: 0.75,
    allManual: 0.6,
  },
};

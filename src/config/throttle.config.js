module.exports = {
  global: {
    windowMs: Number(process.env.THROTTLE_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.THROTTLE_MAX || 300),
  },
  // Batas lebih ketat untuk endpoint sensitif/berat, dipakai per-route jika dibutuhkan
  strict: {
    windowMs: 15 * 60 * 1000,
    max: 20,
  },
};

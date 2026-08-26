/**
 * Semua lexicon di bawah ini SENGAJA eksplisit & mudah diaudit — bukan
 * hasil training model. Kalau ada kalimat yang salah klasifikasi, perbaikannya
 * cukup tambah/ubah entri di sini, bukan retraining apa pun.
 */
module.exports = {
  // Rule 1: pertanyaan/interogatif -> selalu NEEDS_DIAGNOSIS
  interrogativePatterns: [
    'kenapa',
    'mengapa',
    'kok ',
    'gimana caranya',
    'bagaimana cara',
    'bagaimana',
    'apa penyebab',
    'apa yang salah',
    'apa sebab',
  ],

  // Rule 2: gejala/tren negatif -> NEEDS_DIAGNOSIS (Business Diagnosis Engine, Phase 20)
  symptomKeywords: [
    'menurun',
    'turun',
    'anjlok',
    'melorot',
    'rendah',
    'merugi',
    'rugi',
    'bangkrut',
    'gagal',
    'hilang',
    'bocor',
    'churn',
    'komplain',
    'keluhan',
    'lambat',
    'buruk',
    'jelek',
    'stagnan',
    'stuck',
  ],

  // Rule 3: mencari PIHAK (bukan produk) -> DIRECT_SEARCH langsung, tidak perlu diagnosis
  acquisitionVerbs: [
    'cari ',
    'mencari',
    'nyari',
    'mau cari',
    'ingin mencari',
    'ingin membeli',
    'mau beli',
    'ingin beli',
    'butuh',
    'perlu',
    'menjual',
    'jual ',
    'tawarkan',
  ],
  roleKeywords: [
    'supplier',
    'pemasok',
    'buyer',
    'pembeli',
    'investor',
    'partner',
    'mitra',
    'distributor',
    'reseller',
    'agen',
  ],

  // Rule "auto orchestrate": kalau NEEDS_DIAGNOSIS/BUSINESS_DIAGNOSIS, coba cocokkan
  // rawText ke BusinessSymptom lewat text similarity. Di bawah ambang ini,
  // JANGAN menebak symptom-nya — minta user pilih manual dari katalog.
  symptomMatchThreshold: 0.12,

  directSearchResultLimit: 10,
};

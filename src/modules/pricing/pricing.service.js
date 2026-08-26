const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const ErrorCodes = require('../../utils/errorCodes');

/**
 * PRICING SERVICE — domain terpisah dari Membership/Payment (System > Membership
 * | Pricing | Payment). SATU-SATUNYA cara modul lain menghitung harga akhir:
 *
 *   const price = await pricingService.calculate({ productType: 'MEMBERSHIP', productId: planId });
 *
 * Membership, Chat, maupun Payment TIDAK PERNAH baca MembershipPricing langsung
 * atau menghitung diskon sendiri — semua lewat sini. Ini yang membuat produk baru
 * (Featured Offer, AI Credit, dst) bisa numpang Pricing Engine yang sama tanpa
 * bikin logic harga baru per produk.
 *
 * STATUS SAAT INI: hanya resolusi base price (MembershipPricing yang sedang
 * ACTIVE) yang terimplementasi. Promotion/Discount/Voucher/Tax BELUM ada modelnya
 * sama sekali — kalau voucherCode diisi, service ini JUJUR menolak (bukan diam-diam
 * mengabaikan voucher-nya), supaya tidak ada yang mengira ada diskon padahal tidak.
 */

async function getActivePricing(productType, productId) {
  if (productType !== 'MEMBERSHIP') {
    throw ApiError.badRequest(`Pricing untuk productType "${productType}" belum didukung`);
  }

  const pricing = await prisma.membershipPricing.findFirst({
    where: { planId: productId, status: 'ACTIVE' },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (!pricing) throw ApiError.notFound('Tidak ada harga aktif untuk plan ini — hubungi admin.', ErrorCodes.PRICING_NOT_FOUND);
  return pricing;
}

/**
 * @param {object} params
 * @param {'MEMBERSHIP'} params.productType
 * @param {string} params.productId - planId (untuk MEMBERSHIP)
 * @param {string} [params.voucherCode] - belum didukung, akan menolak eksplisit kalau diisi
 * @returns {Promise<{ pricingId: string, basePrice: number, finalPrice: number, currency: string, breakdown: object }>}
 */
async function calculate({ productType, productId, voucherCode }) {
  const pricing = await getActivePricing(productType, productId);

  if (voucherCode) {
    // JUJUR: Voucher/Promotion/Tax belum diimplementasikan. Menolak eksplisit,
    // bukan diam-diam mengabaikan kode voucher yang dimasukkan user.
    throw ApiError.badRequest('Voucher/promosi belum didukung di versi ini.', null, ErrorCodes.VOUCHER_NOT_SUPPORTED);
  }

  return {
    pricingId: pricing.id,
    basePrice: pricing.price,
    finalPrice: pricing.price, // = basePrice untuk saat ini (belum ada Promotion/Discount/Tax)
    currency: pricing.currency,
    breakdown: { basePrice: pricing.price, discounts: [], tax: 0 },
  };
}

/**
 * Admin: tetapkan harga baru untuk sebuah Plan. Harga LAMA di-nonaktifkan
 * (bukan dihapus/diubah) — histori tetap utuh, invoice lama tetap merujuk
 * MembershipPricing lama yang sudah INACTIVE.
 */
async function setPlanPrice({ planId, price, currency = 'IDR' }) {
  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) throw ApiError.notFound('Membership plan not found');

  return prisma.$transaction(async (tx) => {
    await tx.membershipPricing.updateMany({
      where: { planId, status: 'ACTIVE' },
      data: { status: 'INACTIVE', effectiveUntil: new Date() },
    });

    return tx.membershipPricing.create({
      data: { planId, price, currency, status: 'ACTIVE' },
    });
  });
}

async function getPriceHistory(planId) {
  return prisma.membershipPricing.findMany({ where: { planId }, orderBy: { effectiveFrom: 'desc' } });
}

module.exports = { calculate, getActivePricing, setPlanPrice, getPriceHistory };

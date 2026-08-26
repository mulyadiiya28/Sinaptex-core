/**
 * Status internal yang dipakai SELURUH platform, tidak peduli provider
 * pembayaran apa yang dipakai. Setiap adapter (MidtransGateway, dst) WAJIB
 * menerjemahkan istilah provider-nya sendiri (mis. Midtrans: "capture",
 * "settlement", "deny") ke salah satu nilai di bawah ini — modul lain
 * (membership.service.js) tidak boleh tahu istilah provider tertentu.
 * Sengaja sama persis dengan enum Prisma `MembershipTransactionStatus`.
 */
module.exports = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
};

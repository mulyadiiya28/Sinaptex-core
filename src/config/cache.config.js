/**
 * Redis cache TTL & key prefixes.
 * Cache adalah optimisasi — app wajib tetap jalan tanpa Redis.
 */
module.exports = {
  /** Prefix global semua key aplikasi */
  keyPrefix: process.env.CACHE_KEY_PREFIX || 'sinaptex:',

  defaultTtlSeconds: Number(process.env.CACHE_DEFAULT_TTL || 60),

  ttl: {
    matchingResult: Number(process.env.CACHE_TTL_MATCHING || 30),
    opportunityList: Number(process.env.CACHE_TTL_OPPORTUNITY_LIST || 60),
    opportunityDetail: Number(process.env.CACHE_TTL_OPPORTUNITY_DETAIL || 45),
    boostPlans: Number(process.env.CACHE_TTL_BOOST_PLANS || 3600),
    membershipPlans: Number(process.env.CACHE_TTL_MEMBERSHIP_PLANS || 600),
    contentPage: Number(process.env.CACHE_TTL_CONTENT_PAGE || 300),
    contentFaq: Number(process.env.CACHE_TTL_CONTENT_FAQ || 300),
    /** hasActiveMembership — pendek karena bisa berubah via webhook */
    membershipActive: Number(process.env.CACHE_TTL_MEMBERSHIP_ACTIVE || 60),
  },

  keys: {
    boostPlans: 'catalog:boost-plans',
    membershipPlans: 'catalog:membership-plans',
    contentFaq: 'content:faq:published',
    contentPage: (slug) => `content:page:${slug}`,
    matching: (opportunityId, limit) => `matching:${opportunityId}:limit:${limit || 20}`,
    membershipActive: (profileId) => `membership:active:${profileId}`,
  },
};

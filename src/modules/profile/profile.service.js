const prisma = require('../../config/prisma');
const membershipService = require('../membership/membership.service');

/**
 * Menghitung tingkat kelengkapan profil (Profile Progress %)
 * Berdasarkan prinsip MVP Phase 3: "Profile adalah pusat ekosistem"
 */
function calculateProfileProgress(profile) {
  const sections = {
    basicInfo: {
      name: 'Informasi Dasar',
      weight: 50,
      items: [
        { key: 'fullName', label: 'Nama Lengkap', completed: Boolean(profile?.fullName && profile.fullName.trim().length >= 2), weight: 15 },
        { key: 'avatarUrl', label: 'Foto Profil', completed: Boolean(profile?.avatarUrl), weight: 10 },
        { key: 'bio', label: 'Bio / Deskripsi', completed: Boolean(profile?.bio && profile.bio.trim().length >= 5), weight: 10 },
        { key: 'location', label: 'Lokasi Kota / Provinsi', completed: Boolean(profile?.location && profile.location.trim().length >= 2), weight: 10 },
        { key: 'phone', label: 'Nomor Telepon', completed: Boolean(profile?.phone && profile.phone.trim().length >= 5), weight: 5 },
      ],
    },
    businessEntity: {
      name: 'Entitas Bisnis (Party)',
      weight: 20,
      items: [
        { key: 'partyCreated', label: 'Membuat minimal 1 Party / Usaha', completed: Boolean(profile?.parties?.length > 0), weight: 20 },
      ],
    },
    capabilities: {
      name: 'Keahlian & Bidang Industri',
      weight: 15,
      items: [
        {
          key: 'capabilitiesSet',
          label: 'Mendaftarkan Capability / Keahlian',
          completed: Boolean(
            profile?.parties?.some((p) => p.capabilities && p.capabilities.length > 0)
          ),
          weight: 15,
        },
      ],
    },
    verification: {
      name: 'Verifikasi Legalitas',
      weight: 15,
      items: [
        {
          key: 'verificationUploaded',
          label: 'Unggah Dokumen Verifikasi (KTP/NIB/NPWP)',
          completed: Boolean(
            profile?.verifications?.length > 0 ||
            profile?.verificationStatus === 'VERIFIED' ||
            profile?.parties?.some((p) => p.verifications?.length > 0 || p.verificationStatus === 'VERIFIED')
          ),
          weight: 15,
        },
      ],
    },
  };

  let totalScore = 0;
  const completedItems = [];
  const missingItems = [];

  Object.values(sections).forEach((section) => {
    section.items.forEach((item) => {
      if (item.completed) {
        totalScore += item.weight;
        completedItems.push({ key: item.key, label: item.label, section: section.name });
      } else {
        missingItems.push({
          key: item.key,
          label: item.label,
          section: section.name,
          points: item.weight,
        });
      }
    });
  });

  const percentage = Math.min(100, Math.round(totalScore));

  return {
    percentage,
    isComplete: percentage >= 80,
    score: totalScore,
    maxScore: 100,
    sections,
    completedItems,
    missingItems,
  };
}

/**
 * Mengambil profil lengkap pengguna saat ini (termasuk status membership & progress)
 */
async function getMyFullProfile(profileId) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { id: true, email: true, role: true, createdAt: true } },
      businessRoles: { include: { party: true } },
      parties: {
        include: {
          category: true,
          capabilities: { include: { capability: true } },
          verifications: { select: { id: true, type: true, status: true, createdAt: true } },
        },
      },
      verifications: {
        select: { id: true, type: true, status: true, createdAt: true, rejectReason: true },
      },
      media: {
        where: { ownerType: 'PROFILE' },
        orderBy: { createdAt: 'desc' },
      },
      membership: {
        include: { plan: true },
      },
    },
  });

  if (!profile) return null;

  const isMember = await membershipService.hasActiveMembership(profileId);
  const progress = calculateProfileProgress(profile);

  return {
    ...profile,
    hasActiveMembership: isMember,
    progress,
  };
}

module.exports = {
  calculateProfileProgress,
  getMyFullProfile,
};

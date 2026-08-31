const { calculateProfileProgress } = require('../../src/modules/profile/profile.service');

describe('Profile Progress Calculation (MVP Phase 3)', () => {
  it('calculates 0% or low score for an empty profile with missing items', () => {
    const minimalProfile = {
      fullName: '',
      avatarUrl: null,
      bio: null,
      location: null,
      phone: null,
      parties: [],
      verifications: [],
      verificationStatus: 'UNVERIFIED',
    };

    const progress = calculateProfileProgress(minimalProfile);
    expect(progress.percentage).toBe(0);
    expect(progress.isComplete).toBe(false);
    expect(progress.missingItems.length).toBeGreaterThan(0);
    expect(progress.missingItems.map((m) => m.key)).toContain('fullName');
    expect(progress.missingItems.map((m) => m.key)).toContain('partyCreated');
  });

  it('calculates partial progress when basic info is filled', () => {
    const partialProfile = {
      fullName: 'Ahmad Dahlan',
      avatarUrl: 'https://cloudinary.com/avatar.jpg',
      bio: 'Pengusaha manufaktur dan distribusi tekstil',
      location: 'Bandung, Jawa Barat',
      phone: '08123456789',
      parties: [],
      verifications: [],
      verificationStatus: 'UNVERIFIED',
    };

    const progress = calculateProfileProgress(partialProfile);
    // basicInfo = 15 + 10 + 10 + 10 + 5 = 50%
    expect(progress.percentage).toBe(50);
    expect(progress.isComplete).toBe(false);
    expect(progress.completedItems.map((c) => c.key)).toEqual(
      expect.arrayContaining(['fullName', 'avatarUrl', 'bio', 'location', 'phone'])
    );
  });

  it('calculates 100% when full profile, party, capabilities, and verification are present', () => {
    const completeProfile = {
      fullName: 'Siti Rahma',
      avatarUrl: 'https://cloudinary.com/avatar2.jpg',
      bio: 'Eksportir hasil perkebunan dan rempah organik',
      location: 'Surabaya, Jawa Timur',
      phone: '+628119876543',
      parties: [
        {
          id: 'party-1',
          name: 'PT Rempah Nusantara',
          capabilities: [{ capability: { name: 'Eksportir Kopi' } }],
          verifications: [{ id: 'doc-1', status: 'PENDING' }],
        },
      ],
      verifications: [],
      verificationStatus: 'UNVERIFIED',
    };

    const progress = calculateProfileProgress(completeProfile);
    expect(progress.percentage).toBe(100);
    expect(progress.isComplete).toBe(true);
    expect(progress.missingItems).toHaveLength(0);
  });
});

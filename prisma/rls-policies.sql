-- ============================================================
-- Row Level Security (RLS) Policies — Supabase Postgres
-- ============================================================
-- CONTEXT: Express API ini menggunakan Prisma dengan koneksi service-role
-- (lewat DATABASE_URL), yang BYPASS RLS secara default di Postgres untuk role
-- superuser/owner. RLS di sini adalah defense-in-depth untuk skenario:
--   a) Ada client (mobile/web) yang mengakses Supabase langsung via
--      @supabase/supabase-js memakai anon/authenticated key (bukan lewat API ini)
--   b) Supabase Realtime dipakai untuk subscribe perubahan tabel tertentu
--
-- Jalankan file ini di Supabase SQL Editor. Sesuaikan nama tabel jika
-- @@map() di schema.prisma diubah.
-- ============================================================

-- Aktifkan RLS di tabel yang berpotensi diakses langsung dari client
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------
-- Siapa saja boleh baca profil publik dasar (dipakai untuk tampilkan hasil matching)
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (true);

-- Hanya pemilik (mapped via users.supabase_id = auth.uid()) yang boleh update profilnya sendiri
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (
    user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()::text)
  );

-- ---------- parties ----------
CREATE POLICY "parties_select_public" ON parties
  FOR SELECT USING (true);

CREATE POLICY "parties_modify_own" ON parties
  FOR ALL USING (
    owner_id IN (
      SELECT p.id FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- ---------- opportunities ----------
-- PUBLIC & ACTIVE terlihat semua orang; PRIVATE/VERIFIED_ONLY dibatasi
CREATE POLICY "opportunities_select_visible" ON opportunities
  FOR SELECT USING (
    visibility = 'PUBLIC'
    OR party_id IN (
      SELECT pa.id FROM parties pa
      JOIN profiles p ON p.id = pa.owner_id
      JOIN users u ON u.id = p.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

CREATE POLICY "opportunities_modify_own" ON opportunities
  FOR ALL USING (
    party_id IN (
      SELECT pa.id FROM parties pa
      JOIN profiles p ON p.id = pa.owner_id
      JOIN users u ON u.id = p.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- ---------- notifications ----------
-- Hanya pemilik notifikasi yang boleh baca/update (mark as read) miliknya
CREATE POLICY "notifications_own_only" ON notifications
  FOR ALL USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- ---------- verification_documents ----------
-- Hanya pemilik dokumen (langsung atau lewat party) yang boleh lihat dokumennya
CREATE POLICY "verification_documents_own" ON verification_documents
  FOR SELECT USING (
    profile_id IN (SELECT p.id FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.supabase_id = auth.uid()::text)
    OR party_id IN (
      SELECT pa.id FROM parties pa
      JOIN profiles p ON p.id = pa.owner_id
      JOIN users u ON u.id = p.user_id
      WHERE u.supabase_id = auth.uid()::text
    )
  );

-- ---------- reviews ----------
-- Review publik bisa dibaca siapa saja (jadi bagian trust score yang terlihat)
CREATE POLICY "reviews_select_public" ON reviews
  FOR SELECT USING (true);

-- ============================================================
-- CATATAN: kebijakan INSERT/UPDATE/DELETE yang sebenarnya (invitation,
-- deal, boost, dst) TIDAK diberi policy langsung di sini karena flow bisnis
-- (matching score, state machine deal, dsb) dilakukan lewat Express API
-- dengan service-role key — bukan langsung dari client. Kalau ada rencana
-- akses langsung ke tabel tersebut dari client, tambahkan policy serupa
-- pola di atas sebelum mengaktifkan RLS pada tabel itu.
-- ============================================================

-- ============================================================================
-- Contact Groups — Run this in the Supabase SQL Editor
-- ============================================================================

-- ─── Contact Groups ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Contact Group Members ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_group_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES contact_groups(id) ON DELETE CASCADE NOT NULL,
  contact_id  UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  added_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_cgm_group ON contact_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_cgm_contact ON contact_group_members(contact_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access" ON contact_groups FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON contact_group_members FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ─── Auto-update updated_at ──────────────────────────────────────────────────
CREATE TRIGGER contact_groups_updated_at
  BEFORE UPDATE ON contact_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

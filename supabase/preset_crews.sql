-- Preset Crews for Group Checkout
-- Run in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS preset_crews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preset_crew_members (
  preset_crew_id uuid REFERENCES preset_crews(id) ON DELETE CASCADE NOT NULL,
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (preset_crew_id, team_member_id)
);

-- Links all assignment rows created in the same group checkout
ALTER TABLE inventory_assignments
  ADD COLUMN IF NOT EXISTS checkout_group_id uuid;

ALTER TABLE preset_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_crew_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_preset_crews" ON preset_crews
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "owner_all_preset_crew_members" ON preset_crew_members
  FOR ALL USING (
    preset_crew_id IN (
      SELECT pc.id FROM preset_crews pc
      JOIN businesses b ON b.id = pc.business_id
      WHERE b.owner_id = auth.uid()
    )
  );

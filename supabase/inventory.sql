-- Inventory & Equipment Tracking
-- Run this in the Supabase SQL editor

CREATE TABLE inventory_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name                    text NOT NULL,
  category                text NOT NULL CHECK (category IN ('equipment', 'vehicle', 'part')),
  condition               text DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
  quantity                integer DEFAULT 1,
  min_quantity            integer DEFAULT 0,
  location                text,
  serial_number           text,
  purchase_date           date,
  purchase_cost           numeric(10,2),
  current_value           numeric(10,2),
  vehicle_year            integer,
  vehicle_make            text,
  vehicle_model           text,
  license_plate           text,
  insurance_expires_at    date,
  registration_expires_at date,
  notes                   text,
  is_active               boolean DEFAULT true,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE inventory_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  team_member_id  uuid REFERENCES team_members(id) ON DELETE SET NULL,
  assigned_at     timestamptz DEFAULT now() NOT NULL,
  returned_at     timestamptz,
  notes           text
);

CREATE TABLE inventory_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  job_id        uuid REFERENCES jobs(id) ON DELETE SET NULL,
  quantity_used numeric(10,2) DEFAULT 1,
  used_at       timestamptz DEFAULT now(),
  logged_by     uuid REFERENCES team_members(id) ON DELETE SET NULL,
  notes         text
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();

-- RLS
ALTER TABLE inventory_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_usage      ENABLE ROW LEVEL SECURITY;

-- Owner: full access to items
CREATE POLICY "owner_all_items" ON inventory_items
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- Team members: read items (needed to log usage)
CREATE POLICY "member_read_items" ON inventory_items
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM team_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Owner: full access to assignments
CREATE POLICY "owner_all_assignments" ON inventory_assignments
  FOR ALL USING (
    item_id IN (
      SELECT id FROM inventory_items WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- Team members: read their own assignments
CREATE POLICY "member_read_assignments" ON inventory_assignments
  FOR SELECT USING (
    team_member_id IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- Owner: full access to usage logs
CREATE POLICY "owner_all_usage" ON inventory_usage
  FOR ALL USING (
    item_id IN (
      SELECT id FROM inventory_items WHERE business_id IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
    )
  );

-- Team members: insert usage on their jobs
CREATE POLICY "member_insert_usage" ON inventory_usage
  FOR INSERT WITH CHECK (
    logged_by IN (
      SELECT id FROM team_members WHERE user_id = auth.uid() AND is_active = true
    )
    AND item_id IN (
      SELECT id FROM inventory_items WHERE business_id IN (
        SELECT business_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Team members: read usage they logged
CREATE POLICY "member_read_own_usage" ON inventory_usage
  FOR SELECT USING (
    logged_by IN (
      SELECT id FROM team_members WHERE user_id = auth.uid()
    )
  );

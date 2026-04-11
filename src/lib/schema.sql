-- =============================================
-- Daiva Automobiles — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. INVENTORY
-- =============================================
CREATE TABLE IF NOT EXISTS inventory (
  item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barcode TEXT UNIQUE,
  part_name TEXT NOT NULL,
  category TEXT,
  bike_model TEXT,
  cost_a NUMERIC(10,2) NOT NULL DEFAULT 0,   -- purchase cost
  cost_b NUMERIC(10,2) NOT NULL DEFAULT 0,   -- selling price
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 18,
  stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. MECHANICS
-- =============================================
CREATE TABLE IF NOT EXISTS mechanics (
  mechanic_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  commission_percent NUMERIC(5,2) NOT NULL CHECK (commission_percent >= 1 AND commission_percent <= 10),
  shop_name TEXT,
  area TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. CUSTOMERS
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
  customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  vehicle_number TEXT,
  bike_model TEXT,
  year INTEGER,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. SUPPLIERS
-- =============================================
CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. SALES
-- =============================================
CREATE TABLE IF NOT EXISTS sales (
  sale_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id TEXT NOT NULL UNIQUE,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sale_source TEXT NOT NULL DEFAULT 'Walk-in'
    CHECK (sale_source IN ('Walk-in', 'Mechanic', 'Online', 'Other')),
  mechanic_id UUID REFERENCES mechanics(mechanic_id),
  customer_id UUID REFERENCES customers(customer_id),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL DEFAULT 'Cash'
    CHECK (payment_type IN ('Cash', 'UPI', 'Partial')),
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_receipt BOOLEAN NOT NULL DEFAULT false,
  sale_status TEXT NOT NULL DEFAULT 'Completed'
    CHECK (sale_status IN ('Completed', 'Pending', 'Cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. CART ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory(item_id),
  barcode TEXT,
  part_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  selling_price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2) NOT NULL,
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL,
  profit NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. MECHANIC LEDGER
-- =============================================
CREATE TABLE IF NOT EXISTS mechanic_ledger (
  ledger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mechanic_id UUID NOT NULL REFERENCES mechanics(mechanic_id),
  sale_id UUID NOT NULL REFERENCES sales(sale_id),
  bill_id TEXT NOT NULL,
  grand_total NUMERIC(10,2) NOT NULL,
  commission_percent NUMERIC(5,2) NOT NULL,   -- snapshot at time of sale
  commission_amount NUMERIC(10,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Unpaid'
    CHECK (payment_status IN ('Unpaid', 'Paid')),
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_date DATE,
  payment_month TEXT NOT NULL,   -- YYYY-MM
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. PURCHASES (stock-in)
-- =============================================
CREATE TABLE IF NOT EXISTS purchases (
  purchase_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES suppliers(supplier_id),
  item_id UUID REFERENCES inventory(item_id),
  barcode TEXT,
  part_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  cost_per_unit NUMERIC(10,2) NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. STOCK LEDGER
-- =============================================
CREATE TABLE IF NOT EXISTS stock_ledger (
  ledger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES inventory(item_id),
  barcode TEXT,
  qty_change INTEGER NOT NULL,
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('Sale', 'Purchase', 'Adjustment', 'Return')),
  ref_bill_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. EXPENSES
-- =============================================
CREATE TABLE IF NOT EXISTS expenses (
  expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'Cash',
  vendor TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. INVESTMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS investments (
  investment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL
    CHECK (type IN ('Own Money', 'Bank Loan', 'Borrowed - Family', 'Borrowed - Friend', 'Other')),
  source TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  is_repaid BOOLEAN NOT NULL DEFAULT false,
  repaid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. SETTINGS
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PHASE 3 TABLES (create now, use later)
-- =============================================
CREATE TABLE IF NOT EXISTS ai_insights (
  insight_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  insight_text TEXT NOT NULL,
  data_period TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_chat_history (
  chat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  asked_at TIMESTAMPTZ DEFAULT NOW(),
  tokens_used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS upi_requests (
  request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id TEXT NOT NULL,
  customer_phone TEXT,
  amount NUMERIC(10,2) NOT NULL,
  upi_request_id TEXT,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Paid', 'Failed', 'Expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- =============================================
-- DEFAULT SETTINGS
-- =============================================
INSERT INTO settings (key, value) VALUES
  ('shop_name', 'Daiva Automobiles'),
  ('phone', '+91 9640286867'),
  ('location', 'Buttayagudem, Opp Current Substation Office'),
  ('gst_default', '18'),
  ('currency', 'INR'),
  ('pin_hash', '6206'),
  ('merchant_upi_id', '')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- SEED INVENTORY (sample parts)
-- =============================================
INSERT INTO inventory (barcode, part_name, category, bike_model, cost_a, cost_b, gst_percent, stock, reorder_level)
VALUES
  ('8901234567890', 'Brake Pad', 'Brakes', 'Hero Splendor', 120, 180, 18, 15, 5),
  ('8901234567891', 'Clutch Cable', 'Engine', 'Bajaj Pulsar', 90, 140, 18, 8, 3),
  ('8901234567892', 'Engine Oil 1L', 'Oils', 'Honda Shine', 320, 420, 18, 20, 8),
  ('8901234567893', 'Indicator Bulb', 'Electricals', 'TVS Apache', 40, 70, 18, 2, 5),
  ('8901234567894', 'Air Filter', 'Engine', 'Hero HF Deluxe', 110, 160, 18, 6, 3)
ON CONFLICT (barcode) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY (open for now — add auth later)
-- =============================================
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE upi_requests ENABLE ROW LEVEL SECURITY;

-- Allow all operations via anon key (PIN protects app, not DB)
CREATE POLICY "Allow all" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON cart_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON mechanics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON mechanic_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stock_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON investments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ai_insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ai_chat_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON upi_requests FOR ALL USING (true) WITH CHECK (true);

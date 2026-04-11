import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
})

export type Database = {
  public: {
    Tables: {
      inventory: {
        Row: InventoryItem
        Insert: Omit<InventoryItem, 'item_id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<InventoryItem, 'item_id' | 'created_at'>>
      }
      sales: {
        Row: Sale
        Insert: Omit<Sale, 'sale_id' | 'created_at'>
        Update: Partial<Omit<Sale, 'sale_id' | 'created_at'>>
      }
      mechanics: {
        Row: Mechanic
        Insert: Omit<Mechanic, 'mechanic_id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Mechanic, 'mechanic_id' | 'created_at'>>
      }
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'customer_id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Customer, 'customer_id' | 'created_at'>>
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, 'expense_id' | 'created_at'>
        Update: Partial<Omit<Expense, 'expense_id' | 'created_at'>>
      }
      investments: {
        Row: Investment
        Insert: Omit<Investment, 'investment_id' | 'created_at'>
        Update: Partial<Omit<Investment, 'investment_id' | 'created_at'>>
      }
      settings: {
        Row: { key: string; value: string }
        Insert: { key: string; value: string }
        Update: { value: string }
      }
    }
  }
}

export interface InventoryItem {
  item_id: string
  barcode: string | null
  part_name: string
  category: string | null
  bike_model: string | null
  cost_a: number
  cost_b: number
  gst_percent: number
  stock: number
  reorder_level: number
  created_at: string
  updated_at: string
}

export interface Sale {
  sale_id: string
  bill_id: string
  sale_date: string
  sale_source: 'Walk-in' | 'Mechanic' | 'Online' | 'Other'
  mechanic_id: string | null
  customer_id: string | null
  subtotal: number
  discount: number
  gst_amount: number
  grand_total: number
  payment_type: 'Cash' | 'UPI' | 'Partial'
  paid_amount: number
  balance_due: number
  tax_receipt: boolean
  sale_status: 'Completed' | 'Pending' | 'Cancelled'
  created_at: string
}

export interface CartItem {
  cart_item_id: string
  sale_id: string
  item_id: string
  barcode: string | null
  part_name: string
  qty: number
  selling_price: number
  cost_price: number
  gst_percent: number
  line_total: number
  profit: number
}

export interface Mechanic {
  mechanic_id: string
  name: string
  phone: string
  commission_percent: number
  shop_name: string | null
  area: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface MechanicLedger {
  ledger_id: string
  mechanic_id: string
  sale_id: string
  bill_id: string
  grand_total: number
  commission_percent: number
  commission_amount: number
  payment_status: 'Unpaid' | 'Paid'
  paid_amount: number
  paid_date: string | null
  payment_month: string
  created_at: string
}

export interface Customer {
  customer_id: string
  name: string
  phone: string | null
  vehicle_number: string | null
  bike_model: string | null
  year: number | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface Expense {
  expense_id: string
  category: string
  description: string | null
  amount: number
  payment_type: string
  vendor: string | null
  is_paid: boolean
  expense_date: string
  created_at: string
}

export interface Investment {
  investment_id: string
  investment_date: string
  type: 'Own Money' | 'Bank Loan' | 'Borrowed - Family' | 'Borrowed - Friend' | 'Other'
  source: string
  description: string
  amount: number
  is_repaid: boolean
  repaid_amount: number
  notes: string | null
  created_at: string
}

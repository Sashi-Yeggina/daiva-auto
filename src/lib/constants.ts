export const BIKE_MODELS = [
  'Hero Splendor',
  'Bajaj Pulsar',
  'Honda Shine',
  'TVS Apache',
  'Hero HF Deluxe',
  'Other',
]

export const EXPENSE_CATEGORIES = [
  'Electricity',
  'Internet',
  'Rent',
  'Shop Cleaning',
  'Tea & Water',
  'Packaging',
  'Transport',
  'Misc',
]

export const INVESTMENT_TYPES = [
  'Own Money',
  'Bank Loan',
  'Borrowed - Family',
  'Borrowed - Friend',
  'Other',
] as const

export const SALE_SOURCES = ['Walk-in', 'Mechanic', 'Online', 'Other'] as const

export const PAYMENT_TYPES = ['Cash', 'UPI', 'Partial'] as const

export const SHOP_INFO = {
  name: 'Daiva Automobiles',
  phone: '+91 9640286867',
  location: 'Buttayagudem, Opp Current Substation Office',
  gst: 18,
}

export const FEATURES = {
  AI_INSIGHTS: false,
  EMAIL_REPORTS: false,
  MONTHLY_REPORT: false,
  UPI_COLLECT: false,
}

export function generateBillId(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `INV-${yy}${mm}${dd}-${rand}`
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatYYYYMM(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Discount validation — from CLAUDE.md
export function calculateMaxDiscount(
  cart: Array<{ qty: number; sellingPrice: number; costPrice: number }>,
  mechanicId: string | null
): number {
  if (mechanicId) return 0
  const subtotal = cart.reduce((sum, i) => sum + i.qty * i.sellingPrice, 0)
  const totalCost = cart.reduce((sum, i) => sum + i.qty * i.costPrice, 0)
  const capByPercent = subtotal * 0.1
  const capByCost = subtotal - totalCost
  return Math.max(0, Math.min(capByPercent, capByCost))
}

// Seed data
export const SEED_PARTS = [
  { barcode: '8901234567890', part_name: 'Brake Pad', category: 'Brakes', bike_model: 'Hero Splendor', cost_a: 120, cost_b: 180, gst_percent: 18, stock: 15, reorder_level: 5 },
  { barcode: '8901234567891', part_name: 'Clutch Cable', category: 'Engine', bike_model: 'Bajaj Pulsar', cost_a: 90, cost_b: 140, gst_percent: 18, stock: 8, reorder_level: 3 },
  { barcode: '8901234567892', part_name: 'Engine Oil 1L', category: 'Oils', bike_model: 'Honda Shine', cost_a: 320, cost_b: 420, gst_percent: 18, stock: 20, reorder_level: 8 },
  { barcode: '8901234567893', part_name: 'Indicator Bulb', category: 'Electricals', bike_model: 'TVS Apache', cost_a: 40, cost_b: 70, gst_percent: 18, stock: 2, reorder_level: 5 },
  { barcode: '8901234567894', part_name: 'Air Filter', category: 'Engine', bike_model: 'Hero HF Deluxe', cost_a: 110, cost_b: 160, gst_percent: 18, stock: 6, reorder_level: 3 },
]

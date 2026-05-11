import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

// ============================================================================
// Types
// ============================================================================
interface ProfitMetrics {
  total_sales: number
  total_cogs: number
  total_expenses: number
  total_commissions: number
  net_profit: number
  profit_margin_percent: number
}

interface MechanicPayout {
  mechanic_id: string
  mechanic_name: string
  mechanic_phone: string
  referral_count: number
  total_commission: number
  paid_amount: number
  outstanding_amount: number
  unpaid_count: number
}

interface ExpenseBreakdown {
  category: string
  total_amount: number
  paid_amount: number
  pending_amount: number
  transaction_count: number
}

interface StockItem {
  item_id: string
  barcode: string
  part_name: string
  bike_model: string
  stock: number
  cost_a: number
  total_value: number
  stock_status: string
  sold_last_30_days: number
}

interface TopItem {
  item_id: string
  barcode: string
  part_name: string
  bike_model: string
  cost_a: number
  selling_price: number
  total_qty_sold: number
  total_revenue: number
  total_cost: number
  total_profit: number
  profit_margin_percent: number
  period: string
}

interface DailySales {
  sale_day: string
  bill_count: number
  total_sales: number
  total_cogs: number
}

// ============================================================================
// Component
// ============================================================================
export default function Reports() {
  const [periodType, setPeriodType] = useState<'today' | 'week' | 'month' | 'last_month' | 'custom'>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(1)))
  const [endDate, setEndDate] = useState(new Date())

  // Data states
  const [profitMetrics, setProfitMetrics] = useState<ProfitMetrics | null>(null)
  const [mechanicPayouts, setMechanicPayouts] = useState<MechanicPayout[]>([])
  const [expenses, setExpenses] = useState<ExpenseBreakdown[]>([])
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState({
    profit: true,
    mechanics: true,
    expenses: true,
    stock: true,
    metrics: true,
    chart: true,
  })

  // ============================================================================
  // Calculate Period Dates
  // ============================================================================
  useEffect(() => {
    const today = new Date()
    let start = new Date()
    let end = new Date()

    switch (periodType) {
      case 'today':
        start = new Date(today)
        end = new Date(today)
        break
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        start = weekStart
        end = today
        break
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = today
        break
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'custom':
        if (customStart && customEnd) {
          start = new Date(customStart)
          end = new Date(customEnd)
        }
        break
    }

    setStartDate(start)
    setEndDate(end)
  }, [periodType, customStart, customEnd])

  // ============================================================================
  // Fetch All Data
  // ============================================================================
  useEffect(() => {
    if (!startDate || !endDate) return
    fetchAllData()
  }, [startDate, endDate])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchProfitMetrics(),
        fetchMechanicPayouts(),
        fetchExpenses(),
        fetchTopItems(),
        fetchDailySales(),
        fetchLowStockItems(),
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // 1. PROFIT BREAKDOWN
  // ============================================================================
  const fetchProfitMetrics = async () => {
    try {
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      // Get all sales for period
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('sale_id, grand_total')
        .eq('sale_status', 'Completed')
        .gte('sale_date', startStr)
        .lte('sale_date', endStr)

      if (salesError) throw salesError

      // Get all cart items for COGS
      const { data: cartData, error: cartError } = await supabase
        .from('cart_items')
        .select('qty, cost_price')
        .in('sale_id', (salesData || []).map(s => s.sale_id))

      if (cartError) throw cartError

      // Get expenses
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', startStr)
        .lte('expense_date', endStr)

      if (expenseError) throw expenseError

      // Get commissions
      const { data: commissionData, error: commissionError } = await supabase
        .from('mechanic_ledger')
        .select('commission_amount')
        .gte('created_at', startStr)
        .lte('created_at', endStr)

      if (commissionError) throw commissionError

      // Calculate totals
      const totalSales = (salesData || []).reduce((sum, s) => sum + (s.grand_total || 0), 0)
      const totalCogs = (cartData || []).reduce((sum, c) => sum + (c.qty * c.cost_price), 0)
      const totalExpenses = (expenseData || []).reduce((sum, e) => sum + (e.amount || 0), 0)
      const totalCommissions = (commissionData || []).reduce((sum, c) => sum + (c.commission_amount || 0), 0)
      const netProfit = totalSales - totalCogs - totalExpenses - totalCommissions
      const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100) : 0

      setProfitMetrics({
        total_sales: totalSales,
        total_cogs: totalCogs,
        total_expenses: totalExpenses,
        total_commissions: totalCommissions,
        net_profit: netProfit,
        profit_margin_percent: profitMargin,
      })
    } catch (error) {
      console.error('Profit metrics error:', error)
    }
  }

  // ============================================================================
  // 2. MECHANIC PAYOUTS
  // ============================================================================
  const fetchMechanicPayouts = async () => {
    const { data, error } = await supabase
      .from('mechanic_commission_summary')
      .select('*')
      .gte('payment_month', startDate.toISOString().split('T')[0])
      .lte('payment_month', endDate.toISOString().split('T')[0])
      .order('total_commission', { ascending: false })

    if (error) {
      console.error('Mechanic payouts error:', error)
      return
    }

    setMechanicPayouts(data || [])
  }

  // ============================================================================
  // 3. EXPENSES BREAKDOWN
  // ============================================================================
  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expense_summary_by_category')
      .select('*')
      .gte('expense_month', startDate.toISOString().split('T')[0])
      .lte('expense_month', endDate.toISOString().split('T')[0])
      .order('total_amount', { ascending: false })

    if (error) {
      console.error('Expenses error:', error)
      return
    }

    setExpenses(data || [])
  }

  // ============================================================================
  // 4. TOP SELLING ITEMS
  // ============================================================================
  const fetchTopItems = async () => {
    const { data, error } = await supabase
      .from('top_selling_items')
      .select('*')
      .gte('period', startDate.toISOString().split('T')[0])
      .lte('period', endDate.toISOString().split('T')[0])
      .order('total_profit', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Top items error:', error)
      return
    }

    setTopItems(data || [])
  }

  // ============================================================================
  // 5. DAILY SALES CHART
  // ============================================================================
  const fetchDailySales = async () => {
    const { data, error } = await supabase
      .from('daily_sales_summary')
      .select('*')
      .gte('sale_day', startDate.toISOString().split('T')[0])
      .lte('sale_day', endDate.toISOString().split('T')[0])
      .order('sale_day', { ascending: true })

    if (error) {
      console.error('Daily sales error:', error)
      return
    }

    setDailySales(data || [])
  }

  // ============================================================================
  // 6. LOW STOCK ITEMS
  // ============================================================================
  const fetchLowStockItems = async () => {
    const { data, error } = await supabase
      .from('inventory_valuation')
      .select('*')
      .eq('stock_status', 'Low')
      .order('total_value', { ascending: false })

    if (error) {
      console.error('Low stock error:', error)
      return
    }

    setLowStockItems(data || [])
  }

  // ============================================================================
  // UPDATE MECHANIC PAYMENT STATUS
  // ============================================================================
  const markMechanicAsPaid = async (mechanicId: string) => {
    const { error } = await supabase
      .from('mechanic_ledger')
      .update({ payment_status: 'Paid', paid_date: new Date().toISOString() })
      .eq('mechanic_id', mechanicId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (!error) {
      fetchMechanicPayouts()
    }
  }

  // ============================================================================
  // PRINT FUNCTION
  // ============================================================================
  const handlePrint = () => {
    window.print()
  }

  // ============================================================================
  // EXPORT TO EXCEL
  // ============================================================================
  const handleExportExcel = async () => {
    // Simple CSV export
    const data = {
      'Period': `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      'Total Sales': profitMetrics?.total_sales || 0,
      'COGS': profitMetrics?.total_cogs || 0,
      'Expenses': profitMetrics?.total_expenses || 0,
      'Commissions': profitMetrics?.total_commissions || 0,
      'Net Profit': profitMetrics?.net_profit || 0,
      'Profit Margin %': profitMetrics?.profit_margin_percent || 0,
    }

    const csv = Object.keys(data).map(key => `${key},${data[key as keyof typeof data]}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ============================================================================
  // TOGGLE SECTION
  // ============================================================================
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  // ============================================================================
  // RENDER LOADING
  // ============================================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
          <p className="text-brand-text-secondary mt-4">Loading reports...</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <div className="min-h-screen bg-brand-bg p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-text mb-2">📊 Reports Dashboard</h1>
        <p className="text-brand-text-secondary">Complete business analytics and tracking</p>
      </div>

      {/* Period Selector */}
      <div className="mb-6 bg-brand-surface border border-brand-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-brand-text mb-3 uppercase tracking-wide">Period Selection</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {(['today', 'week', 'month', 'last_month'] as const).map(period => (
            <button
              key={period}
              onClick={() => setPeriodType(period)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                periodType === period
                  ? 'bg-brand-orange text-white'
                  : 'bg-brand-border text-brand-text-secondary hover:bg-brand-border/80'
              }`}
            >
              {period === 'today' && '📅 Today'}
              {period === 'week' && '📆 This Week'}
              {period === 'month' && '📊 This Month'}
              {period === 'last_month' && '🗓️ Last Month'}
            </button>
          ))}
          <button
            onClick={() => setPeriodType('custom')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              periodType === 'custom'
                ? 'bg-brand-orange text-white'
                : 'bg-brand-border text-brand-text-secondary hover:bg-brand-border/80'
            }`}
          >
            📌 Custom Range
          </button>
        </div>

        {/* Custom Date Range */}
        {periodType === 'custom' && (
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="flex-1 px-4 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:border-brand-orange"
            />
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="flex-1 px-4 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-text focus:outline-none focus:border-brand-orange"
            />
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: PROFIT BREAKDOWN */}
      {/* ===================================================================== */}
      <section className="mb-6 bg-brand-surface border border-brand-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('profit')}
          className="w-full px-6 py-4 flex justify-between items-center bg-brand-surface hover:bg-brand-border/50 transition"
        >
          <h2 className="text-lg font-bold text-brand-text">💰 Profit Breakdown</h2>
          <span className="text-xl">{expandedSections.profit ? '▼' : '▶'}</span>
        </button>

        {expandedSections.profit && profitMetrics && (
          <div className="p-6 space-y-4 border-t border-brand-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-brand-bg p-4 rounded-lg border border-brand-border/50">
                <p className="text-brand-text-secondary text-sm mb-1">Total Sales Revenue</p>
                <p className="text-2xl font-bold text-brand-text">₹{profitMetrics.total_sales.toLocaleString()}</p>
                <p className="text-xs text-brand-text-secondary mt-1">100.0%</p>
              </div>

              <div className="bg-brand-bg p-4 rounded-lg border border-brand-border/50">
                <p className="text-brand-text-secondary text-sm mb-1">Cost of Goods Sold (COGS)</p>
                <p className="text-2xl font-bold text-red-400">-₹{profitMetrics.total_cogs.toLocaleString()}</p>
                <p className="text-xs text-brand-text-secondary mt-1">
                  {((profitMetrics.total_cogs / profitMetrics.total_sales) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-brand-bg p-4 rounded-lg border border-brand-border/50">
                <p className="text-brand-text-secondary text-sm mb-1">Shop Expenses</p>
                <p className="text-2xl font-bold text-red-400">-₹{profitMetrics.total_expenses.toLocaleString()}</p>
                <p className="text-xs text-brand-text-secondary mt-1">
                  {((profitMetrics.total_expenses / profitMetrics.total_sales) * 100).toFixed(1)}%
                </p>
              </div>

              <div className="bg-brand-bg p-4 rounded-lg border border-brand-border/50">
                <p className="text-brand-text-secondary text-sm mb-1">Mechanic Commissions</p>
                <p className="text-2xl font-bold text-red-400">-₹{profitMetrics.total_commissions.toLocaleString()}</p>
                <p className="text-xs text-brand-text-secondary mt-1">
                  {((profitMetrics.total_commissions / profitMetrics.total_sales) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Net Profit Card */}
            <div className="bg-gradient-to-r from-brand-orange/20 to-brand-accent/20 p-6 rounded-lg border border-brand-orange/50">
              <p className="text-brand-text-secondary text-sm mb-2">NET PROFIT</p>
              <p className="text-4xl font-bold text-brand-orange">₹{profitMetrics.net_profit.toLocaleString()}</p>
              <p className="text-lg font-semibold text-brand-text mt-2">
                {profitMetrics.profit_margin_percent.toFixed(1)}% Margin
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-4">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-brand-orange text-white rounded-lg font-medium hover:bg-brand-orange/90"
              >
                📄 Print
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                📊 Export CSV
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECTION 2: MECHANIC PAYOUTS */}
      {/* ===================================================================== */}
      <section className="mb-6 bg-brand-surface border border-brand-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('mechanics')}
          className="w-full px-6 py-4 flex justify-between items-center bg-brand-surface hover:bg-brand-border/50 transition"
        >
          <h2 className="text-lg font-bold text-brand-text">💼 Mechanic Commissions</h2>
          <span className="text-xl">{expandedSections.mechanics ? '▼' : '▶'}</span>
        </button>

        {expandedSections.mechanics && (
          <div className="p-6 space-y-4 border-t border-brand-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-2 px-3 text-brand-text-secondary font-semibold">Mechanic</th>
                  <th className="text-left py-2 px-3 text-brand-text-secondary font-semibold">Referrals</th>
                  <th className="text-right py-2 px-3 text-brand-text-secondary font-semibold">Amount</th>
                  <th className="text-left py-2 px-3 text-brand-text-secondary font-semibold">Status</th>
                  <th className="text-center py-2 px-3 text-brand-text-secondary font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {mechanicPayouts.map(mechanic => (
                  <tr key={mechanic.mechanic_id} className="border-b border-brand-border/50 hover:bg-brand-bg/50">
                    <td className="py-3 px-3 text-brand-text font-medium">
                      {mechanic.mechanic_name}
                      <p className="text-xs text-brand-text-secondary">{mechanic.mechanic_phone}</p>
                    </td>
                    <td className="py-3 px-3 text-brand-text">{mechanic.referral_count}</td>
                    <td className="py-3 px-3 text-right text-brand-orange font-semibold">
                      ₹{mechanic.total_commission.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          mechanic.outstanding_amount === 0
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-red-900/30 text-red-400'
                        }`}
                      >
                        {mechanic.outstanding_amount === 0 ? '✓ Paid' : `₹${mechanic.outstanding_amount.toLocaleString()} Due`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {mechanic.outstanding_amount > 0 && (
                        <button
                          onClick={() => markMechanicAsPaid(mechanic.mechanic_id)}
                          className="px-3 py-1 bg-brand-orange text-white rounded text-xs font-medium hover:bg-brand-orange/90"
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-brand-border">
              <div className="bg-brand-bg p-4 rounded-lg">
                <p className="text-xs text-brand-text-secondary mb-1">Total Due</p>
                <p className="text-xl font-bold text-brand-text">
                  ₹{mechanicPayouts.reduce((sum, m) => sum + m.total_commission, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-brand-bg p-4 rounded-lg">
                <p className="text-xs text-brand-text-secondary mb-1">Paid</p>
                <p className="text-xl font-bold text-green-400">
                  ₹{mechanicPayouts.reduce((sum, m) => sum + m.paid_amount, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-brand-bg p-4 rounded-lg">
                <p className="text-xs text-brand-text-secondary mb-1">Outstanding</p>
                <p className="text-xl font-bold text-red-400">
                  ₹{mechanicPayouts.reduce((sum, m) => sum + m.outstanding_amount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECTION 3: DAILY SALES CHART */}
      {/* ===================================================================== */}
      <section className="mb-6 bg-brand-surface border border-brand-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('chart')}
          className="w-full px-6 py-4 flex justify-between items-center bg-brand-surface hover:bg-brand-border/50 transition"
        >
          <h2 className="text-lg font-bold text-brand-text">📈 Sales Trend</h2>
          <span className="text-xl">{expandedSections.chart ? '▼' : '▶'}</span>
        </button>

        {expandedSections.chart && dailySales.length > 0 && (
          <div className="p-6 border-t border-brand-border">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="sale_day" stroke="#AAAAAA" />
                <YAxis stroke="#AAAAAA" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A' }}
                  labelStyle={{ color: '#FFF' }}
                />
                <Legend />
                <Bar dataKey="total_sales" fill="#E85000" name="Sales" />
                <Bar dataKey="total_cogs" fill="#CC1100" name="COGS" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECTION 4: EXPENSE BREAKDOWN */}
      {/* ===================================================================== */}
      <section className="mb-6 bg-brand-surface border border-brand-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('expenses')}
          className="w-full px-6 py-4 flex justify-between items-center bg-brand-surface hover:bg-brand-border/50 transition"
        >
          <h2 className="text-lg font-bold text-brand-text">💸 Shop Expenses</h2>
          <span className="text-xl">{expandedSections.expenses ? '▼' : '▶'}</span>
        </button>

        {expandedSections.expenses && (
          <div className="p-6 space-y-4 border-t border-brand-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left py-2 px-3 text-brand-text-secondary font-semibold">Category</th>
                  <th className="text-right py-2 px-3 text-brand-text-secondary font-semibold">Amount</th>
                  <th className="text-right py-2 px-3 text-brand-text-secondary font-semibold">Paid</th>
                  <th className="text-right py-2 px-3 text-brand-text-secondary font-semibold">Pending</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.category} className="border-b border-brand-border/50 hover:bg-brand-bg/50">
                    <td className="py-3 px-3 text-brand-text font-medium">{exp.category}</td>
                    <td className="py-3 px-3 text-right text-brand-text">₹{exp.total_amount.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-green-400">✓ ₹{exp.paid_amount.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-red-400">₹{exp.pending_amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-brand-border">
              <div className="bg-brand-bg p-4 rounded-lg">
                <p className="text-xs text-brand-text-secondary mb-1">Total Expenses</p>
                <p className="text-xl font-bold text-brand-text">
                  ₹{expenses.reduce((sum, e) => sum + e.total_amount, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-brand-bg p-4 rounded-lg">
                <p className="text-xs text-brand-text-secondary mb-1">Paid</p>
                <p className="text-xl font-bold text-green-400">
                  ₹{expenses.reduce((sum, e) => sum + e.paid_amount, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-brand-bg p-4 rounded-lg">
                <p className="text-xs text-brand-text-secondary mb-1">Pending</p>
                <p className="text-xl font-bold text-red-400">
                  ₹{expenses.reduce((sum, e) => sum + e.pending_amount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECTION 5: TOP ITEMS & METRICS */}
      {/* ===================================================================== */}
      <section className="mb-6 bg-brand-surface border border-brand-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('metrics')}
          className="w-full px-6 py-4 flex justify-between items-center bg-brand-surface hover:bg-brand-border/50 transition"
        >
          <h2 className="text-lg font-bold text-brand-text">📊 Top Items & Metrics</h2>
          <span className="text-xl">{expandedSections.metrics ? '▼' : '▶'}</span>
        </button>

        {expandedSections.metrics && (
          <div className="p-6 space-y-6 border-t border-brand-border">
            <div>
              <h3 className="font-semibold text-brand-text mb-3">Best Selling Items (by Profit)</h3>
              <div className="space-y-2">
                {topItems.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-brand-bg p-3 rounded-lg border border-brand-border/50">
                    <div className="flex-1">
                      <p className="font-medium text-brand-text">{item.part_name}</p>
                      <p className="text-xs text-brand-text-secondary">{item.bike_model} • {item.total_qty_sold} sold</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-orange">₹{item.total_profit.toLocaleString()}</p>
                      <p className="text-xs text-brand-text-secondary">{item.profit_margin_percent}% margin</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-brand-bg p-3 rounded-lg border border-brand-border/50">
                <p className="text-xs text-brand-text-secondary mb-1">Avg Bill</p>
                <p className="text-lg font-bold text-brand-text">
                  ₹{profitMetrics ? (profitMetrics.total_sales / (dailySales.length || 1)).toLocaleString() : 0}
                </p>
              </div>
              <div className="bg-brand-bg p-3 rounded-lg border border-brand-border/50">
                <p className="text-xs text-brand-text-secondary mb-1">Total Bills</p>
                <p className="text-lg font-bold text-brand-text">{dailySales.reduce((sum, d) => sum + d.bill_count, 0)}</p>
              </div>
              <div className="bg-brand-bg p-3 rounded-lg border border-brand-border/50">
                <p className="text-xs text-brand-text-secondary mb-1">COGS %</p>
                <p className="text-lg font-bold text-brand-text">
                  {profitMetrics ? ((profitMetrics.total_cogs / profitMetrics.total_sales) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECTION 6: LOW STOCK ITEMS */}
      {/* ===================================================================== */}
      <section className="mb-6 bg-brand-surface border border-brand-border rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection('stock')}
          className="w-full px-6 py-4 flex justify-between items-center bg-brand-surface hover:bg-brand-border/50 transition"
        >
          <h2 className="text-lg font-bold text-brand-text">⚠️ Low Stock Items ({lowStockItems.length})</h2>
          <span className="text-xl">{expandedSections.stock ? '▼' : '▶'}</span>
        </button>

        {expandedSections.stock && (
          <div className="p-6 border-t border-brand-border overflow-x-auto">
            {lowStockItems.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="text-left py-2 px-3 text-brand-text-secondary font-semibold">Item</th>
                    <th className="text-center py-2 px-3 text-brand-text-secondary font-semibold">Current</th>
                    <th className="text-center py-2 px-3 text-brand-text-secondary font-semibold">Reorder</th>
                    <th className="text-right py-2 px-3 text-brand-text-secondary font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map(item => (
                    <tr key={item.item_id} className="border-b border-brand-border/50 hover:bg-brand-bg/50">
                      <td className="py-3 px-3 text-brand-text font-medium">
                        {item.part_name}
                        <p className="text-xs text-brand-text-secondary">{item.bike_model}</p>
                      </td>
                      <td className="py-3 px-3 text-center text-red-400 font-bold">{item.stock}</td>
                      <td className="py-3 px-3 text-center text-brand-text-secondary">{item.reorder_level}</td>
                      <td className="py-3 px-3 text-right text-brand-text font-semibold">
                        ₹{item.total_value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-6 text-brand-text-secondary">✓ All items are in stock</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

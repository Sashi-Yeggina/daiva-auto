import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/constants'

interface DailySummary {
  date: string
  total: number
  bills: number
  profit: number
}

export default function Reports() {
  const [pinVerified, setPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [storedPin, setStoredPin] = useState('6206')
  const navigate = useNavigate()

  // Dashboard data
  const [todaySales, setTodaySales] = useState(0)
  const [todayBills, setTodayBills] = useState(0)
  const [todayProfit, setTodayProfit] = useState(0)
  const [todayExpenses, setTodayExpenses] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
  const [pendingDues, setPendingDues] = useState<Array<{ bill_id: string; grand_total: number; balance_due: number; sale_date: string }>>([])
  const [lowStock, setLowStock] = useState<Array<{ part_name: string; stock: number; reorder_level: number }>>([])
  const [weeklyData, setWeeklyData] = useState<DailySummary[]>([])
  const [totalCapital, setTotalCapital] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'pin_hash').single().then(({ data }) => {
      if (data?.value) setStoredPin(data.value)
    })
  }, [])

  useEffect(() => {
    if (pinVerified) loadData()
  }, [pinVerified])

  const verifyPin = () => {
    if (pinInput === storedPin) {
      setPinVerified(true)
    } else {
      setPinInput('')
      alert('Incorrect PIN')
    }
  }

  const loadData = async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)

    const [salesRes, expRes, invRes, lowStockRes] = await Promise.all([
      supabase.from('sales').select('*, cart_items(cost_price, qty)').gte('sale_date', `${today}T00:00:00`).eq('sale_status', 'Completed'),
      supabase.from('expenses').select('amount').gte('expense_date', today).lte('expense_date', today),
      supabase.from('investments').select('amount'),
      supabase.from('inventory').select('part_name, stock, reorder_level').lte('stock', supabase.rpc as unknown as number),
    ])

    // Simplified: fetch inventory with low stock
    const { data: lowStockData } = await supabase.from('inventory').select('part_name, stock, reorder_level')
    const lowStockItems = (lowStockData || []).filter(i => i.stock <= i.reorder_level)
    setLowStock(lowStockItems)

    if (salesRes.data) {
      setTodayBills(salesRes.data.length)
      setTodaySales(salesRes.data.reduce((s, sale) => s + sale.grand_total, 0))
    }
    if (expRes.data) setTodayExpenses(expRes.data.reduce((s, e) => s + e.amount, 0))
    if (invRes.data) setTotalCapital(invRes.data.reduce((s, i) => s + i.amount, 0))

    // All-time net profit
    const { data: allSales } = await supabase.from('sales').select('grand_total').eq('sale_status', 'Completed')
    const { data: allExp } = await supabase.from('expenses').select('amount')
    const totalRev = (allSales || []).reduce((s, sale) => s + sale.grand_total, 0)
    const totalExp = (allExp || []).reduce((s, e) => s + e.amount, 0)
    const np = Math.max(0, totalRev - totalExp)
    setNetProfit(np)
    setTodayProfit(Math.max(0, (salesRes.data || []).reduce((s, sale) => s + sale.grand_total, 0) - (expRes.data || []).reduce((s, e) => s + e.amount, 0)))

    // Pending dues
    const { data: dueData } = await supabase.from('sales').select('bill_id, grand_total, balance_due, sale_date').gt('balance_due', 0).order('sale_date', { ascending: false }).limit(10)
    setPendingDues(dueData || [])

    // Weekly data — last 7 days
    const days: DailySummary[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const { data: dayData } = await supabase.from('sales').select('grand_total').gte('sale_date', `${dateStr}T00:00:00`).lt('sale_date', `${dateStr}T23:59:59`).eq('sale_status', 'Completed')
      days.push({
        date: dateStr,
        total: (dayData || []).reduce((s, sale) => s + sale.grand_total, 0),
        bills: (dayData || []).length,
        profit: 0,
      })
    }
    setWeeklyData(days)

    setLoading(false)
  }

  if (!pinVerified) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <div className="bg-brand-card border border-brand-border rounded-xl p-8 max-w-sm w-full text-center">
          <BarChart2 size={32} className="text-brand-orange mx-auto mb-4" />
          <h2 className="font-bold text-lg mb-2">Reports — PIN Required</h2>
          <p className="text-brand-muted text-sm mb-6">Enter your PIN to view reports</p>
          <input
            type="password"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && verifyPin()}
            maxLength={4}
            placeholder="Enter PIN"
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-3 text-center text-xl tracking-widest focus:outline-none focus:border-brand-orange mb-4"
          />
          <button onClick={verifyPin} className="w-full bg-brand-orange hover:bg-orange-600 text-white py-3 rounded-lg font-medium">
            Unlock Reports
          </button>
        </div>
      </div>
    )
  }

  const maxSales = Math.max(...weeklyData.map(d => d.total), 1)
  const recoveryPct = totalCapital > 0 ? Math.min(100, (netProfit / totalCapital) * 100) : 0

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart2 size={22} className="text-brand-orange" />
        <h1 className="text-xl font-bold">Reports</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-brand-muted">Loading reports...</div>
      ) : (
        <>
          {/* Today's Summary */}
          <div className="bg-brand-card border border-brand-border rounded-xl p-4">
            <h2 className="font-semibold mb-3 text-brand-orange">Today's Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Bills', value: todayBills, unit: '', color: 'text-white' },
                { label: 'Sales', value: formatCurrency(todaySales), unit: '', color: 'text-white' },
                { label: 'Expenses', value: formatCurrency(todayExpenses), unit: '', color: 'text-red-400' },
                { label: 'Net Profit', value: formatCurrency(todayProfit), unit: '', color: 'text-green-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className={`font-bold text-lg ${color}`}>{value}</p>
                  <p className="text-brand-muted text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Capital Recovery */}
          <div className="bg-brand-card border border-brand-orange/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-brand-orange" />
              <h2 className="font-semibold">Capital Recovery</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <p className="text-brand-muted text-xs">Total Capital</p>
                <p className="font-bold">{formatCurrency(totalCapital)}</p>
              </div>
              <div>
                <p className="text-brand-muted text-xs">Cumulative Profit</p>
                <p className="font-bold text-green-400">{formatCurrency(netProfit)}</p>
              </div>
            </div>
            <div className="mb-1 flex justify-between text-xs text-brand-muted">
              <span>Recovered</span>
              <span className="text-brand-orange font-semibold">{recoveryPct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-brand-border rounded-full h-3">
              <div className="h-3 rounded-full btn-flame transition-all" style={{ width: `${recoveryPct}%` }} />
            </div>
            <p className="text-xs text-brand-muted mt-2">Still to recover: {formatCurrency(Math.max(0, totalCapital - netProfit))}</p>
          </div>

          {/* Weekly Chart */}
          <div className="bg-brand-card border border-brand-border rounded-xl p-4">
            <h2 className="font-semibold mb-4">Last 7 Days Sales</h2>
            <div className="flex items-end gap-1 h-24">
              {weeklyData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-brand-orange/70 hover:bg-brand-orange transition-all"
                    style={{ height: `${(d.total / maxSales) * 96}px`, minHeight: d.total > 0 ? '4px' : '0' }}
                    title={`${d.date}: ${formatCurrency(d.total)}`}
                  />
                  <p className="text-[9px] text-brand-muted">{new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Dues */}
          {pendingDues.length > 0 && (
            <div className="bg-brand-card border border-brand-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-yellow-400" />
                <h2 className="font-semibold">Pending Dues</h2>
              </div>
              <div className="space-y-2">
                {pendingDues.map(due => (
                  <div key={due.bill_id} className="flex justify-between items-center text-sm">
                    <div>
                      <p className="font-mono text-xs">{due.bill_id}</p>
                      <p className="text-brand-muted text-xs">{formatDate(due.sale_date)}</p>
                    </div>
                    <span className="text-red-400 font-semibold">{formatCurrency(due.balance_due)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Stock */}
          {lowStock.length > 0 && (
            <div className="bg-brand-card border border-brand-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-yellow-400" />
                <h2 className="font-semibold">Low Stock Alerts</h2>
              </div>
              <div className="space-y-2">
                {lowStock.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <p>{item.part_name}</p>
                    <div className="text-right">
                      <span className={`text-xs font-semibold ${item.stock <= 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                        Stock: {item.stock}
                      </span>
                      <p className="text-xs text-brand-muted">Reorder at: {item.reorder_level}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

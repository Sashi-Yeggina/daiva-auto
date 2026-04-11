import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, X, DollarSign, TrendingUp } from 'lucide-react'
import { supabase, Expense, Investment } from '../lib/supabase'
import { EXPENSE_CATEGORIES, INVESTMENT_TYPES, formatCurrency, formatDate } from '../lib/constants'

type ExpenseForm = Omit<Expense, 'expense_id' | 'created_at'>
type InvestmentForm = Omit<Investment, 'investment_id' | 'created_at'>

function calculateCapitalRecovery(investments: Investment[], totalNetProfit: number) {
  const totalCapital = investments.reduce((s, i) => s + i.amount, 0)
  const totalLoans = investments
    .filter(i => i.type.startsWith('Borrowed') || i.type === 'Bank Loan')
    .reduce((s, i) => s + i.amount, 0)
  const totalRepaid = investments.reduce((s, i) => s + i.repaid_amount, 0)
  const loansOutstanding = totalLoans - totalRepaid
  const recoveryPercent = totalCapital > 0 ? (totalNetProfit / totalCapital) * 100 : 0
  const stillToRecover = Math.max(0, totalCapital - totalNetProfit)
  return { totalCapital, totalLoans, loansOutstanding, recoveryPercent, stillToRecover }
}

export default function Expenses() {
  const [tab, setTab] = useState<'expenses' | 'investments'>('expenses')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [netProfit, setNetProfit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)

  const { register: regExp, handleSubmit: subExp, reset: resetExp, formState: { errors: errExp } } = useForm<ExpenseForm>()
  const { register: regInv, handleSubmit: subInv, reset: resetInv, watch: watchInv } = useForm<InvestmentForm>()
  const isRepaid = watchInv('is_repaid')

  const fetchData = async () => {
    const [expRes, invRes] = await Promise.all([
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('investments').select('*').order('investment_date', { ascending: false }),
    ])
    try {
      await supabase.rpc('get_net_profit')
    } catch {
      // RPC used for side effects; ignore failures
    }
    if (expRes.data) setExpenses(expRes.data)
    if (invRes.data) setInvestments(invRes.data)

    // Calculate net profit from sales + expenses
    const { data: salesData } = await supabase.from('sales').select('grand_total, sale_status')
    const { data: expData } = await supabase.from('expenses').select('amount')
    const totalRevenue = (salesData || []).filter(s => s.sale_status === 'Completed').reduce((s, sale) => s + sale.grand_total, 0)
    const totalExpenses = (expData || []).reduce((s, e) => s + e.amount, 0)
    setNetProfit(Math.max(0, totalRevenue - totalExpenses))

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const addExpense = async (data: ExpenseForm) => {
    const { error } = await supabase.from('expenses').insert({ ...data, amount: Number(data.amount) })
    if (error) { toast.error(error.message); return }
    toast.success('Expense added')
    setShowExpenseModal(false)
    fetchData()
  }

  const addInvestment = async (data: InvestmentForm) => {
    const { error } = await supabase.from('investments').insert({
      ...data,
      amount: Number(data.amount),
      repaid_amount: Number(data.repaid_amount) || 0,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Investment added')
    setShowInvestmentModal(false)
    fetchData()
  }

  const monthlyExpenses = expenses
    .filter(e => e.expense_date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, e) => s + e.amount, 0)

  const recovery = calculateCapitalRecovery(investments, netProfit)

  return (
    <div className="p-4 space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-brand-card border border-brand-border rounded-lg p-1">
        {(['expenses', 'investments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-medium capitalize transition-all ${tab === t ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Expenses Tab */}
      {tab === 'expenses' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Expenses</h1>
              <p className="text-brand-muted text-sm">This month: {formatCurrency(monthlyExpenses)}</p>
            </div>
            <button onClick={() => { resetExp({ category: 'Electricity', is_paid: true, payment_type: 'Cash', expense_date: new Date().toISOString().slice(0, 10) }); setShowExpenseModal(true) }}
              className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Plus size={16} /> Add Expense
            </button>
          </div>

          {loading ? <div className="text-center py-12 text-brand-muted">Loading...</div> : (
            <div className="overflow-x-auto rounded-lg border border-brand-border">
              <table className="w-full text-sm">
                <thead className="bg-brand-card text-brand-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Description</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, idx) => (
                    <tr key={e.expense_id} className={`border-t border-brand-border ${idx % 2 === 0 ? '' : 'bg-brand-card/30'}`}>
                      <td className="px-4 py-3 text-brand-muted">{formatDate(e.expense_date)}</td>
                      <td className="px-4 py-3">{e.category}</td>
                      <td className="px-4 py-3 text-brand-muted hidden sm:table-cell">{e.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-400">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        {e.is_paid ? <span className="text-green-400 text-xs">✓</span> : <span className="text-yellow-400 text-xs">Pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Investments Tab */}
      {tab === 'investments' && (
        <>
          {/* Capital Recovery Card */}
          <div className="bg-brand-card border border-brand-orange/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-brand-orange" />
              <h2 className="font-semibold">Capital & Recovery</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-brand-muted text-xs">Total Invested (own)</p>
                <p className="font-bold">{formatCurrency(recovery.totalCapital - recovery.totalLoans)}</p>
              </div>
              <div>
                <p className="text-brand-muted text-xs">Total Borrowed (loans)</p>
                <p className="font-bold">{formatCurrency(recovery.totalLoans)}</p>
              </div>
              <div>
                <p className="text-brand-muted text-xs">Total Capital</p>
                <p className="font-bold text-white">{formatCurrency(recovery.totalCapital)}</p>
              </div>
              <div>
                <p className="text-brand-muted text-xs">Net Profit (all time)</p>
                <p className="font-bold text-green-400">{formatCurrency(netProfit)}</p>
              </div>
            </div>
            {/* Recovery bar */}
            <div>
              <div className="flex justify-between text-xs text-brand-muted mb-1">
                <span>Capital Recovered</span>
                <span className="text-brand-orange font-semibold">{Math.min(100, recovery.recoveryPercent).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-brand-border rounded-full h-2.5">
                <div className="bg-brand-orange h-2.5 rounded-full transition-all" style={{ width: `${Math.min(100, recovery.recoveryPercent)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm border-t border-brand-border pt-3">
              <div>
                <p className="text-brand-muted text-xs">Still to Recover</p>
                <p className="font-bold text-yellow-400">{formatCurrency(recovery.stillToRecover)}</p>
              </div>
              <div>
                <p className="text-brand-muted text-xs">Loans Outstanding</p>
                <p className="font-bold text-red-400">{formatCurrency(recovery.loansOutstanding)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Investment History</h2>
            <button onClick={() => { resetInv({ type: 'Own Money', investment_date: new Date().toISOString().slice(0, 10), is_repaid: false, repaid_amount: 0 }); setShowInvestmentModal(true) }}
              className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-lg text-sm font-medium">
              <Plus size={16} /> Add Investment
            </button>
          </div>

          <div className="space-y-3">
            {investments.map(inv => (
              <div key={inv.investment_id} className="bg-brand-card border border-brand-border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{inv.source}</p>
                    <p className="text-xs text-brand-muted">{inv.type} · {formatDate(inv.investment_date)}</p>
                    <p className="text-sm text-brand-muted mt-1">{inv.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatCurrency(inv.amount)}</p>
                    {inv.repaid_amount > 0 && <p className="text-xs text-green-400">Repaid: {formatCurrency(inv.repaid_amount)}</p>}
                  </div>
                </div>
                {inv.is_repaid && <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded mt-2 inline-block">Repaid</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-brand-card border border-brand-border rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h2 className="font-semibold">Add Expense</h2>
              <button onClick={() => setShowExpenseModal(false)}><X size={20} className="text-brand-muted" /></button>
            </div>
            <form onSubmit={subExp(addExpense)} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Date</label>
                  <input type="date" {...regExp('expense_date', { required: true })} className="eform-input" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Category</label>
                  <select {...regExp('category', { required: true })} className="eform-input">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Description</label>
                <input {...regExp('description')} className="eform-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Amount (₹) *</label>
                  <input type="number" step="0.01" {...regExp('amount', { required: true, min: 0 })} className={`eform-input ${errExp.amount ? 'border-red-500' : ''}`} />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Payment Type</label>
                  <select {...regExp('payment_type')} className="eform-input">
                    <option>Cash</option><option>UPI</option><option>Card</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Vendor</label>
                <input {...regExp('vendor')} className="eform-input" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-brand-muted">Is Paid</label>
                <input type="checkbox" {...regExp('is_paid')} defaultChecked className="w-4 h-4 accent-brand-orange" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 py-2.5 border border-brand-border rounded-lg text-sm text-brand-muted">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-brand-orange text-white rounded-lg text-sm font-medium">Add Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Investment Modal */}
      {showInvestmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-brand-card border border-brand-border rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h2 className="font-semibold">Add Investment / Loan</h2>
              <button onClick={() => setShowInvestmentModal(false)}><X size={20} className="text-brand-muted" /></button>
            </div>
            <form onSubmit={subInv(addInvestment)} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Date</label>
                  <input type="date" {...regInv('investment_date', { required: true })} className="eform-input" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Type *</label>
                  <select {...regInv('type', { required: true })} className="eform-input">
                    {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Source * (e.g. "SBI Bank", "Uncle Raju")</label>
                <input {...regInv('source', { required: true })} className="eform-input" />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Description * (e.g. "Initial stock purchase")</label>
                <input {...regInv('description', { required: true })} className="eform-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Amount (₹) *</label>
                  <input type="number" step="0.01" {...regInv('amount', { required: true, min: 1 })} className="eform-input" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Repaid Amount (₹)</label>
                  <input type="number" step="0.01" {...regInv('repaid_amount')} className="eform-input" defaultValue={0} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-brand-muted">Is Fully Repaid</label>
                <input type="checkbox" {...regInv('is_repaid')} className="w-4 h-4 accent-brand-orange" />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Notes</label>
                <input {...regInv('notes')} className="eform-input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvestmentModal(false)} className="flex-1 py-2.5 border border-brand-border rounded-lg text-sm text-brand-muted">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-brand-orange text-white rounded-lg text-sm font-medium">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .eform-input {
          width: 100%;
          background: #0D0D0D;
          border: 1px solid #2A2A2A;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          color: white;
          outline: none;
        }
        .eform-input:focus { border-color: #E85000; }
        .eform-input option { background: #1A1A1A; }
      `}</style>
    </div>
  )
}

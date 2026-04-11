import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, X, Edit2, Wrench, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase, Mechanic, MechanicLedger } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/constants'

type MechanicForm = Omit<Mechanic, 'mechanic_id' | 'created_at' | 'updated_at'>

export default function Mechanics() {
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [ledger, setLedger] = useState<Record<string, MechanicLedger[]>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Mechanic | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [payModal, setPayModal] = useState<{ ledger: MechanicLedger } | null>(null)
  const [payAmount, setPayAmount] = useState('')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MechanicForm>()

  const fetchData = async () => {
    const { data } = await supabase.from('mechanics').select('*').order('name')
    if (data) setMechanics(data)
    setLoading(false)
  }

  const fetchLedger = async (mechanicId: string) => {
    const { data } = await supabase
      .from('mechanic_ledger')
      .select('*')
      .eq('mechanic_id', mechanicId)
      .order('created_at', { ascending: false })
    if (data) setLedger(prev => ({ ...prev, [mechanicId]: data }))
  }

  useEffect(() => { fetchData() }, [])

  const openAdd = () => {
    reset({ name: '', phone: '', commission_percent: 5, shop_name: '', area: '', active: true })
    setEditItem(null)
    setShowModal(true)
  }

  const openEdit = (m: Mechanic) => {
    reset(m)
    setEditItem(m)
    setShowModal(true)
  }

  const onSubmit = async (data: MechanicForm) => {
    const pct = Number(data.commission_percent)
    if (!pct || pct < 1) { toast.error('Commission must be at least 1%'); return }
    if (pct > 10) { toast.error('Commission cannot exceed 10%'); return }

    const payload = { ...data, commission_percent: pct }
    if (editItem) {
      const { error } = await supabase.from('mechanics').update({ ...payload, updated_at: new Date().toISOString() }).eq('mechanic_id', editItem.mechanic_id)
      if (error) { toast.error(error.message); return }
      toast.success('Mechanic updated')
    } else {
      const { error } = await supabase.from('mechanics').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Mechanic added')
    }
    setShowModal(false)
    fetchData()
  }

  const toggleExpand = async (mechanicId: string) => {
    if (expanded === mechanicId) { setExpanded(null); return }
    setExpanded(mechanicId)
    if (!ledger[mechanicId]) await fetchLedger(mechanicId)
  }

  const markPaid = async () => {
    if (!payModal) return
    const amt = Number(payAmount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }

    const { error } = await supabase.from('mechanic_ledger').update({
      payment_status: 'Paid',
      paid_amount: amt,
      paid_date: new Date().toISOString().slice(0, 10),
    }).eq('ledger_id', payModal.ledger.ledger_id)

    if (error) { toast.error(error.message); return }
    toast.success('Marked as paid')
    setPayModal(null)
    setPayAmount('')
    if (expanded) await fetchLedger(expanded)
  }

  const getLedgerSummary = (mId: string) => {
    const entries = ledger[mId] || []
    const totalEarned = entries.reduce((s, e) => s + e.commission_amount, 0)
    const totalPaid = entries.reduce((s, e) => s + e.paid_amount, 0)
    return { totalEarned, totalPaid, balance: totalEarned - totalPaid }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Mechanics</h1>
          <p className="text-brand-muted text-sm">{mechanics.length} mechanics</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
          <Plus size={16} /> Add Mechanic
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-brand-muted">Loading...</div>
      ) : mechanics.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <Wrench size={40} className="mx-auto mb-2 opacity-30" />
          <p>No mechanics added yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mechanics.map(m => {
            const isOpen = expanded === m.mechanic_id
            const entries = ledger[m.mechanic_id] || []
            const { totalEarned, totalPaid, balance } = getLedgerSummary(m.mechanic_id)

            return (
              <div key={m.mechanic_id} className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
                {/* Mechanic Row */}
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-brand-orange/20 flex items-center justify-center">
                    <Wrench size={18} className="text-brand-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{m.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${m.active ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                        {m.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-brand-muted text-sm">{m.phone} · {m.commission_percent}% commission</p>
                    {m.shop_name && <p className="text-xs text-brand-muted">{m.shop_name}, {m.area}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(m)} className="text-brand-muted hover:text-brand-orange"><Edit2 size={15} /></button>
                    <button onClick={() => toggleExpand(m.mechanic_id)} className="text-brand-muted hover:text-brand-orange">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Ledger */}
                {isOpen && (
                  <div className="border-t border-brand-border">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-0 border-b border-brand-border">
                      {[
                        { label: 'Total Earned', value: totalEarned, color: 'text-white' },
                        { label: 'Total Paid', value: totalPaid, color: 'text-green-400' },
                        { label: 'Balance Due', value: balance, color: 'text-yellow-400' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="p-3 text-center border-r border-brand-border last:border-0">
                          <p className={`font-bold ${color}`}>{formatCurrency(value)}</p>
                          <p className="text-xs text-brand-muted mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Ledger Table */}
                    {entries.length === 0 ? (
                      <p className="text-center text-brand-muted text-sm py-6">No commission records yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-brand-muted">
                            <tr>
                              <th className="px-4 py-2 text-left">Bill ID</th>
                              <th className="px-4 py-2 text-left">Date</th>
                              <th className="px-4 py-2 text-right">Total</th>
                              <th className="px-4 py-2 text-right">Commission</th>
                              <th className="px-4 py-2 text-center">Status</th>
                              <th className="px-4 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map(e => (
                              <tr key={e.ledger_id} className="border-t border-brand-border">
                                <td className="px-4 py-2 font-mono text-xs">{e.bill_id}</td>
                                <td className="px-4 py-2 text-brand-muted">{formatDate(e.created_at)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(e.grand_total)}</td>
                                <td className="px-4 py-2 text-right font-medium text-brand-orange">{formatCurrency(e.commission_amount)}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-xs ${e.payment_status === 'Paid' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                                    {e.payment_status}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  {e.payment_status === 'Unpaid' && (
                                    <button onClick={() => { setPayModal({ ledger: e }); setPayAmount(String(e.commission_amount)) }}
                                      className="text-xs text-brand-orange hover:underline">
                                      Pay
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-brand-card border border-brand-border rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h2 className="font-semibold">{editItem ? 'Edit Mechanic' : 'Add Mechanic'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-brand-muted" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Name *</label>
                <input {...register('name', { required: true })} className={`mform-input ${errors.name ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Phone *</label>
                <input {...register('phone', { required: true })} className={`mform-input ${errors.phone ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Commission % * (1–10)</label>
                <input type="number" step="0.5" min="1" max="10"
                  {...register('commission_percent', { required: true, min: 1, max: 10 })}
                  className={`mform-input ${errors.commission_percent ? 'border-red-500' : ''}`} />
                {errors.commission_percent && <p className="text-red-400 text-xs mt-1">Must be between 1% and 10%</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Shop Name</label>
                  <input {...register('shop_name')} className="mform-input" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Area</label>
                  <input {...register('area')} className="mform-input" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-brand-muted">Active</label>
                <input type="checkbox" {...register('active')} defaultChecked className="w-4 h-4 accent-brand-orange" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-brand-border rounded-lg text-brand-muted text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-brand-orange text-white rounded-lg text-sm font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-brand-card border border-brand-border rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h2 className="font-semibold">Mark as Paid</h2>
              <button onClick={() => setPayModal(null)}><X size={20} className="text-brand-muted" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-brand-muted">Bill: {payModal.ledger.bill_id}</p>
              <p className="text-sm">Commission due: <span className="font-bold text-brand-orange">{formatCurrency(payModal.ledger.commission_amount)}</span></p>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Amount Paid (₹)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="mform-input w-full"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPayModal(null)} className="flex-1 py-2.5 border border-brand-border rounded-lg text-sm text-brand-muted">Cancel</button>
                <button onClick={markPaid} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">Mark Paid</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mform-input {
          width: 100%;
          background: #0D0D0D;
          border: 1px solid #2A2A2A;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          color: white;
          outline: none;
        }
        .mform-input:focus { border-color: #E85000; }
      `}</style>
    </div>
  )
}

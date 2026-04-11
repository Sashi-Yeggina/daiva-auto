import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, X, Edit2, Users, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase, Customer, Sale } from '../lib/supabase'
import { BIKE_MODELS, formatCurrency, formatDate } from '../lib/constants'

type CustomerForm = Omit<Customer, 'customer_id' | 'created_at' | 'updated_at'>

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Record<string, Sale[]>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Customer | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerForm>()

  const fetchData = async () => {
    const { data } = await supabase.from('customers').select('*').order('name')
    if (data) setCustomers(data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const fetchSales = async (customerId: string) => {
    const { data } = await supabase.from('sales').select('*').eq('customer_id', customerId).order('sale_date', { ascending: false }).limit(20)
    if (data) setSales(prev => ({ ...prev, [customerId]: data }))
  }

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!sales[id]) await fetchSales(id)
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.vehicle_number || '').toLowerCase().includes(q)
  })

  const openAdd = () => {
    reset({ name: '', phone: '', vehicle_number: '', bike_model: '', year: undefined, address: '' })
    setEditItem(null)
    setShowModal(true)
  }

  const openEdit = (c: Customer) => {
    reset(c)
    setEditItem(c)
    setShowModal(true)
  }

  const onSubmit = async (data: CustomerForm) => {
    if (editItem) {
      const { error } = await supabase.from('customers').update({ ...data, updated_at: new Date().toISOString() }).eq('customer_id', editItem.customer_id)
      if (error) { toast.error(error.message); return }
      toast.success('Customer updated')
    } else {
      const { error } = await supabase.from('customers').insert(data)
      if (error) { toast.error(error.message); return }
      toast.success('Customer added')
    }
    setShowModal(false)
    fetchData()
  }

  const markDuePaid = async (saleId: string) => {
    const { error } = await supabase.from('sales').update({ balance_due: 0, paid_amount: supabase.rpc as unknown as number }).eq('sale_id', saleId)
    // Simplified: just set balance to 0
    const { data: saleData } = await supabase.from('sales').select('grand_total').eq('sale_id', saleId).single()
    if (saleData) {
      await supabase.from('sales').update({ balance_due: 0, paid_amount: saleData.grand_total }).eq('sale_id', saleId)
    }
    if (error && !saleData) { toast.error('Failed'); return }
    toast.success('Marked as paid')
    if (expanded) await fetchSales(expanded)
  }

  const getTotalDue = (cId: string) => {
    return (sales[cId] || []).reduce((s, sale) => s + sale.balance_due, 0)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Customers</h1>
          <p className="text-brand-muted text-sm">{customers.length} customers</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, or vehicle..."
          className="w-full bg-brand-card border border-brand-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-orange" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-brand-muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <Users size={40} className="mx-auto mb-2 opacity-30" />
          <p>No customers found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const isOpen = expanded === c.customer_id
            const customerSales = sales[c.customer_id] || []
            const dueSales = customerSales.filter(s => s.balance_due > 0)
            const totalDue = isOpen ? getTotalDue(c.customer_id) : 0

            return (
              <div key={c.customer_id} className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-full bg-brand-orange/20 flex items-center justify-center text-brand-orange font-bold">
                    {c.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-brand-muted text-sm">{c.phone || '—'} · {c.bike_model || 'No bike'}</p>
                    {c.vehicle_number && <p className="text-xs text-brand-muted">{c.vehicle_number}</p>}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => openEdit(c)} className="text-brand-muted hover:text-brand-orange"><Edit2 size={15} /></button>
                    <button onClick={() => toggleExpand(c.customer_id)} className="text-brand-muted hover:text-brand-orange">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-brand-border">
                    {totalDue > 0 && (
                      <div className="bg-red-900/20 border-b border-brand-border px-4 py-2 flex justify-between items-center">
                        <span className="text-red-400 text-sm font-medium">Balance Due</span>
                        <span className="text-red-400 font-bold">{formatCurrency(totalDue)}</span>
                      </div>
                    )}
                    {customerSales.length === 0 ? (
                      <p className="text-center text-brand-muted text-sm py-6">No purchase history</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-brand-muted">
                            <tr>
                              <th className="px-4 py-2 text-left">Bill</th>
                              <th className="px-4 py-2 text-left">Date</th>
                              <th className="px-4 py-2 text-right">Total</th>
                              <th className="px-4 py-2 text-right">Due</th>
                              <th className="px-4 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerSales.map(s => (
                              <tr key={s.sale_id} className="border-t border-brand-border">
                                <td className="px-4 py-2 font-mono">{s.bill_id}</td>
                                <td className="px-4 py-2 text-brand-muted">{formatDate(s.sale_date)}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(s.grand_total)}</td>
                                <td className="px-4 py-2 text-right">
                                  {s.balance_due > 0 ? <span className="text-red-400 font-medium">{formatCurrency(s.balance_due)}</span> : <span className="text-green-400">Paid</span>}
                                </td>
                                <td className="px-4 py-2">
                                  {s.balance_due > 0 && (
                                    <button onClick={() => markDuePaid(s.sale_id)} className="text-xs text-green-400 hover:underline">Mark Paid</button>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-brand-card border border-brand-border rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h2 className="font-semibold">{editItem ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-brand-muted" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Name *</label>
                <input {...register('name', { required: true })} className={`cform-input ${errors.name ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Phone</label>
                <input {...register('phone')} className="cform-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Vehicle Number</label>
                  <input {...register('vehicle_number')} className="cform-input" placeholder="AP39AB1234" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Year</label>
                  <input type="number" {...register('year')} className="cform-input" placeholder="2020" />
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Bike Model</label>
                <select {...register('bike_model')} className="cform-input">
                  <option value="">Select...</option>
                  {BIKE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1 block">Address</label>
                <input {...register('address')} className="cform-input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-brand-border rounded-lg text-sm text-brand-muted">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-brand-orange text-white rounded-lg text-sm font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .cform-input {
          width: 100%;
          background: #0D0D0D;
          border: 1px solid #2A2A2A;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          color: white;
          outline: none;
        }
        .cform-input:focus { border-color: #E85000; }
        .cform-input option { background: #1A1A1A; }
      `}</style>
    </div>
  )
}

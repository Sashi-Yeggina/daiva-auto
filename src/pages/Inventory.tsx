import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, X, Package } from 'lucide-react'
import { supabase, InventoryItem } from '../lib/supabase'
import { BIKE_MODELS, formatCurrency, SEED_PARTS } from '../lib/constants'

type FormData = Omit<InventoryItem, 'item_id' | 'created_at' | 'updated_at'>

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [bikeFilter, setBikeFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>()

  const fetchItems = async () => {
    const { data, error } = await supabase.from('inventory').select('*').order('part_name')
    if (error) { toast.error('Failed to load inventory'); return }
    if (data) {
      setItems(data)
      // Seed if empty
      if (data.length === 0) {
        await supabase.from('inventory').insert(SEED_PARTS)
        const { data: seeded } = await supabase.from('inventory').select('*').order('part_name')
        if (seeded) setItems(seeded)
      }
    }
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const filtered = items.filter(item => {
    const q = search.toLowerCase()
    const matchSearch = !q || item.part_name.toLowerCase().includes(q) ||
      (item.barcode || '').includes(q) || (item.bike_model || '').toLowerCase().includes(q)
    const matchBike = bikeFilter === 'All' || item.bike_model === bikeFilter
    return matchSearch && matchBike
  })

  const openAdd = () => {
    reset({ barcode: '', part_name: '', category: '', bike_model: '', cost_a: 0, cost_b: 0, gst_percent: 18, stock: 0, reorder_level: 5 })
    setEditItem(null)
    setShowModal(true)
  }

  const openEdit = (item: InventoryItem) => {
    reset(item)
    setEditItem(item)
    setShowModal(true)
  }

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      cost_a: Number(data.cost_a),
      cost_b: Number(data.cost_b),
      gst_percent: Number(data.gst_percent),
      stock: Number(data.stock),
      reorder_level: Number(data.reorder_level),
    }

    if (editItem) {
      const { error } = await supabase.from('inventory').update({ ...payload, updated_at: new Date().toISOString() }).eq('item_id', editItem.item_id)
      if (error) { toast.error(error.message); return }
      toast.success('Part updated')
    } else {
      const { error } = await supabase.from('inventory').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Part added')
    }
    setShowModal(false)
    fetchItems()
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from('inventory').delete().eq('item_id', deleteId)
    if (error) { toast.error(error.message); return }
    toast.success('Part deleted')
    setDeleteId(null)
    fetchItems()
  }

  const stockBadge = (item: InventoryItem) => {
    if (item.stock <= 0) return <span className="px-2 py-0.5 rounded text-xs bg-red-900/40 text-red-400">Out</span>
    if (item.stock <= item.reorder_level) return <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/40 text-yellow-400">Low</span>
    return <span className="px-2 py-0.5 rounded text-xs bg-green-900/40 text-green-400">OK</span>
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Inventory</h1>
          <p className="text-brand-muted text-sm">{items.length} parts</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
          <Plus size={16} /> Add Part
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, barcode, or bike..."
            className="w-full bg-brand-card border border-brand-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-orange"
          />
        </div>
        <select
          value={bikeFilter}
          onChange={e => setBikeFilter(e.target.value)}
          className="bg-brand-card border border-brand-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brand-orange"
        >
          <option value="All">All Bikes</option>
          {BIKE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-brand-muted">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-brand-muted">
          <Package size={40} className="mx-auto mb-2 opacity-30" />
          <p>No parts found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-border">
          <table className="w-full text-sm">
            <thead className="bg-brand-card text-brand-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Part Name</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Bike</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Cost</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={item.item_id} className={`border-t border-brand-border ${idx % 2 === 0 ? 'bg-brand-bg' : 'bg-brand-card/40'} hover:bg-brand-card transition-colors`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.part_name}</p>
                    {item.barcode && <p className="text-xs text-brand-muted">{item.barcode}</p>}
                  </td>
                  <td className="px-4 py-3 text-brand-muted hidden sm:table-cell">{item.bike_model || '—'}</td>
                  <td className="px-4 py-3 text-brand-muted hidden md:table-cell">{formatCurrency(item.cost_a)}</td>
                  <td className="px-4 py-3 font-semibold text-white">{formatCurrency(item.cost_b)}</td>
                  <td className="px-4 py-3">{item.stock}</td>
                  <td className="px-4 py-3">{stockBadge(item)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(item)} className="text-brand-muted hover:text-brand-orange transition-colors"><Edit2 size={15} /></button>
                      <button onClick={() => setDeleteId(item.item_id)} className="text-brand-muted hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-brand-card border border-brand-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h2 className="font-semibold">{editItem ? 'Edit Part' : 'Add Part'}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-brand-muted" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Barcode</label>
                  <input {...register('barcode')} className="form-input" placeholder="Scan or type" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Part Name *</label>
                  <input {...register('part_name', { required: true })} className={`form-input ${errors.part_name ? 'border-red-500' : ''}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Category</label>
                  <input {...register('category')} className="form-input" placeholder="e.g. Brakes, Engine" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Bike Model *</label>
                  <select {...register('bike_model')} className="form-input">
                    <option value="">Select...</option>
                    {BIKE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Cost (₹) *</label>
                  <input type="number" step="0.01" {...register('cost_a', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Price (₹) *</label>
                  <input type="number" step="0.01" {...register('cost_b', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">GST%</label>
                  <input type="number" {...register('gst_percent')} className="form-input" defaultValue={18} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Stock *</label>
                  <input type="number" {...register('stock', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="text-xs text-brand-muted mb-1 block">Reorder Level</label>
                  <input type="number" {...register('reorder_level')} className="form-input" defaultValue={5} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-brand-border rounded-lg text-brand-muted text-sm hover:border-brand-orange transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all">
                  {editItem ? 'Update' : 'Add Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-brand-card border border-brand-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold mb-2">Delete Part?</h3>
            <p className="text-brand-muted text-sm mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-brand-border rounded-lg text-sm">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .form-input {
          width: 100%;
          background: #0D0D0D;
          border: 1px solid #2A2A2A;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          color: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus { border-color: #E85000; }
        .form-input option { background: #1A1A1A; }
      `}</style>
    </div>
  )
}

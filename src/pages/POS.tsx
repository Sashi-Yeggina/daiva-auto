import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle,
  QrCode, Percent, DollarSign, X, Printer, Share2
} from 'lucide-react'
import { supabase, InventoryItem, Mechanic } from '../lib/supabase'
import {
  BIKE_MODELS, SALE_SOURCES, calculateMaxDiscount,
  generateBillId, formatCurrency, SHOP_INFO
} from '../lib/constants'
import { generateUPILink, generateWhatsAppMessage } from '../lib/upi'
import BillPrint from '../components/BillPrint'

interface CartItem {
  item_id: string
  barcode: string | null
  part_name: string
  bike_model: string | null
  qty: number
  sellingPrice: number
  costPrice: number
  gst_percent: number
}

const PAYMENT_METHODS = ['Cash', 'UPI', 'Partial'] as const
type PaymentMethod = typeof PAYMENT_METHODS[number]

export default function POS() {
  const [search, setSearch] = useState('')
  const [bikeFilter, setBikeFilter] = useState('All')
  const [results, setResults] = useState<InventoryItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [saleSource, setSaleSource] = useState<string>('Walk-in')
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [mechanicId, setMechanicId] = useState<string>('')
  const [discount, setDiscount] = useState<number>(0)
  const [discountType, setDiscountType] = useState<'₹' | '%'>('₹')
  const [taxReceipt, setTaxReceipt] = useState(false)
  const [payment, setPayment] = useState<PaymentMethod>('Cash')
  const [cashReceived, setCashReceived] = useState<number>(0)
  const [partialPaid, setPartialPaid] = useState<number>(0)
  const [merchantUPI, setMerchantUPI] = useState('')
  const [shopName, setShopName] = useState(SHOP_INFO.name)
  const [completing, setCompleting] = useState(false)
  const [lastBill, setLastBill] = useState<{ billId: string; saleId: string } | null>(null)
  const [showBill, setShowBill] = useState(false)
  const [manualCommission, setManualCommission] = useState<number>(0)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [showCustomerForm, setShowCustomerForm] = useState(false)

  // Load mechanics + settings
  useEffect(() => {
    supabase.from('mechanics').select('*').eq('active', true).then(({ data }) => {
      if (data) setMechanics(data)
    })
    supabase.from('settings').select('*').then(({ data }) => {
      if (data) {
        const upi = data.find(s => s.key === 'merchant_upi_id')
        if (upi) setMerchantUPI(upi.value)
        const name = data.find(s => s.key === 'shop_name')
        if (name) setShopName(name.value)
      }
    })
  }, [])

  // Search inventory
  const doSearch = useCallback(async (q: string, bike: string) => {
    if (!q.trim()) { setResults([]); return }
    let query = supabase.from('inventory').select('*').gt('stock', 0)
    if (q) query = query.or(`part_name.ilike.%${q}%,barcode.ilike.%${q}%`)
    if (bike !== 'All') query = query.eq('bike_model', bike)
    const { data } = await query.limit(10)
    setResults(data || [])
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(search, bikeFilter), 250)
    return () => clearTimeout(t)
  }, [search, bikeFilter, doSearch])

  const addToCart = (item: InventoryItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item_id === item.item_id)
      if (existing) {
        return prev.map(c => c.item_id === item.item_id ? { ...c, qty: c.qty + 1 } : c)
      }
      return [...prev, {
        item_id: item.item_id,
        barcode: item.barcode,
        part_name: item.part_name,
        bike_model: item.bike_model,
        qty: 1,
        sellingPrice: item.cost_b,
        costPrice: item.cost_a,
        gst_percent: item.gst_percent,
      }]
    })
    toast.success(`${item.part_name} added`, { duration: 1000 })
  }

  const updateQty = (item_id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.item_id !== item_id) return c
      const newQty = c.qty + delta
      return newQty <= 0 ? null as unknown as CartItem : { ...c, qty: newQty }
    }).filter(Boolean))
  }

  const removeFromCart = (item_id: string) => setCart(prev => prev.filter(c => c.item_id !== item_id))

  // Calculations
  const subtotal = cart.reduce((s, c) => s + c.qty * c.sellingPrice, 0)
  const maxDiscount = calculateMaxDiscount(cart, mechanicId || null)
  const effectiveDiscount = mechanicId ? 0 : (discountType === '%' ? Math.min(subtotal * discount / 100, maxDiscount) : Math.min(discount, maxDiscount))
  const afterDiscount = subtotal - effectiveDiscount
  const gstAmount = taxReceipt ? afterDiscount * 0.18 : 0
  const grandTotal = afterDiscount + gstAmount

  const selectedMechanic = mechanics.find(m => m.mechanic_id === mechanicId)

  const completeSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    setCompleting(true)
    try {
      const billId = generateBillId()
      const paidAmount = payment === 'Cash' ? cashReceived : payment === 'Partial' ? partialPaid : grandTotal
      const balanceDue = Math.max(0, grandTotal - paidAmount)

      // Handle customer (create if provided, otherwise null)
      let customerId: string | null = null
      if (customerName || customerPhone || customerEmail) {
        const { data: customerData, error: customerError } = await supabase.from('customers').insert({
          name: customerName || 'Unknown',
          phone: customerPhone || null,
          vehicle_number: null,
          bike_model: null,
          year: null,
          address: null,
        }).select().single()
        if (customerError) toast.error('Could not save customer')
        else customerId = customerData.customer_id
      }

      // Insert sale
      const { data: saleData, error: saleError } = await supabase.from('sales').insert({
        bill_id: billId,
        sale_date: new Date().toISOString(),
        sale_source: saleSource,
        mechanic_id: mechanicId || null,
        customer_id: customerId,
        subtotal,
        discount: effectiveDiscount,
        gst_amount: gstAmount,
        grand_total: grandTotal,
        payment_type: payment,
        paid_amount: paidAmount,
        balance_due: balanceDue,
        tax_receipt: taxReceipt,
        sale_status: 'Completed',
      }).select().single()

      if (saleError) throw saleError

      const saleId = saleData.sale_id

      // Insert cart items
      const cartRows = cart.map(c => ({
        sale_id: saleId,
        item_id: c.item_id,
        barcode: c.barcode,
        part_name: c.part_name,
        qty: c.qty,
        selling_price: c.sellingPrice,
        cost_price: c.costPrice,
        gst_percent: taxReceipt ? c.gst_percent : 0,
        line_total: c.qty * c.sellingPrice,
        profit: (c.sellingPrice - c.costPrice) * c.qty,
      }))
      await supabase.from('cart_items').insert(cartRows)

      // Update stock + stock ledger
      for (const c of cart) {
        await supabase.from('inventory')
          .update({ stock: supabase.rpc as unknown as number })
          .eq('item_id', c.item_id)

        // Direct stock decrement
        try {
          await supabase.rpc('decrement_stock', { p_item_id: c.item_id, p_qty: c.qty })
        } catch {
          // Fallback: manual update
          const { data: inv } = await supabase.from('inventory').select('stock').eq('item_id', c.item_id).single()
          if (inv) await supabase.from('inventory').update({ stock: Math.max(0, inv.stock - c.qty) }).eq('item_id', c.item_id)
        }

        await supabase.from('stock_ledger').insert({
          item_id: c.item_id,
          barcode: c.barcode,
          qty_change: -c.qty,
          movement_type: 'Sale',
          ref_bill_id: billId,
        })
      }

      // Mechanic commission
      if (mechanicId && selectedMechanic) {
        // Use manual commission if entered, otherwise use default percentage
        const commissionAmount = manualCommission > 0 ? manualCommission : subtotal * (selectedMechanic.commission_percent / 100)
        const commissionPercent = (commissionAmount / grandTotal) * 100
        await supabase.from('mechanic_ledger').insert({
          mechanic_id: mechanicId,
          sale_id: saleId,
          bill_id: billId,
          grand_total: grandTotal,
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
          payment_status: 'Unpaid',
          payment_month: new Date().toISOString().slice(0, 7),
        })
      }

      setLastBill({ billId, saleId })
      toast.success(`Sale complete! Bill: ${billId}`, { duration: 4000 })
      setShowBill(true)
      resetCart()
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Sale failed')
    } finally {
      setCompleting(false)
    }
  }

  const resetCart = () => {
    setCart([])
    setDiscount(0)
    setSearch('')
    setResults([])
    setCashReceived(0)
    setPartialPaid(0)
    setMechanicId('')
    setSaleSource('Walk-in')
    setTaxReceipt(false)
    setPayment('Cash')
    setManualCommission(0)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setShowCustomerForm(false)
  }

  const upiLink = lastBill ? generateUPILink({ merchantUPI, amount: grandTotal, billId: lastBill.billId, shopName }) : ''

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* LEFT — Search */}
      <div className="md:w-1/2 border-r border-brand-border flex flex-col">
        <div className="p-4 border-b border-brand-border space-y-3">
          {/* Sale Source + Mechanic */}
          <div className="flex gap-2">
            <select value={saleSource} onChange={e => setSaleSource(e.target.value)} className="pos-input flex-1">
              {['Walk-in', 'Mechanic', 'Online', 'Other'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {saleSource === 'Mechanic' && (
              <select value={mechanicId} onChange={e => setMechanicId(e.target.value)} className="pos-input flex-1">
                <option value="">No mechanic</option>
                {mechanics.map(m => <option key={m.mechanic_id} value={m.mechanic_id}>{m.name} ({m.commission_percent}%)</option>)}
              </select>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search parts by name or barcode..."
              className="pos-input pl-4 pr-12 w-full"
            />
            <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
          </div>
          <select value={bikeFilter} onChange={e => setBikeFilter(e.target.value)} className="pos-input w-full">
            <option value="All">All Bikes</option>
            {BIKE_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {results.map(item => (
            <button key={item.item_id} onClick={() => addToCart(item)}
              className="w-full text-left bg-brand-card hover:bg-brand-border border border-brand-border rounded-lg p-3 transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{item.part_name}</p>
                  <p className="text-xs text-brand-muted">{item.bike_model} · Stock: {item.stock}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-brand-orange">{formatCurrency(item.cost_b)}</p>
                  <p className="text-xs text-brand-muted">cost: {formatCurrency(item.cost_a)}</p>
                </div>
              </div>
            </button>
          ))}
          {search && results.length === 0 && (
            <p className="text-center text-brand-muted text-sm py-8">No parts found</p>
          )}
          {!search && (
            <div className="text-center text-brand-muted text-sm py-8">
              <Search size={32} className="mx-auto mb-2 opacity-30" />
              <p>Search for parts to add to cart</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Cart */}
      <div className="md:w-1/2 flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b border-brand-border flex items-center gap-2">
          <ShoppingCart size={18} className="text-brand-orange" />
          <span className="font-semibold">Cart</span>
          {cart.length > 0 && (
            <span className="bg-brand-orange text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">{cart.length}</span>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center text-brand-muted py-8">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
              <p>Cart is empty</p>
            </div>
          ) : cart.map(item => (
            <div key={item.item_id} className="bg-brand-card border border-brand-border rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.part_name}</p>
                  <p className="text-xs text-brand-muted">{formatCurrency(item.sellingPrice)} each</p>
                </div>
                <button onClick={() => removeFromCart(item.item_id)} className="text-brand-muted hover:text-red-400 ml-2">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(item.item_id, -1)} className="w-7 h-7 rounded-full border border-brand-border flex items-center justify-center hover:border-brand-orange">
                    <Minus size={12} />
                  </button>
                  <span className="w-8 text-center font-semibold">{item.qty}</span>
                  <button onClick={() => updateQty(item.item_id, 1)} className="w-7 h-7 rounded-full border border-brand-border flex items-center justify-center hover:border-brand-orange">
                    <Plus size={12} />
                  </button>
                </div>
                <span className="font-bold text-brand-orange">{formatCurrency(item.qty * item.sellingPrice)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals + Payment */}
        {cart.length > 0 && (
          <div className="border-t border-brand-border p-4 space-y-3">
            {/* Discount */}
            {mechanicId ? (
              <div className="bg-brand-orange/10 border border-brand-orange/30 rounded-lg p-3 text-xs text-brand-orange">
                Discount unavailable — mechanic commission applies
              </div>
            ) : (
              <div>
                <label className="text-xs text-brand-muted block mb-1">Discount</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscountType(discountType === '₹' ? '%' : '₹')}
                    className="px-3 py-2 border border-brand-border rounded-lg text-sm font-medium hover:border-brand-orange"
                  >
                    {discountType}
                  </button>
                  <input
                    type="number"
                    value={discount}
                    onChange={e => setDiscount(Number(e.target.value))}
                    className="flex-1 pos-input"
                    min="0"
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-brand-muted mt-1">Max: {formatCurrency(maxDiscount)}</p>
              </div>
            )}

            {/* Mechanic Commission (if mechanic selected) */}
            {mechanicId && selectedMechanic && (
              <div className="bg-brand-card border border-brand-border/50 rounded-lg p-3 space-y-2">
                <label className="text-xs text-brand-muted block">Mechanic Commission</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={manualCommission || ''}
                    onChange={e => setManualCommission(e.target.value ? Number(e.target.value) : 0)}
                    placeholder="0"
                    className="flex-1 pos-input"
                  />
                  <span className="text-xs text-brand-muted py-2 px-2">₹</span>
                </div>
                <div className="text-xs text-brand-muted space-y-1">
                  <p>Default: {selectedMechanic.commission_percent}% = {formatCurrency(grandTotal * (selectedMechanic.commission_percent / 100))}</p>
                  {manualCommission > 0 && (
                    <p className="text-brand-orange">Custom: {formatCurrency(manualCommission)} ({((manualCommission / grandTotal) * 100).toFixed(1)}% of bill)</p>
                  )}
                </div>
              </div>
            )}

            {/* Tax Receipt Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-muted">Tax Receipt (GST 18%)</span>
              <button
                onClick={() => setTaxReceipt(!taxReceipt)}
                className={`w-12 h-6 rounded-full transition-all relative ${taxReceipt ? 'bg-brand-orange' : 'bg-brand-border'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow ${taxReceipt ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-brand-muted">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(effectiveDiscount)}</span>
                </div>
              )}
              {taxReceipt && (
                <div className="flex justify-between text-brand-muted">
                  <span>GST (18%)</span>
                  <span>{formatCurrency(gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-brand-border pt-2 mt-1">
                <span>Total</span>
                <span className="text-brand-orange">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Customer Information (Optional) */}
            <div className="bg-brand-card border border-brand-border/50 rounded-lg p-3 space-y-2">
              <button
                onClick={() => setShowCustomerForm(!showCustomerForm)}
                className="w-full text-left text-xs font-medium text-brand-orange hover:text-orange-400 flex items-center gap-1 justify-between"
              >
                <span>+ Customer Details (Optional)</span>
                <span>{showCustomerForm ? '▼' : '▶'}</span>
              </button>
              {showCustomerForm && (
                <div className="space-y-2 pt-2 border-t border-brand-border/30">
                  <div>
                    <label className="text-xs text-brand-muted block mb-0.5">Customer Name</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="e.g. Ravi Kumar"
                      className="pos-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-brand-muted block mb-0.5">Phone</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="9876543210"
                      className="pos-input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-brand-muted block mb-0.5">Email</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={e => setCustomerEmail(e.target.value)}
                      placeholder="ravi@example.com"
                      className="pos-input w-full text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="flex gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setPayment(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${payment === m ? 'bg-brand-orange border-brand-orange text-white' : 'border-brand-border text-brand-muted hover:border-brand-orange'}`}>
                  {m}
                </button>
              ))}
            </div>

            {payment === 'Cash' && (
              <div>
                <label className="text-xs text-brand-muted block mb-1">Cash Received (₹)</label>
                <input
                  type="number"
                  value={cashReceived || ''}
                  onChange={e => setCashReceived(e.target.value ? Number(e.target.value) : 0)}
                  placeholder="0"
                  className="pos-input w-full"
                />
                {cashReceived >= grandTotal && (
                  <p className="text-xs text-green-400 mt-1">Change: {formatCurrency(cashReceived - grandTotal)}</p>
                )}
              </div>
            )}

            {payment === 'UPI' && merchantUPI && (
              <div className="text-center">
                <p className="text-xs text-brand-muted mb-2">UPI: {merchantUPI}</p>
                <div className="flex gap-2 justify-center">
                  <a href={generateUPILink({ merchantUPI, amount: grandTotal, billId: 'PENDING', shopName })}
                    className="flex items-center gap-1 text-xs bg-brand-card border border-brand-border px-3 py-2 rounded-lg hover:border-brand-orange">
                    <QrCode size={14} /> Open UPI
                  </a>
                  <a href={`https://wa.me/?text=${generateWhatsAppMessage(upiLink, grandTotal, 'PENDING')}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs bg-brand-card border border-brand-border px-3 py-2 rounded-lg hover:border-brand-orange">
                    <Share2 size={14} /> WhatsApp
                  </a>
                </div>
              </div>
            )}

            {payment === 'Partial' && (
              <div>
                <label className="text-xs text-brand-muted block mb-1">Amount Paid Now</label>
                <input type="number" value={partialPaid} onChange={e => setPartialPaid(Number(e.target.value))} className="pos-input w-full" />
                <p className="text-xs text-yellow-400 mt-1">Due: {formatCurrency(Math.max(0, grandTotal - partialPaid))}</p>
              </div>
            )}

            {/* Complete Sale */}
            <button
              onClick={completeSale}
              disabled={completing}
              className="w-full py-4 btn-flame text-white rounded-xl font-bold text-lg tracking-wide shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {completing ? 'Processing...' : '✓ COMPLETE SALE'}
            </button>
          </div>
        )}
      </div>

      {/* Bill Print Modal */}
      {showBill && lastBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-brand-card border border-brand-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <h2 className="font-semibold">Bill: {lastBill.billId}</h2>
              <button onClick={() => setShowBill(false)}><X size={20} className="text-brand-muted" /></button>
            </div>
            <div className="p-4">
              <BillPrint saleId={lastBill.saleId} billId={lastBill.billId} merchantUPI={merchantUPI} shopName={shopName} />
              <div className="flex gap-3 mt-4 no-print">
                <button onClick={() => window.print()} className="flex-1 flex items-center justify-center gap-2 bg-brand-orange text-white py-2.5 rounded-lg">
                  <Printer size={16} /> Print
                </button>
                <button onClick={() => setShowBill(false)} className="flex-1 py-2.5 border border-brand-border rounded-lg text-brand-muted">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pos-input {
          background: #1A1A1A;
          border: 1px solid #2A2A2A;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          color: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .pos-input:focus { border-color: #E85000; }
        .pos-input option { background: #1A1A1A; }
      `}</style>
    </div>
  )
}

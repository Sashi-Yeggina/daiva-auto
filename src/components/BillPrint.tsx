import { useState, useEffect } from 'react'
import { supabase, Sale, CartItem, Customer } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/constants'
import QRCode from 'qrcode'
import { generateUPILink } from '../lib/upi'

interface BillPrintProps {
  saleId: string
  billId: string
  merchantUPI: string
  shopName: string
}

export default function BillPrint({ saleId, billId, merchantUPI, shopName }: BillPrintProps) {
  const [sale, setSale] = useState<Sale | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    const fetchSaleData = async () => {
      const { data: saleData } = await supabase.from('sales').select('*').eq('sale_id', saleId).single()
      setSale(saleData)

      // Fetch customer if customer_id exists
      if (saleData?.customer_id) {
        const { data: customerData } = await supabase.from('customers').select('*').eq('customer_id', saleData.customer_id).single()
        setCustomer(customerData || null)
      }
    }

    fetchSaleData()
    supabase.from('cart_items').select('*').eq('sale_id', saleId).then(({ data }) => setItems(data || []))
  }, [saleId])

  useEffect(() => {
    if (merchantUPI && sale?.grand_total) {
      const upiLink = generateUPILink({ merchantUPI, amount: sale.grand_total, billId, shopName })
      QRCode.toDataURL(upiLink, { width: 120, margin: 1 }).then(setQrDataUrl).catch(() => {})
    }
  }, [merchantUPI, sale, billId, shopName])

  if (!sale) return <div className="text-center text-brand-muted py-4">Loading bill...</div>

  return (
    <div className="bill-print bg-white text-black p-6 rounded-lg text-sm">
      {/* Header */}
      <div className="text-center border-b border-gray-200 pb-4 mb-4">
        <img
          src="/assets/logo-white.png"
          alt="Daiva Automobiles"
          className="w-16 h-16 object-contain mx-auto mb-2"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <h1 className="font-extrabold text-xl uppercase tracking-wider">Daiva Automobiles</h1>
        <p className="text-gray-600 text-xs mt-1">Buttayagudem, Opp Current Substation Office</p>
        <p className="text-gray-600 text-xs">+91 9640286867</p>
      </div>

      {/* Bill Info */}
      <div className="flex justify-between text-xs text-gray-600 mb-4">
        <div>
          <p><span className="font-medium">Bill #:</span> {billId}</p>
          <p><span className="font-medium">Source:</span> {sale.sale_source}</p>
        </div>
        <div className="text-right">
          <p><span className="font-medium">Date:</span> {formatDate(sale.sale_date)}</p>
          <p><span className="font-medium">Payment:</span> {sale.payment_type}</p>
        </div>
      </div>

      {/* Customer Info */}
      {customer && (
        <div className="border-l-4 border-blue-500 bg-blue-50 p-3 mb-4 text-xs">
          <p className="font-medium text-gray-800">Customer Details</p>
          <p className="text-gray-700"><span className="font-medium">Name:</span> {customer.name}</p>
          {customer.phone && <p className="text-gray-700"><span className="font-medium">Phone:</span> {customer.phone}</p>}
          {customer.vehicle_number && <p className="text-gray-700"><span className="font-medium">Vehicle #:</span> {customer.vehicle_number}</p>}
          {customer.bike_model && <p className="text-gray-700"><span className="font-medium">Bike:</span> {customer.bike_model}</p>}
        </div>
      )}

      {/* Items */}
      <table className="w-full text-xs mb-4">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1">Part</th>
            <th className="text-center py-1">Qty</th>
            <th className="text-right py-1">Price</th>
            {sale.tax_receipt && <th className="text-right py-1">GST</th>}
            <th className="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.cart_item_id} className="border-b border-gray-100">
              <td className="py-1">{item.part_name}</td>
              <td className="text-center py-1">{item.qty}</td>
              <td className="text-right py-1">₹{item.selling_price}</td>
              {sale.tax_receipt && <td className="text-right py-1">{item.gst_percent}%</td>}
              <td className="text-right py-1 font-medium">₹{item.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-gray-200 pt-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-{formatCurrency(sale.discount)}</span>
          </div>
        )}
        {sale.tax_receipt && sale.gst_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">GST (18%)</span>
            <span>{formatCurrency(sale.gst_amount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-1">
          <span>Grand Total</span>
          <span>₹{sale.grand_total.toFixed(2)}</span>
        </div>
        {sale.balance_due > 0 && (
          <div className="flex justify-between text-red-600 font-medium">
            <span>Balance Due</span>
            <span>{formatCurrency(sale.balance_due)}</span>
          </div>
        )}
      </div>

      {/* UPI QR */}
      {qrDataUrl && (
        <div className="text-center mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">Scan to Pay via UPI</p>
          <img src={qrDataUrl} alt="UPI QR" className="w-28 h-28 mx-auto" />
          <p className="text-xs text-gray-500 mt-1">{merchantUPI}</p>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-4">Thank you for your business!</p>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .bill-print, .bill-print * { visibility: visible; }
          .bill-print { position: absolute; left: 0; top: 0; width: 100%; background: white; color: black; }
        }
      `}</style>
    </div>
  )
}

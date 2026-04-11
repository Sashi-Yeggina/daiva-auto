import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon, Save, Lock, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const [pinVerified, setPinVerified] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [storedPin, setStoredPin] = useState('6206')
  const [saving, setSaving] = useState(false)

  const [shopName, setShopName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [upiId, setUpiId] = useState('')
  const [gstDefault, setGstDefault] = useState('18')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPin, setCurrentPin] = useState('')

  useEffect(() => {
    supabase.from('settings').select('*').then(({ data }) => {
      if (!data) return
      const get = (key: string) => data.find(s => s.key === key)?.value || ''
      setStoredPin(get('pin_hash') || '6206')
      setShopName(get('shop_name'))
      setPhone(get('phone'))
      setLocation(get('location'))
      setUpiId(get('merchant_upi_id'))
      setGstDefault(get('gst_default') || '18')
    })
  }, [])

  const verifyPin = () => {
    if (pinInput === storedPin) setPinVerified(true)
    else { setPinInput(''); toast.error('Incorrect PIN') }
  }

  const saveSetting = async (key: string, value: string) => {
    const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
    if (error) throw error
  }

  const saveShopInfo = async () => {
    setSaving(true)
    try {
      await Promise.all([
        saveSetting('shop_name', shopName),
        saveSetting('phone', phone),
        saveSetting('location', location),
        saveSetting('merchant_upi_id', upiId),
        saveSetting('gst_default', gstDefault),
      ])
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const changePin = async () => {
    if (currentPin !== storedPin) { toast.error('Current PIN is wrong'); return }
    if (newPin.length !== 4 || isNaN(Number(newPin))) { toast.error('PIN must be 4 digits'); return }
    if (newPin !== confirmPin) { toast.error('PINs do not match'); return }
    try {
      await saveSetting('pin_hash', newPin)
      setStoredPin(newPin)
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      toast.success('PIN changed successfully')
    } catch {
      toast.error('Failed to change PIN')
    }
  }

  if (!pinVerified) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <div className="bg-brand-card border border-brand-border rounded-xl p-8 max-w-sm w-full text-center">
          <SettingsIcon size={32} className="text-brand-orange mx-auto mb-4" />
          <h2 className="font-bold text-lg mb-2">Settings — PIN Required</h2>
          <p className="text-brand-muted text-sm mb-6">Enter your PIN to access settings</p>
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
            Unlock Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <SettingsIcon size={22} className="text-brand-orange" />
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Shop Info */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-4">
        <h2 className="font-semibold">Shop Information</h2>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Shop Name</label>
          <input value={shopName} onChange={e => setShopName(e.target.value)} className="sform-input" />
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Phone Number</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="sform-input" />
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Location / Address</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className="sform-input" />
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Merchant UPI ID (for payments)</label>
          <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="9640286867@ybl" className="sform-input" />
          <p className="text-xs text-brand-muted mt-1">Used to generate QR codes and payment links on bills</p>
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Default GST %</label>
          <input type="number" value={gstDefault} onChange={e => setGstDefault(e.target.value)} className="sform-input w-24" />
        </div>
        <button onClick={saveShopInfo} disabled={saving} className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Change PIN */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-brand-orange" />
          <h2 className="font-semibold">Change PIN</h2>
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Current PIN</label>
          <input type="password" value={currentPin} onChange={e => setCurrentPin(e.target.value)} maxLength={4} className="sform-input w-32 text-center tracking-widest" />
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">New PIN (4 digits)</label>
          <input type="password" value={newPin} onChange={e => setNewPin(e.target.value)} maxLength={4} className="sform-input w-32 text-center tracking-widest" />
        </div>
        <div>
          <label className="text-xs text-brand-muted mb-1 block">Confirm New PIN</label>
          <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} maxLength={4} className="sform-input w-32 text-center tracking-widest" />
        </div>
        <button onClick={changePin} className="flex items-center gap-2 bg-brand-card border border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all">
          <Lock size={16} /> Change PIN
        </button>
      </div>

      {/* Phase 3 placeholders */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-4 space-y-3 opacity-60">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Advanced Features</h2>
          <span className="text-xs bg-brand-border text-brand-muted px-2 py-0.5 rounded">Coming in Phase 3</span>
        </div>
        {[
          { label: 'Email for Daily Reports', placeholder: 'your@email.com' },
          { label: 'Claude AI API Key', placeholder: 'sk-ant-...' },
          { label: 'Razorpay Key ID', placeholder: 'rzp_live_...' },
          { label: 'Razorpay Key Secret', placeholder: '••••••••••••••••' },
        ].map(({ label, placeholder }) => (
          <div key={label}>
            <label className="text-xs text-brand-muted mb-1 block">{label}</label>
            <input disabled placeholder={placeholder} className="sform-input opacity-50 cursor-not-allowed" />
          </div>
        ))}
      </div>

      <style>{`
        .sform-input {
          width: 100%;
          background: #0D0D0D;
          border: 1px solid #2A2A2A;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 14px;
          color: white;
          outline: none;
        }
        .sform-input:focus { border-color: #E85000; }
        .sform-input:disabled { opacity: 0.5; }
      `}</style>
    </div>
  )
}

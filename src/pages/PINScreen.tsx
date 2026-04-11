import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Delete } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { setAuthenticated } from '../lib/auth'

export default function PINScreen() {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [storedPin, setStoredPin] = useState('6206')
  const navigate = useNavigate()

  useEffect(() => {
    // Load PIN from Supabase settings
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'pin_hash')
      .single()
      .then(({ data }) => {
        if (data?.value) setStoredPin(data.value)
      })
  }, [])

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === storedPin) {
        setAuthenticated(true)
        navigate('/pos')
      } else {
        setShake(true)
        toast.error('Incorrect PIN')
        setTimeout(() => {
          setPin('')
          setShake(false)
        }, 600)
      }
    }
  }, [pin, storedPin, navigate])

  const handleKey = (key: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + key)
    }
  }

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1))
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4">
      {/* Logo / Shop Name */}
      <div className="mb-10 text-center">
        <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
          <img
            src="/assets/logo-dark.png"
            alt="Daiva Automobiles"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
        <h1 className="text-3xl font-extrabold text-brand-orange tracking-widest uppercase">
          DAIVA
        </h1>
        <p className="text-brand-muted text-sm mt-1">Automobiles · Buttayagudem</p>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-4 mb-8 ${shake ? 'shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              pin.length > i
                ? 'bg-brand-orange border-brand-orange scale-110'
                : 'border-brand-border bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* PIN Pad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {keys.map((key, idx) => {
          if (key === '') return <div key={idx} />
          if (key === 'del') {
            return (
              <button
                key={idx}
                onClick={handleDelete}
                className="w-full aspect-square rounded-full border border-brand-border bg-brand-card flex items-center justify-center text-brand-muted hover:border-brand-orange hover:text-white transition-all active:scale-95"
              >
                <Delete size={20} />
              </button>
            )
          }
          return (
            <button
              key={idx}
              onClick={() => handleKey(key)}
              className="w-full aspect-square rounded-full border border-brand-border bg-brand-card text-xl font-semibold hover:border-brand-orange hover:bg-brand-orange hover:text-white transition-all active:scale-95 active:bg-brand-orange"
            >
              {key}
            </button>
          )
        })}
      </div>

      <p className="mt-8 text-brand-muted text-xs">
        Enter 4-digit PIN to continue
      </p>
    </div>
  )
}

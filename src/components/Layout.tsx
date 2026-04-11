import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  ShoppingCart, Package, Wrench, Users, DollarSign,
  BarChart2, Settings, LogOut, Menu, X, Wifi, WifiOff
} from 'lucide-react'
import { logout } from '../lib/auth'

const navItems = [
  { to: '/pos', icon: ShoppingCart, label: 'POS' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/mechanics', icon: Wrench, label: 'Mechanics' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/expenses', icon: DollarSign, label: 'Expenses' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [online] = useState(navigator.onLine)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/pin')
  }

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col w-56 bg-brand-card border-r border-brand-border shrink-0`}>
        {/* Logo */}
        <div className="p-4 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo-dark.png"
              alt="Logo"
              className="w-12 h-12 object-contain shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="min-w-0">
              <p className="text-brand-orange font-extrabold text-sm tracking-widest uppercase">DAIVA</p>
              <p className="text-brand-muted text-xs">Automobiles</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-orange text-white'
                    : 'text-brand-muted hover:text-white hover:bg-brand-border'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-brand-border space-y-2">
          <div className="flex items-center gap-2 px-3 py-1">
            {online ? (
              <><Wifi size={14} className="text-green-500" /><span className="text-xs text-green-500">Online</span></>
            ) : (
              <><WifiOff size={14} className="text-red-500" /><span className="text-xs text-red-500">Offline</span></>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-brand-muted hover:text-white hover:bg-brand-border transition-all"
          >
            <LogOut size={18} />
            Lock App
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-brand-card border-r border-brand-border flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-brand-border">
              <p className="text-brand-orange font-extrabold tracking-widest uppercase">DAIVA</p>
              <button onClick={() => setSidebarOpen(false)}><X size={20} className="text-brand-muted" /></button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive ? 'bg-brand-orange text-white' : 'text-brand-muted hover:text-white hover:bg-brand-border'
                    }`
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="p-3 border-t border-brand-border">
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-brand-muted hover:text-white">
                <LogOut size={18} /> Lock App
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-3 py-2 bg-brand-card border-b border-brand-border shrink-0 gap-2">
          <button onClick={() => setSidebarOpen(true)} className="shrink-0">
            <Menu size={22} className="text-brand-muted" />
          </button>
          <img
            src="/assets/logo-dark.png"
            alt="Logo"
            className="w-8 h-8 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <p className="text-brand-orange font-extrabold tracking-widest text-xs uppercase flex-1 truncate">DAIVA</p>
          <div className="flex items-center gap-1 shrink-0">
            {online
              ? <div className="w-2 h-2 rounded-full bg-green-500" />
              : <div className="w-2 h-2 rounded-full bg-red-500" />
            }
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-card border-t border-brand-border flex z-40">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-all ${
                  isActive ? 'text-brand-orange' : 'text-brand-muted'
                }`
              }
            >
              <Icon size={20} />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

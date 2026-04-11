import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PINScreen from './pages/PINScreen'
import Layout from './components/Layout'
import POS from './pages/POS'
import Inventory from './pages/Inventory'
import Mechanics from './pages/Mechanics'
import Customers from './pages/Customers'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import { isAuthenticated } from './lib/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/pin" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-brand-bg text-white">
          <Routes>
            <Route path="/pin" element={<PINScreen />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/pos" replace />} />
              <Route path="pos" element={<POS />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="mechanics" element={<Mechanics />} />
              <Route path="customers" element={<Customers />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/pin" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1A1A1A',
            color: '#FFFFFF',
            border: '1px solid #2A2A2A',
          },
          success: {
            iconTheme: { primary: '#22C55E', secondary: '#1A1A1A' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#1A1A1A' },
          },
        }}
      />
    </QueryClientProvider>
  )
}

export default App

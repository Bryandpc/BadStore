import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import StorePage from './pages/StorePage'
import CheckoutPage from './pages/CheckoutPage'
import AuthPage from './pages/AuthPage'
import MyOrdersPage from './pages/MyOrdersPage'
import ProfilePage from './pages/ProfilePage'
import CartDrawer from './components/CartDrawer'
import { messaging, onMessage } from './firebase'
import './index.css'

function InAppToast() {
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const unsub = onMessage(messaging, payload => {
      const { title, body } = payload.notification ?? {}
      if (!title) return
      setToast({ title, body })
      setTimeout(() => setToast(null), 5000)
    })
    return unsub
  }, [])

  if (!toast) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-[90vw] animate-fade-in">
      <div className="flex items-start gap-3 bg-surface-container-high border border-outline-variant rounded-xl px-4 py-3 shadow-2xl">
        <img src="/logo-gengar.png" alt="" className="w-8 h-8 object-contain shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-on-surface">{toast.title}</p>
          {toast.body && <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">{toast.body}</p>}
        </div>
        <button onClick={() => setToast(null)} className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <InAppToast />
        <CartDrawer />
        <Routes>
          <Route path="/" element={<StorePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/meus-pedidos" element={<MyOrdersPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

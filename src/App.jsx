import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import StorePage from './pages/StorePage'
import CheckoutPage from './pages/CheckoutPage'
import AuthPage from './pages/AuthPage'
import MyOrdersPage from './pages/MyOrdersPage'
import ProfilePage from './pages/ProfilePage'
import CartDrawer from './components/CartDrawer'
import useCartStore from './store/useCartStore'
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

function ConflictToast() {
  const conflict = useCartStore(s => s.conflict)
  const clearConflict = useCartStore(s => s.clearConflict)
  const setOpen = useCartStore(s => s.setOpen)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (conflict) {
      setVisible(true)
      const t = setTimeout(() => { setVisible(false); setTimeout(clearConflict, 300) }, 4000)
      return () => clearTimeout(t)
    }
  }, [conflict])

  if (!conflict) return null

  const currentLabel = conflict.currentCat === 'croche' ? '🧶 Crochê' : '⚡ TCG'
  const triedLabel   = conflict.triedCat   === 'croche' ? '🧶 Crochê' : '⚡ TCG'

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-[92vw] transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
    >
      <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 shadow-2xl"
        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🚫</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">
            Carrinho é exclusivo {currentLabel}
          </p>
          <p className="text-xs mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Não é possível misturar {triedLabel} com {currentLabel} no mesmo pedido. Finalize ou esvazie o carrinho primeiro.
          </p>
          <button
            onClick={() => { setOpen(true); setVisible(false); setTimeout(clearConflict, 300) }}
            className="mt-2 text-xs font-bold"
            style={{ color: conflict.currentCat === 'croche' ? '#d8a8ff' : '#a8b4ff' }}
          >
            Ver carrinho →
          </button>
        </div>
        <button onClick={() => { setVisible(false); setTimeout(clearConflict, 300) }}
          style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}
          className="hover:text-white transition-colors mt-0.5">
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
        <ConflictToast />
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

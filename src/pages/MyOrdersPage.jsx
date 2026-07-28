import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function fmtBRL(val) {
  if (val == null) return '—'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS = {
  pendente:   { label: 'Pendente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  confirmado: { label: 'Confirmado', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  separando:  { label: 'Separando',  color: '#8127cf', bg: 'rgba(129,39,207,0.12)' },
  enviado:    { label: 'Enviado',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  entregue:   { label: 'Entregue',   color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  cancelado:  { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

export default function MyOrdersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (user === null) { navigate('/login?next=/meus-pedidos', { replace: true }); return }
    if (!user) return

    const q = query(
      collection(db, 'orders'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [user])

  if (user === undefined || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0a1e' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(167,139,250,0.4)', borderTopColor: '#a78bfa' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#0d0a1e' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 shadow-xl" style={{ background: 'linear-gradient(135deg, #0d0a1e 0%, #1a0a2e 100%)', borderBottom: '1px solid rgba(167,139,250,0.1)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(167,139,250,0.8)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <img src="/logo-gengar.png" alt="logo" className="w-8 h-8 object-contain" />
          <h1 className="text-base font-bold text-white">Meus Pedidos</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4" style={{ color: 'rgba(167,139,250,0.3)' }}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p className="text-sm font-medium" style={{ color: 'rgba(167,139,250,0.5)' }}>Nenhum pedido ainda</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-5 py-2 rounded-xl text-white text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #3525cd, #8127cf)' }}
            >
              Ver produtos
            </button>
          </div>
        ) : orders.map(order => {
          const st = STATUS[order.status] ?? STATUS.pendente
          const isOpen = expanded === order.id
          return (
            <div
              key={order.id}
              className="rounded-2xl overflow-hidden cursor-pointer transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(167,139,250,0.12)' }}
              onClick={() => setExpanded(isOpen ? null : order.id)}
            >
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">#{order.id.slice(-6).toUpperCase()}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(167,139,250,0.5)' }}>{fmtDate(order.createdAt)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-black text-white">{fmtBRL(order.total)}</p>
                  <p className="text-xs" style={{ color: 'rgba(167,139,250,0.5)' }}>{order.items?.length} item{order.items?.length !== 1 ? 's' : ''}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ color: 'rgba(167,139,250,0.4)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(167,139,250,0.08)' }}>
                  <div className="px-4 py-3 space-y-2">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.quantity}x {item.name}</span>
                        <span className="font-semibold text-white">{fmtBRL(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid rgba(167,139,250,0.08)', background: 'rgba(53,37,205,0.08)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'rgba(167,139,250,0.7)' }}>Total</span>
                    <span className="font-black text-white">{fmtBRL(order.total)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

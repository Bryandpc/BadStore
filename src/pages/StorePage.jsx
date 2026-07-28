import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import ProductCard from '../components/ProductCard'
import useCartStore from '../store/useCartStore'
import { useAuth } from '../contexts/AuthContext'

const CATEGORIES = [
  { value: 'all', label: 'Todos' },
  { value: 'tcg', label: 'TCG' },
  { value: 'croche', label: 'Crochê' },
]

export default function StorePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const cartCount = useCartStore(s => s.items.reduce((acc, i) => acc + i.quantity, 0))
  const setOpen = useCartStore(s => s.setOpen)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [userMenu, setUserMenu] = useState(false)
  const [showQR, setShowQR] = useState(false)

  const WA_GROUP = 'https://chat.whatsapp.com/LNFKF4WHzXE9hpaaycAosa'

  useEffect(() => {
    const q = query(collection(db, 'stock_items'), where('available', '>', 0))
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [])

  const filtered = useMemo(() => {
    return items
      .filter(i => category === 'all' || i.saleCategory === category)
      .filter(i => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, search, category])

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      {/* Header */}
      <header className="sticky top-0 z-30 shadow-xl" style={{ background: 'linear-gradient(135deg, #0d0a1e 0%, #1a0a2e 50%, #0d0a1e 100%)' }}>
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3">
          <img src="/logo-gengar.png" alt="Gengar" className="w-10 h-10 object-contain flex-shrink-0" />
          <div className="flex-1">
            <img src="/logo-nome.png" alt="BAD TCG" className="h-8 object-contain object-left" />
            <p className="text-[11px] leading-none mt-0.5" style={{ color: 'rgba(167,139,250,0.7)' }}>TCG & Crochê</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Carrinho */}
            <button
              onClick={() => setOpen(true)}
              className="relative p-2 rounded-xl transition-colors"
              style={{ color: 'rgba(167,139,250,0.9)' }}
              aria-label="Carrinho"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <path d="M3 6h18M16 10a4 4 0 01-8 0"/>
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3525cd, #8127cf)', color: 'white' }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {/* Usuário */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenu(v => !v)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3525cd, #8127cf)' }}
                  title={user.displayName || user.email}
                >
                  {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                </button>
                {userMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                    <div className="absolute right-0 top-10 z-50 rounded-xl py-1 min-w-[160px] shadow-xl"
                      style={{ background: '#1a0a2e', border: '1px solid rgba(167,139,250,0.2)' }}>
                      <p className="px-4 py-2 text-xs font-semibold truncate" style={{ color: 'rgba(167,139,250,0.7)' }}>
                        {user.displayName || user.email}
                      </p>
                      <hr style={{ borderColor: 'rgba(167,139,250,0.1)' }} />
                      <button
                        onClick={() => { navigate('/meus-pedidos'); setUserMenu(false) }}
                        className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                      >
                        Meus Pedidos
                      </button>
                      <button
                        onClick={() => { logout(); setUserMenu(false) }}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
                      >
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30 focus:border-[#3525cd] transition"
            />
          </div>
          <div className="flex gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  category === cat.value
                    ? 'brand-gradient text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#3525cd]/40'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Banner comunidade WhatsApp */}
        <div
          className="mb-5 rounded-2xl flex items-center gap-4 px-5 py-4 cursor-pointer select-none"
          style={{ background: 'linear-gradient(135deg, #0d0a1e 0%, #1a0a2e 100%)', border: '1px solid rgba(37,211,102,0.25)' }}
          onClick={() => setShowQR(true)}
        >
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(37,211,102,0.15)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#25d366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M11.99 0C5.373 0 0 5.373 0 11.99c0 2.117.555 4.099 1.525 5.822L0 24l6.335-1.54A11.945 11.945 0 0011.99 24C18.607 24 24 18.627 24 11.99 24 5.373 18.607 0 11.99 0z" opacity=".5"/>
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ background: '#25d366' }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: '#25d366' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Entre na nossa comunidade!</p>
            <p className="text-xs" style={{ color: 'rgba(37,211,102,0.8)' }}>Grupo BadTCG no WhatsApp — promoções e novidades</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgba(37,211,102,0.6)', flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 opacity-40">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">{filtered.length} produto{filtered.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map(item => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal QR WhatsApp */}
      {showQR && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
            <div className="rounded-3xl overflow-hidden max-w-xs w-full" style={{ background: '#1a0a2e', border: '1px solid rgba(37,211,102,0.3)' }} onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div>
                  <p className="text-base font-black text-white">Grupo BadTCG</p>
                  <p className="text-xs" style={{ color: 'rgba(167,139,250,0.6)' }}>Escaneie ou clique para entrar</p>
                </div>
                <button onClick={() => setShowQR(false)} className="p-1.5 rounded-lg" style={{ color: 'rgba(167,139,250,0.6)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <img src="/whatsapp-qr.jpg" alt="QR Code WhatsApp" className="w-full" />
              <div className="px-5 pb-5 pt-3">
                <a
                  href={WA_GROUP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M11.99 0C5.373 0 0 5.373 0 11.99c0 2.117.555 4.099 1.525 5.822L0 24l6.335-1.54A11.945 11.945 0 0011.99 24C18.607 24 24 18.627 24 11.99 24 5.373 18.607 0 11.99 0z" opacity=".5"/>
                  </svg>
                  Entrar no grupo
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

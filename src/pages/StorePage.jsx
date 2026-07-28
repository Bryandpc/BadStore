import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import ProductCard from '../components/ProductCard'
import useCartStore from '../store/useCartStore'
import { useAuth } from '../contexts/AuthContext'

const WA_GROUP = 'https://chat.whatsapp.com/LNFKF4WHzXE9hpaaycAosa'

const SUBTYPES = [
  { key: 'selado', label: 'Boosters & Blisters' },
  { key: 'coleção', label: 'Coleções Especiais' },
  { key: 'etb', label: 'Elite Trainer Boxes' },
  { key: 'carta', label: 'Cartas Avulsas (Singles)' },
]

export default function StorePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeSet, setActiveSet] = useState('all')
  const [activeSubtypes, setActiveSubtypes] = useState([])
  const [showQR, setShowQR] = useState(false)
  const [userMenu, setUserMenu] = useState(false)

  const cartItems = useCartStore(s => s.items)
  const setOpen = useCartStore(s => s.setOpen)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0)

  useEffect(() => {
    const q = query(collection(db, 'stock_items'), where('available', '>', 0))
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [])

  // Unique sets sorted alphabetically
  const sets = useMemo(() => {
    const s = [...new Set(items.map(i => i.setName).filter(Boolean))].sort()
    return s
  }, [items])

  const toggleSubtype = (key) => {
    setActiveSubtypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const filtered = useMemo(() => {
    return items
      .filter(i => activeSet === 'all' || i.setName === activeSet)
      .filter(i => activeSubtypes.length === 0 || activeSubtypes.includes(i.itemSubtype))
      .filter(i => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()))
  }, [items, search, activeSet, activeSubtypes])

  // Group filtered items by setName for display
  const grouped = useMemo(() => {
    if (activeSet !== 'all') {
      return [{ set: activeSet || 'Produtos', items: filtered }]
    }
    const map = {}
    filtered.forEach(item => {
      const key = item.setName || 'Outros'
      if (!map[key]) map[key] = []
      map[key].push(item)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([set, items]) => ({ set, items }))
  }, [filtered, activeSet])

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-outline-variant bg-background/95 backdrop-blur-md shadow-md">
        <div className="flex justify-between items-center px-6 md:px-16 py-4 w-full max-w-container mx-auto">
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo-gengar.png" alt="gengar" className="w-9 h-9 object-contain" />
              <img src="/logo-nome.png" alt="BAD TCG" className="h-7 object-contain" />
            </a>
            <nav className="hidden md:flex items-center gap-6">
              <a href="/" className="text-primary font-bold border-b-2 border-primary pb-1 text-sm">Catálogo</a>
            </nav>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-8 hidden sm:block">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
              <input
                type="text"
                placeholder="Buscar no vault..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-surface-container border-none focus:ring-1 focus:ring-primary rounded-lg pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="relative p-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">shopping_cart</span>
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenu(v => !v)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-on-primary bg-primary-container"
                  title={user.displayName || user.email}
                >
                  {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                </button>
                {userMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                    <div className="absolute right-0 top-10 z-50 rounded-xl py-1 min-w-[160px] shadow-xl bg-surface-container-high border border-outline-variant">
                      <p className="px-4 py-2 text-xs font-semibold truncate text-on-surface-variant">{user.displayName || user.email}</p>
                      <hr className="border-outline-variant" />
                      <button onClick={() => { navigate('/meus-pedidos'); setUserMenu(false) }} className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors">Meus Pedidos</button>
                      <button onClick={() => { logout(); setUserMenu(false) }} className="w-full text-left px-4 py-2 text-sm text-error hover:bg-surface-container transition-colors">Sair</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => navigate('/login')} className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">account_circle</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-container mx-auto px-6 md:px-16 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0 space-y-8">
            <div>
              <h3 className="font-display font-bold text-primary uppercase text-xs tracking-widest mb-4">Coleções</h3>
              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveSet('all')}
                  className={`px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${activeSet === 'all' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                >
                  Todas as Coleções
                </button>
                {sets.map(set => (
                  <button
                    key={set}
                    onClick={() => setActiveSet(set)}
                    className={`px-3 py-2 rounded-lg text-left text-sm transition-colors ${activeSet === set ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                  >
                    {set}
                  </button>
                ))}
                {sets.length === 0 && !loading && (
                  <p className="text-xs text-on-surface-variant px-3">Nenhuma coleção</p>
                )}
              </nav>
            </div>

            <div>
              <h3 className="font-display font-bold text-on-surface uppercase text-xs tracking-widest mb-4">Tipo de Produto</h3>
              <div className="flex flex-col gap-2">
                {SUBTYPES.map(s => (
                  <label key={s.key} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={activeSubtypes.includes(s.key)}
                      onChange={() => toggleSubtype(s.key)}
                      className="form-checkbox bg-surface-container border-outline-variant rounded text-primary-container focus:ring-primary-container"
                    />
                    <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>

          {/* Product area */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-surface-container-low rounded-xl h-80 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-24 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl mb-4 opacity-40">search_off</span>
                <p className="text-sm">Nenhum produto encontrado</p>
              </div>
            ) : (
              grouped.map(({ set, items: groupItems }) => (
                <div key={set} className="mb-16">
                  <div className="flex items-center justify-between mb-8 border-b border-outline-variant pb-4">
                    <div className="flex items-baseline gap-3">
                      <h2 className="font-display text-3xl font-bold text-on-background">{set}</h2>
                      <span className="text-on-surface-variant text-sm">{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {groupItems.sort((a, b) => a.name.localeCompare(b.name)).map(item => (
                      <ProductCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </main>
        </div>
      </div>

      {/* WhatsApp Community Banner */}
      <section className="max-w-container mx-auto px-6 md:px-16 pb-16">
        <div
          onClick={() => setShowQR(true)}
          className="bg-surface-container-highest rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-outline-variant hover:border-primary transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shrink-0 relative">
              <span className="material-symbols-outlined text-white text-2xl">forum</span>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#25D366] animate-ping" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#25D366]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface">Entre na nossa comunidade!</h3>
              <p className="text-on-surface-variant text-sm">Grupo BadTCG no WhatsApp — promoções e novidades exclusivas em primeira mão.</p>
            </div>
          </div>
          <button className="shrink-0 border border-outline-variant group-hover:border-primary group-hover:text-primary px-6 py-2 rounded-full font-bold flex items-center gap-2 text-on-surface-variant transition-all text-sm">
            Participar Agora
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant bg-surface-container-lowest">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-6 md:px-16 py-12 max-w-container mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo-gengar.png" alt="logo" className="w-8 h-8 object-contain" />
              <img src="/logo-nome.png" alt="BAD TCG" className="h-6 object-contain" />
            </div>
            <p className="text-on-surface-variant text-sm mb-4">O cofre premium para a sua coleção Pokémon. Qualidade, raridade e segurança em cada envio.</p>
          </div>
          <div>
            <h4 className="font-bold text-on-surface mb-4 uppercase text-xs tracking-widest">Loja</h4>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              <li><a href="/" className="hover:text-primary transition-colors">Todos os Produtos</a></li>
              <li><a href="/" className="hover:text-primary transition-colors">TCG Pokémon</a></li>
              <li><a href="/" className="hover:text-primary transition-colors">Artes em Crochê</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-on-surface mb-4 uppercase text-xs tracking-widest">Informações</h4>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              <li><span className="hover:text-primary transition-colors cursor-pointer">Envios</span></li>
              <li><span className="hover:text-primary transition-colors cursor-pointer">Pagamentos</span></li>
              <li><span className="hover:text-primary transition-colors cursor-pointer">FAQ</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-on-surface mb-4 uppercase text-xs tracking-widest">Suporte</h4>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              <li><span className="hover:text-primary transition-colors cursor-pointer">Termos de Uso</span></li>
              <li><span className="hover:text-primary transition-colors cursor-pointer">Privacidade</span></li>
              <li><span className="hover:text-primary transition-colors cursor-pointer">Contato</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-outline-variant py-6 text-center">
          <p className="text-on-surface-variant text-sm">© 2025 Bad TCG. Premium Pokémon Collection Vault. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
          <div className="rounded-2xl overflow-hidden max-w-xs w-full bg-surface-container-low border border-outline-variant" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-on-surface">Grupo BadTCG</p>
                <p className="text-xs text-on-surface-variant">Escaneie ou clique para entrar</p>
              </div>
              <button onClick={() => setShowQR(false)} className="text-on-surface-variant hover:text-on-surface p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <img src="/whatsapp-qr.jpg" alt="QR Code" className="w-full" />
            <div className="px-5 pb-5 pt-3">
              <a href={WA_GROUP} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm text-white bg-[#25d366] hover:bg-[#20ba5a] transition-colors">
                <span className="material-symbols-outlined text-lg">forum</span>
                Entrar no grupo
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

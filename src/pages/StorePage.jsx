import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import ProductCard from '../components/ProductCard'
import useCartStore from '../store/useCartStore'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from '../components/NotificationBell'

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
  const [activeCategory, setActiveCategory] = useState('tcg') // 'tcg' | 'croche'
  const [activeSet, setActiveSet] = useState('all')
  const [activeSubtypes, setActiveSubtypes] = useState([])
  const [showOutOfStock, setShowOutOfStock] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [customOrderOpen, setCustomOrderOpen] = useState(false)
  const [customOrderDesc, setCustomOrderDesc] = useState('')
  const [customOrderName, setCustomOrderName] = useState('')
  const [customOrderPhone, setCustomOrderPhone] = useState('')
  const [customOrderLoading, setCustomOrderLoading] = useState(false)
  const [customOrderSuccess, setCustomOrderSuccess] = useState(false)
  const [customOrderError, setCustomOrderError] = useState('')

  const isCroche = activeCategory === 'croche'

  const cartItems = useCartStore(s => s.items)
  const setOpen = useCartStore(s => s.setOpen)
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()

  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0)
  const cartTotal = cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  useEffect(() => {
    const q = query(collection(db, 'stock_items'))
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [])

  // Itens da categoria ativa
  const categoryItems = useMemo(() =>
    items.filter(i => (i.saleCategory ?? 'tcg') === activeCategory),
    [items, activeCategory]
  )

  // Unique sets sorted alphabetically (da categoria ativa)
  const sets = useMemo(() => {
    const s = [...new Set(categoryItems.map(i => i.setName).filter(Boolean))].sort()
    return s
  }, [categoryItems])

  const toggleSubtype = (key) => {
    setActiveSubtypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const filtered = useMemo(() => {
    return categoryItems
      .filter(i => activeSet === 'all' || i.setName === activeSet)
      .filter(i => !isCroche && activeSubtypes.length > 0 ? activeSubtypes.includes(i.itemSubtype) : true)
      .filter(i => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()))
      .filter(i => isCroche || showOutOfStock || (i.available ?? 0) > 0)
  }, [categoryItems, search, activeSet, activeSubtypes, showOutOfStock, isCroche])

  // Ordena: em estoque primeiro (só TCG), depois alfabético
  function sortItems(arr) {
    if (isCroche) return [...arr].sort((a, b) => a.name.localeCompare(b.name))
    return [...arr].sort((a, b) => {
      const aAvail = (a.available ?? 0) > 0 ? 0 : 1
      const bAvail = (b.available ?? 0) > 0 ? 0 : 1
      if (aAvail !== bAvail) return aAvail - bAvail
      return a.name.localeCompare(b.name)
    })
  }

  const CUSTOM_ORDER_ITEM = {
    id: 'custom-order',
    name: 'Chaveiro Personalizado',
    saleCategory: 'croche',
    isCustomOrder: true,
    available: 999,
    targetPrice: null,
  }

  // Group filtered items by setName for display
  const grouped = useMemo(() => {
    if (activeSet !== 'all') {
      const base = sortItems(filtered)
      return [{ set: activeSet || 'Produtos', items: isCroche ? [CUSTOM_ORDER_ITEM, ...base] : base }]
    }
    const map = {}
    filtered.forEach(item => {
      const key = item.setName || (isCroche ? 'Crochê' : 'Outros')
      if (!map[key]) map[key] = []
      map[key].push(item)
    })
    const result = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([set, items]) => ({ set, items: sortItems(items) }))

    // Injeta card de encomenda personalizada no início do primeiro grupo de crochê
    if (isCroche) {
      if (result.length === 0) {
        return [{ set: 'Crochê', items: [CUSTOM_ORDER_ITEM] }]
      }
      return [{ ...result[0], items: [CUSTOM_ORDER_ITEM, ...result[0].items] }, ...result.slice(1)]
    }
    return result
  }, [filtered, activeSet, isCroche])

  async function submitCustomOrder() {
    const name = customOrderName.trim() || profile?.name || user?.displayName || ''
    const phone = customOrderPhone.trim() || profile?.phone || ''
    const desc = customOrderDesc.trim()
    if (!desc) { setCustomOrderError('Descreva o que você quer 🧶'); return }
    if (!name) { setCustomOrderError('Informe seu nome'); return }
    if (!phone) { setCustomOrderError('Informe seu WhatsApp para contato'); return }
    if (!user) { navigate('/login'); return }

    setCustomOrderLoading(true)
    setCustomOrderError('')
    try {
      await addDoc(collection(db, 'orders'), {
        customerName: name,
        customerContact: phone,
        customerEmail: user.email ?? '',
        customerPhotoUrl: profile?.photoUrl || user.photoURL || '',
        uid: user.uid,
        items: [{ id: 'custom-order', name: 'Chaveiro Personalizado', quantity: 1, unitPrice: 0 }],
        total: 0,
        status: 'draft',
        origem: 'badstore',
        saleCategory: 'croche',
        customerNote: desc,
        createdAt: serverTimestamp(),
      })
      setCustomOrderSuccess(true)
      setCustomOrderDesc('')
    } catch (err) {
      setCustomOrderError('Erro ao enviar: ' + err.message)
    } finally {
      setCustomOrderLoading(false)
    }
  }

  return (
    <>
    {customOrderOpen && (
      <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => { setCustomOrderOpen(false); setCustomOrderSuccess(false); setCustomOrderError('') }}>
        <div className="w-full max-w-md bg-surface-container-low rounded-2xl overflow-hidden shadow-2xl border border-pink-500/30" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant bg-surface-container">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-pink-300">auto_fix_high</span>
              <h2 className="font-display font-bold text-on-surface text-base">Chaveiro Personalizado</h2>
            </div>
            <button onClick={() => { setCustomOrderOpen(false); setCustomOrderSuccess(false); setCustomOrderError('') }} className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {customOrderSuccess ? (
            <div className="p-6 text-center space-y-4">
              <span className="material-symbols-outlined text-5xl text-pink-300">check_circle</span>
              <div>
                <p className="font-display font-bold text-on-surface text-lg">Pedido enviado!</p>
                <p className="text-sm text-on-surface-variant mt-1">Vamos entrar em contato para combinar os detalhes 🧶</p>
              </div>
              <button onClick={() => { setCustomOrderOpen(false); setCustomOrderSuccess(false); navigate('/meus-pedidos') }} className="w-full bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 font-bold py-2.5 rounded-xl text-sm transition-colors">
                Ver meus pedidos
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Descreva o personagem, animal ou tema. Pokémon, anime, mascote — feito à mão com amor. O preço será combinado antes da produção.
              </p>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">O que você quer? *</label>
                <textarea
                  rows={4}
                  value={customOrderDesc}
                  onChange={e => setCustomOrderDesc(e.target.value)}
                  placeholder="Ex: Pikachu segurando uma pokébola, tamanho médio, para chave de carro..."
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-pink-500/40 focus:border-pink-500/50 resize-none transition-colors"
                />
              </div>

              {(!profile?.name && !user?.displayName) && (
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">Seu nome *</label>
                  <input
                    type="text"
                    value={customOrderName}
                    onChange={e => setCustomOrderName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-pink-500/40 focus:border-pink-500/50 transition-colors"
                  />
                </div>
              )}

              {!profile?.phone && (
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">WhatsApp para contato *</label>
                  <input
                    type="tel"
                    value={customOrderPhone}
                    onChange={e => setCustomOrderPhone(e.target.value)}
                    placeholder="(41) 99999-9999"
                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-pink-500/40 focus:border-pink-500/50 transition-colors"
                  />
                </div>
              )}

              {customOrderError && (
                <p className="text-xs text-error font-semibold">{customOrderError}</p>
              )}

              <button
                onClick={submitCustomOrder}
                disabled={customOrderLoading || !customOrderDesc.trim()}
                className="w-full bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 disabled:opacity-40 disabled:cursor-not-allowed text-pink-300 font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                {customOrderLoading ? (
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">send</span>
                )}
                {customOrderLoading ? 'Enviando...' : 'Enviar pedido'}
              </button>
            </div>
          )}
        </div>
      </div>
    )}
    <div className="min-h-screen bg-background text-on-background flex flex-col">
      {/* Header — compacto, só busca + ações */}
      <header className="sticky top-0 z-50 border-b border-outline-variant bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 md:px-6 py-2.5 w-full max-w-container mx-auto">
          {/* Logo só aparece no mobile (no desktop fica na sidebar) */}
          <a href="/" className="flex items-center gap-2 lg:hidden shrink-0">
            <img src="/logo-gengar.png" alt="gengar" className="w-7 h-7 object-contain" />
            <img src="/logo-nome.png" alt="BAD TCG" className="h-5 object-contain" />
          </a>

          {/* Aviso de reestoque — só desktop */}
          <span className="hidden md:flex items-center gap-1.5 text-[11px] text-on-surface-variant shrink-0">
            <span className="material-symbols-outlined text-sm text-primary animate-spin-slow">autorenew</span>
            Reestoques semanais
          </span>

          {/* Search */}
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input
                type="text"
                placeholder="Buscar produto ou coleção..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-surface-container border-none focus:ring-1 focus:ring-primary rounded-lg pl-9 pr-4 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setOpen(true)} className="relative p-1.5 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[22px]">shopping_cart</span>
              {cartCount > 0 && (
                <span
                  key={cartCount}
                  className="absolute top-0.5 right-0.5 bg-primary text-on-primary text-[9px] font-bold px-1 py-px rounded-full leading-none animate-badge-bump"
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
            <NotificationBell />

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenu(v => !v)}
                  className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-black text-on-primary bg-primary-container"
                  title={user.displayName || user.email}
                >
                  {(profile?.photoUrl || user.photoURL) ? (
                    <img src={profile?.photoUrl || user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (user.displayName || user.email || '?').charAt(0).toUpperCase()
                  )}
                </button>
                {userMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                    <div className="absolute right-0 top-9 z-50 rounded-xl py-1 min-w-[160px] shadow-xl bg-surface-container-high border border-outline-variant">
                      <p className="px-4 py-2 text-xs font-semibold truncate text-on-surface-variant">{user.displayName || user.email}</p>
                      <hr className="border-outline-variant" />
                      <button onClick={() => { navigate('/perfil'); setUserMenu(false) }} className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors">Meu Perfil</button>
                      <button onClick={() => { navigate('/meus-pedidos'); setUserMenu(false) }} className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors">Meus Pedidos</button>
                      <button onClick={() => { logout(); setUserMenu(false) }} className="w-full text-left px-4 py-2 text-sm text-error hover:bg-surface-container transition-colors">Sair</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => navigate('/login')} className="p-1.5 text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[22px]">account_circle</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 max-w-container mx-auto px-4 md:px-6 py-6 w-full">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar */}
          <aside className="w-full lg:w-52 shrink-0 space-y-6">
            {/* Logo + nav — só desktop */}
            <div className="hidden lg:block">
              <a href="/" className="flex items-center gap-2 mb-5">
                <img src="/logo-gengar.png" alt="gengar" className="w-8 h-8 object-contain" />
                <img src="/logo-nome.png" alt="BAD TCG" className="h-6 object-contain" />
              </a>
              <nav className="flex flex-col gap-0.5">
                {[
                  { key: 'tcg',    label: 'TCG Pokémon',  icon: 'playing_cards' },
                  { key: 'croche', label: 'Crochê',       icon: 'favorite' },
                ].map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => { setActiveCategory(cat.key); setActiveSet('all'); setSearch(''); setActiveSubtypes([]) }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeCategory === cat.key ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Mobile: tabs de categoria */}
            <div className="flex lg:hidden gap-1 p-1 bg-surface-container rounded-xl">
              {[
                { key: 'tcg', label: 'TCG' },
                { key: 'croche', label: 'Crochê' },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => { setActiveCategory(cat.key); setActiveSet('all'); setSearch(''); setActiveSubtypes([]) }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${activeCategory === cat.key ? 'bg-primary-container text-white' : 'text-on-surface-variant'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Mobile: filter toggle */}
            <div className="flex lg:hidden items-center justify-between">
              <span className="text-xs text-on-surface-variant">
                {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setMobileFiltersOpen(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors px-3 py-1.5 rounded-lg border ${mobileFiltersOpen ? 'border-primary text-primary bg-primary/10' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-base">tune</span>
                Filtros
                {(activeSubtypes.length + (activeSet !== 'all' ? 1 : 0) + (showOutOfStock ? 1 : 0)) > 0 && (
                  <span className="bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {activeSubtypes.length + (activeSet !== 'all' ? 1 : 0) + (showOutOfStock ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            {/* Aviso de encomenda — só crochê */}
            {isCroche && (
              <div className="bg-surface-container rounded-xl p-3 border border-outline-variant/50 space-y-1">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Sob Encomenda</p>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Itens produzidos após o pedido. Prazo de <strong className="text-on-surface">1 a 2 dias</strong> por peça, em ordem de chegada.
                </p>
              </div>
            )}

            <div className={mobileFiltersOpen ? 'block' : 'hidden lg:block'}>
              <h3 className="font-display font-bold text-primary uppercase text-[10px] tracking-widest mb-3">
                {isCroche ? 'Tipo' : 'Coleções'}
              </h3>
              <nav className="flex flex-col gap-0.5">
                <button
                  onClick={() => setActiveSet('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-colors ${activeSet === 'all' ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                >
                  {isCroche ? 'Todos' : 'Todas as Coleções'}
                </button>
                {sets.map(set => (
                  <button
                    key={set}
                    onClick={() => setActiveSet(set)}
                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${activeSet === set ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
                  >
                    {set}
                  </button>
                ))}
                {sets.length === 0 && !loading && (
                  <p className="text-xs text-on-surface-variant px-2">Nenhum item</p>
                )}
              </nav>
            </div>

            <div className={mobileFiltersOpen ? 'block' : 'hidden lg:block'}>
              {!isCroche && (
                <>
                  <div>
                    <h3 className="font-display font-bold text-on-surface uppercase text-[10px] tracking-widest mb-3">Tipo de Produto</h3>
                    <div className="flex flex-col gap-1.5">
                      {SUBTYPES.map(s => (
                        <label key={s.key} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={activeSubtypes.includes(s.key)}
                            onChange={() => toggleSubtype(s.key)}
                            className="form-checkbox bg-surface-container border-outline-variant rounded text-primary-container focus:ring-primary-container"
                          />
                          <span className="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors">{s.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="font-display font-bold text-on-surface uppercase text-[10px] tracking-widest mb-3">Disponibilidade</h3>
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={showOutOfStock}
                        onChange={() => setShowOutOfStock(v => !v)}
                        className="form-checkbox bg-surface-container border-outline-variant rounded text-primary-container focus:ring-primary-container"
                      />
                      <span className="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors">Exibir esgotados</span>
                    </label>
                  </div>
                </>
              )}

              {(activeSubtypes.length > 0 || activeSet !== 'all' || showOutOfStock) && (
                <button
                  onClick={() => { setActiveSet('all'); setActiveSubtypes([]); setShowOutOfStock(false) }}
                  className="lg:hidden w-full text-xs text-error font-semibold flex items-center gap-1 justify-center py-2 rounded-lg hover:bg-error/10 transition-colors mt-4"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  Limpar filtros
                </button>
              )}
            </div>
          </aside>

          {/* Product area */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-surface-container-low rounded-xl h-60 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-3 opacity-40">search_off</span>
                <p className="text-sm">Nenhum produto encontrado</p>
              </div>
            ) : (
              grouped.map(({ set, items: groupItems }) => (
                <div key={set} className="mb-10">
                  <div className="flex items-baseline gap-2 mb-4 pb-2 border-b border-outline-variant">
                    <h2 className="font-display text-lg font-bold text-on-background">{set}</h2>
                    <span className="text-on-surface-variant text-xs">{groupItems.length} item{groupItems.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {groupItems.map(item => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        onCustomOrder={item.isCustomOrder ? () => {
                          if (!user) { navigate('/login'); return }
                          setCustomOrderSuccess(false)
                          setCustomOrderError('')
                          setCustomOrderOpen(true)
                        } : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-outline-variant bg-surface-container-lowest">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 px-6 md:px-16 py-10 max-w-container mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo-gengar.png" alt="logo" className="w-8 h-8 object-contain" />
              <img src="/logo-nome.png" alt="BAD TCG" className="h-6 object-contain" />
            </div>
            <p className="text-on-surface-variant text-sm max-w-xs">Catálogo online BadTCG — cards, selados e coleções Pokémon.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
            <div>
              <h4 className="font-bold text-on-surface mb-3 uppercase text-xs tracking-widest">Catálogo</h4>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li><a href="/" className="hover:text-primary transition-colors">Todos os produtos</a></li>
                <li><a href="/?type=selado" className="hover:text-primary transition-colors">Boosters & Blisters</a></li>
                <li><a href="/?type=carta" className="hover:text-primary transition-colors">Singles</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-on-surface mb-3 uppercase text-xs tracking-widest">Contato</h4>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li>
                  <button onClick={() => setShowQR(true)} className="hover:text-primary transition-colors flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#25d366]">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM11.99 0C5.373 0 0 5.373 0 11.99c0 2.117.555 4.099 1.525 5.822L0 24l6.335-1.54A11.945 11.945 0 0011.99 24C18.607 24 24 18.627 24 11.99 24 5.373 18.607 0 11.99 0z"/>
                    </svg>
                    Grupo no WhatsApp
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-outline-variant py-5 text-center">
          <p className="text-on-surface-variant text-sm">© 2025 Bad TCG. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Widget flutuante WhatsApp */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {showQR && (
          <div className="bg-surface-container-low border border-outline-variant rounded-2xl overflow-hidden shadow-2xl w-[min(16rem,calc(100vw-3rem))] animate-in fade-in slide-in-from-bottom-2">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-on-surface">Grupo BadTCG</p>
                <p className="text-xs text-on-surface-variant">Escaneie ou clique para entrar</p>
              </div>
              <button onClick={() => setShowQR(false)} className="text-on-surface-variant hover:text-on-surface p-1">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <img src="/whatsapp-qr.jpg" alt="QR Code" className="w-full" />
            <div className="px-4 pb-4 pt-2">
              <a href={WA_GROUP} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm text-white bg-[#25d366] hover:bg-[#20ba5a] transition-colors">
                <span className="material-symbols-outlined text-base">forum</span>
                Entrar no grupo
              </a>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowQR(v => !v)}
          className="w-14 h-14 rounded-full bg-[#25d366] hover:bg-[#20ba5a] shadow-lg shadow-black/40 flex items-center justify-center transition-all active:scale-95 relative"
          title="Comunidade BadTCG no WhatsApp"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M11.99 0C5.373 0 0 5.373 0 11.99c0 2.117.555 4.099 1.525 5.822L0 24l6.335-1.54A11.945 11.945 0 0011.99 24C18.607 24 24 18.627 24 11.99 24 5.373 18.607 0 11.99 0z" opacity=".5"/>
          </svg>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#25d366] animate-ping" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#25d366] border-2 border-background" />
        </button>
      </div>

    </div>

    {/* Floating cart FAB */}
    {cartCount > 0 && (
      <button
        key={`fab-${cartCount}`}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-30 flex items-center gap-2.5 bg-primary-container text-on-primary shadow-2xl rounded-full pl-4 pr-5 py-3 font-bold text-sm animate-fab-pop hover:brightness-110 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-xl animate-float">shopping_cart</span>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[11px] opacity-80">{cartCount} {cartCount === 1 ? 'item' : 'itens'}</span>
          <span className="font-black text-sm">{cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
      </button>
    )}
    </>
  )
}

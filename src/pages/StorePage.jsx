import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import ProductCard from '../components/ProductCard'
import useCartStore from '../store/useCartStore'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from '../components/NotificationBell'

const WA_GROUP = 'https://chat.whatsapp.com/LNFKF4WHzXE9hpaaycAosa'

const SUBTYPES = [
  { key: 'selado', label: 'Selado' },
  { key: 'carta', label: 'Cartas Avulsas (Singles)' },
]

function fmtBRL(val) {
  if (val == null) return 'A combinar'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function StorePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('tcg')
  const [activeSet, setActiveSet] = useState('all')
  const [activeSubtypes, setActiveSubtypes] = useState(['selado'])
  const [showOutOfStock, setShowOutOfStock] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [customOrderOpen, setCustomOrderOpen] = useState(false)
  const [customOrderItems, setCustomOrderItems] = useState([{ desc: '', imageFile: null, imagePreview: null }])
  const [customOrderName, setCustomOrderName] = useState('')
  const [customOrderPhone, setCustomOrderPhone] = useState('')
  const [customOrderLoading, setCustomOrderLoading] = useState(false)
  const [customOrderSuccess, setCustomOrderSuccess] = useState(false)
  const [customOrderError, setCustomOrderError] = useState('')

  const isCroche = activeCategory === 'croche'

  const cartItems = useCartStore(s => s.items)
  const add = useCartStore(s => s.add)
  const setOpen = useCartStore(s => s.setOpen)
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()

  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0)
  const cartTotal = cartItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  const [lightbox, setLightbox] = useState(null) // { src, alt }
  const [banners, setBanners] = useState({ tcg: {}, croche: {} })
  useEffect(() => {
    fetch('http://localhost:3001/api/store-banners')
      .then(r => r.json())
      .then(data => setBanners({ tcg: data.tcg || {}, croche: data.croche || {} }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'stock_items'))
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [])

  const categoryItems = useMemo(() =>
    items.filter(i => (i.saleCategory ?? 'tcg') === activeCategory),
    [items, activeCategory]
  )

  const heroFeatured = useMemo(() => {
    const starred = categoryItems.filter(i => i.featured === true && i.itemType !== 'insumo' && i.name)
    if (starred.length > 0) return starred.slice(0, 6)
    // fallback: most available
    return [...categoryItems]
      .sort((a, b) => {
        const aAvail = (a.available ?? 0) > 0 ? 0 : 1
        const bAvail = (b.available ?? 0) > 0 ? 0 : 1
        return aAvail !== bAvail ? aAvail - bAvail : (b.available ?? 0) - (a.available ?? 0)
      })
      .slice(0, 3)
  }, [categoryItems])

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

  function sortItems(arr) {
    if (isCroche) return [...arr].sort((a, b) => a.name.localeCompare(b.name))
    return [...arr].sort((a, b) => (b.available ?? 0) - (a.available ?? 0))
  }

  const CUSTOM_ORDER_ITEM = {
    id: 'custom-order',
    name: 'Chaveiro Personalizado',
    saleCategory: 'croche',
    isCustomOrder: true,
    available: 999,
    targetPrice: null,
  }

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
      .sort(([, aItems], [, bItems]) => {
        const aTotal = aItems.reduce((s, i) => s + (i.available ?? 0), 0)
        const bTotal = bItems.reduce((s, i) => s + (i.available ?? 0), 0)
        return bTotal - aTotal
      })
      .map(([set, items]) => ({ set, items: sortItems(items) }))

    if (isCroche) {
      if (result.length === 0) return [{ set: 'Crochê', items: [CUSTOM_ORDER_ITEM] }]
      return [{ ...result[0], items: [CUSTOM_ORDER_ITEM, ...result[0].items] }, ...result.slice(1)]
    }
    return result
  }, [filtered, activeSet, isCroche])

  function updateCustomItem(idx, field, value) {
    setCustomOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function addCustomItem() {
    setCustomOrderItems(prev => [...prev, { desc: '', imageFile: null, imagePreview: null }])
  }

  function removeCustomItem(idx) {
    setCustomOrderItems(prev => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length === 0 ? [{ desc: '', imageFile: null, imagePreview: null }] : next
    })
  }

  function handleCustomImage(idx, file) {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setCustomOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, imageFile: file, imagePreview: preview } : it))
  }

  function clearCustomImage(idx) {
    setCustomOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, imageFile: null, imagePreview: null } : it))
  }

  async function submitCustomOrder() {
    const name = customOrderName.trim() || profile?.name || user?.displayName || ''
    const phone = customOrderPhone.trim() || profile?.phone || ''
    if (!name) { setCustomOrderError('Informe seu nome'); return }
    if (!phone) { setCustomOrderError('Informe seu WhatsApp para contato'); return }
    if (customOrderItems.every(it => !it.desc.trim())) { setCustomOrderError('Descreva pelo menos um chaveiro 🧶'); return }
    if (!user) { navigate('/login'); return }

    setCustomOrderLoading(true)
    setCustomOrderError('')
    try {
      // Upload imagens para Storage
      const orderItems = await Promise.all(customOrderItems.map(async (it, idx) => {
        let imageUrl = null
        if (it.imageFile) {
          const path = `custom-orders/${user.uid}/${Date.now()}-${idx}`
          const snap = await uploadBytes(storageRef(storage, path), it.imageFile)
          imageUrl = await getDownloadURL(snap.ref)
        }
        return {
          id: 'custom-order',
          name: 'Chaveiro Personalizado',
          quantity: 1,
          unitPrice: 0,
          desc: it.desc.trim(),
          ...(imageUrl ? { imageUrl } : {}),
        }
      }))

      await addDoc(collection(db, 'orders'), {
        customerName: name,
        customerContact: phone,
        customerEmail: user.email ?? '',
        customerPhotoUrl: profile?.photoUrl || user.photoURL || '',
        uid: user.uid,
        items: orderItems,
        total: 0,
        status: 'draft',
        origem: 'badstore',
        saleCategory: 'croche',
        createdAt: serverTimestamp(),
      })
      setCustomOrderSuccess(true)
      setCustomOrderItems([{ desc: '', imageFile: null, imagePreview: null }])
    } catch (err) {
      setCustomOrderError('Erro ao enviar: ' + err.message)
    } finally {
      setCustomOrderLoading(false)
    }
  }

  // Carousel crochê — fotos dos itens de crochê com imagem
  const crocheImages = useMemo(() =>
    items.filter(i => (i.saleCategory ?? 'tcg') === 'croche' && i.imageUrl).map(i => i.imageUrl),
    [items]
  )

  const activeBanner = isCroche ? banners.croche : banners.tcg
  const heroBgGradient = isCroche
    ? 'linear-gradient(135deg,#8127cf 0%,#c0289e 100%)'
    : 'linear-gradient(135deg,#3525cd 0%,#8127cf 100%)'
  const heroStaticStyle = activeBanner?.imageUrl
    ? {
        backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.3) 100%), url(${activeBanner.imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: heroBgGradient }

  const heroTag = isCroche ? 'Feito à mão, sob encomenda' : 'Reestoques semanais · TCG Pokémon'
  const heroTitle = isCroche ? 'Peças de crochê com carinho, no seu tempo.' : 'Sua próxima carta rara está a um clique.'
  const heroSubtitle = isCroche
    ? 'Amigurumis, chaveiros e encomendas personalizadas — cada peça é única.'
    : 'Boosters, ETBs, coleções especiais e cartas avulsas — com reestoque semanal.'

  function openCustomOrderModal() {
    if (!user) { navigate('/login'); return }
    setCustomOrderSuccess(false)
    setCustomOrderError('')
    setCustomOrderItems([{ desc: '', imageFile: null, imagePreview: null }])
    setCustomOrderOpen(true)
  }

  return (
    <>
    {/* Lightbox */}
    {lightbox && createPortal(
      <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
        <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" onClick={() => setLightbox(null)}>
          <span className="material-symbols-outlined text-4xl">close</span>
        </button>
        <img src={lightbox.src} alt={lightbox.alt} className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>,
      document.body
    )}

    {/* Custom order modal */}
    {customOrderOpen && (
      <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => { setCustomOrderOpen(false); setCustomOrderSuccess(false); setCustomOrderError('') }}>
        <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl border border-outline-variant" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant" style={{ background: '#f0dbff' }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg" style={{ color: '#8127cf' }}>auto_fix_high</span>
              <h2 className="font-display font-bold text-base" style={{ color: '#6900b3' }}>Chaveiro Personalizado</h2>
            </div>
            <button onClick={() => { setCustomOrderOpen(false); setCustomOrderSuccess(false); setCustomOrderError('') }} className="transition-colors" style={{ color: '#6900b3' }}>
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {customOrderSuccess ? (
            <div className="p-6 text-center space-y-4">
              <span className="material-symbols-outlined text-5xl" style={{ color: '#8127cf' }}>check_circle</span>
              <div>
                <p className="font-display font-bold text-on-surface text-lg">Pedido enviado!</p>
                <p className="text-sm text-on-surface-variant mt-1">Vamos entrar em contato para combinar os detalhes 🧶</p>
              </div>
              <button onClick={() => { setCustomOrderOpen(false); setCustomOrderSuccess(false); navigate('/meus-pedidos') }} className="w-full font-bold py-2.5 rounded-xl text-sm transition-colors" style={{ background: '#f0dbff', color: '#6900b3', border: '1px solid #d8b4fe' }}>
                Ver meus pedidos
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Descreva o personagem, animal ou tema de cada chaveiro. Você pode anexar uma imagem de referência por item. O preço será combinado antes da produção.
              </p>

              {/* Lista de chaveiros */}
              <div className="space-y-4">
                {customOrderItems.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-outline-variant overflow-hidden" style={{ background: '#fdf8ff' }}>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/50" style={{ background: '#f0dbff' }}>
                      <span className="text-xs font-bold" style={{ color: '#6900b3' }}>Chaveiro {idx + 1}</span>
                      {customOrderItems.length > 1 && (
                        <button onClick={() => removeCustomItem(idx)} className="transition-colors" style={{ color: '#9333ea' }}>
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      )}
                    </div>
                    <div className="p-3 space-y-3">
                      <textarea
                        rows={3}
                        value={item.desc}
                        onChange={e => updateCustomItem(idx, 'desc', e.target.value)}
                        placeholder="Ex: Pikachu segurando pokébola, tamanho médio..."
                        className="w-full bg-white border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 resize-none transition-colors"
                      />

                      {/* Upload de imagem */}
                      {item.imagePreview ? (
                        <div className="relative inline-block">
                          <img src={item.imagePreview} alt="referência" className="w-20 h-20 object-cover rounded-lg border border-outline-variant" />
                          <button
                            onClick={() => clearCustomImage(idx)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center shadow"
                          >
                            <span className="material-symbols-outlined text-[12px]">close</span>
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer group w-fit">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-purple-300 text-xs font-semibold transition-colors group-hover:bg-purple-50" style={{ color: '#8127cf' }}>
                            <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
                            Adicionar referência
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => e.target.files?.[0] && handleCustomImage(idx, e.target.files[0])}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addCustomItem}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border border-dashed transition-colors hover:bg-purple-50"
                style={{ color: '#8127cf', borderColor: '#d8b4fe' }}
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Adicionar outro chaveiro
              </button>

              {(!profile?.name && !user?.displayName) && (
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">Seu nome *</label>
                  <input
                    type="text"
                    value={customOrderName}
                    onChange={e => setCustomOrderName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary/50 transition-colors"
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
                    className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary/50 transition-colors"
                  />
                </div>
              )}

              {customOrderError && (
                <p className="text-xs text-error font-semibold">{customOrderError}</p>
              )}

              <button
                onClick={submitCustomOrder}
                disabled={customOrderLoading || customOrderItems.every(it => !it.desc.trim())}
                className="w-full disabled:opacity-40 disabled:cursor-not-allowed font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[.98]"
                style={{ background: '#8127cf', color: '#fff' }}
              >
                {customOrderLoading ? (
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">send</span>
                )}
                {customOrderLoading ? 'Enviando...' : `Enviar pedido (${customOrderItems.length} chaveiro${customOrderItems.length > 1 ? 's' : ''})`}
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    <div className="min-h-screen bg-background text-on-surface flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-outline-variant" style={{ background: 'rgba(247,249,251,0.95)', backdropFilter: 'blur(10px)' }}>
        {/* Main row */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-2.5 w-full max-w-container mx-auto">
          {/* Logo in dark pill */}
          <a href="/" className="flex items-center gap-2 shrink-0 rounded-[10px] pl-1.5 pr-3 py-1.5" style={{ background: '#191c1e' }}>
            <img src="/logo-gengar.png" alt="Gengar" className="w-7 h-7 object-contain" />
            <img src="/logo-nome.png" alt="BAD TCG" className="h-4 object-contain" />
          </a>

          {/* Search */}
          <div className="flex-1 max-w-lg ml-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input
                type="text"
                placeholder="Buscar produto ou coleção..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-outline-variant rounded-lg pl-9 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setOpen(true)} className="relative p-2 text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[22px]">shopping_cart</span>
              {cartCount > 0 && (
                <span key={cartCount} className="absolute top-1 right-1 bg-primary text-on-primary text-[9px] font-bold px-1 py-px rounded-full leading-none animate-badge-bump">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
            <NotificationBell />

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenu(v => !v)}
                  className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-black ml-1"
                  style={{ background: '#e2dfff', color: '#3323cc' }}
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
                    <div className="absolute right-0 top-10 z-50 rounded-xl py-1 min-w-[160px] shadow-xl bg-white border border-outline-variant">
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
              <button onClick={() => navigate('/login')} className="p-2 text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[22px]">account_circle</span>
              </button>
            )}
          </div>
        </div>

        {/* Category tabs row */}
        <div className="flex items-center gap-1.5 px-4 md:px-6 pb-2.5 max-w-container mx-auto">
          {[
            { key: 'tcg', label: 'TCG Pokémon', icon: 'style' },
            { key: 'croche', label: 'Crochê', icon: 'favorite' },
          ].map(cat => {
            const active = activeCategory === cat.key
            const fixed = cat.key === 'tcg' ? '#e2dfff' : '#f0dbff'
            const fixedText = cat.key === 'tcg' ? '#3323cc' : '#6900b3'
            return (
              <button
                key={cat.key}
                onClick={() => { setActiveCategory(cat.key); setActiveSet('all'); setSearch(''); setActiveSubtypes(cat.key === 'tcg' ? ['selado'] : []) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                style={{ background: active ? fixed : 'transparent', color: active ? fixedText : '#777587' }}
              >
                <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                {cat.label}
              </button>
            )
          })}
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 'clamp(200px, 30vw, 280px)', ...(isCroche ? { background: heroBgGradient } : heroStaticStyle) }}>

        {/* Crochê — fita de fotos full-height */}
        {isCroche && crocheImages.length > 0 && (
          <>
            <div className="absolute inset-0 overflow-hidden flex">
              <div
                className="flex h-full"
                style={{ animation: 'marqueeLeft 36s linear infinite', width: 'max-content' }}
              >
                {[...crocheImages, ...crocheImages].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="flex-shrink-0 object-cover"
                    style={{ height: '100%', width: 220, opacity: 0.55 }}
                  />
                ))}
              </div>
            </div>
            {/* gradiente lateral + overlay de cor */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(70,0,120,0.92) 0%, rgba(70,0,120,0.5) 40%, rgba(70,0,120,0.5) 60%, rgba(70,0,120,0.92) 100%)' }} />
          </>
        )}

        <div className="relative max-w-container mx-auto px-4 md:px-6 py-6">
          {/* Title + actions */}
          <div className="flex items-start justify-between gap-5 flex-wrap mb-5">
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-2.5" style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                {heroTag}
              </span>
              <h1 className="font-display font-extrabold text-2xl text-white leading-tight mb-1.5" style={{ maxWidth: 480, textShadow: '0 2px 16px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.9)' }}>
                {heroTitle}
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.95)', maxWidth: 420, textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
                {heroSubtitle}
              </p>
            </div>
            <div className="flex gap-2.5 shrink-0 flex-wrap">
              <button
                onClick={isCroche ? openCustomOrderModal : () => document.getElementById('colecoes-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="bg-white font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer border-none"
                style={{ color: isCroche ? '#8127cf' : '#3525cd' }}
              >
                {isCroche ? 'Encomendar peça' : 'Ver coleções'}
              </button>
              <a
                href={WA_GROUP}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-xs px-4 py-2.5 rounded-lg whitespace-nowrap no-underline"
                style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
              >
                Grupo do WhatsApp
              </a>
            </div>
          </div>

          {/* Featured items */}
          {heroFeatured.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Destaques da semana
              </p>
              <div className="flex gap-3 flex-wrap">
                {heroFeatured.map(item => {
                  const stripeA = item.saleCategory === 'croche' ? '#f0dbff' : '#e2dfff'
                  const stripeB = item.saleCategory === 'croche' ? '#e6cdf7' : '#d7d2fb'
                  const accentF = item.saleCategory === 'croche' ? '#f0dbff' : '#e2dfff'
                  const accentFT = item.saleCategory === 'croche' ? '#6900b3' : '#3323cc'
                  return (
                    <div key={item.id} style={{ flex: '1 1 150px', maxWidth: 220, background: '#fff', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: 120, position: 'relative', backgroundImage: `repeating-linear-gradient(135deg,${stripeA} 0px,${stripeA} 8px,${stripeB} 8px,${stripeB} 16px)` }}>
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="absolute inset-0 w-full h-full object-contain p-2 cursor-zoom-in hover:scale-105 transition-transform duration-200 drop-shadow"
                            onClick={() => setLightbox({ src: item.imageUrl, alt: item.name })}
                          />
                        )}
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="text-[11px] font-bold text-on-surface mb-1.5 leading-tight truncate">{item.name}</p>
                        <div className="flex items-center justify-between gap-1.5">
                          {item.targetPrice != null && (
                            <span className="font-price text-[13px] font-bold text-on-surface">{fmtBRL(item.targetPrice)}</span>
                          )}
                          {(item.available ?? 0) > 0 ? (
                            <button
                              onClick={() => add({ id: item.id, name: item.name, imageUrl: item.imageUrl, unitPrice: item.targetPrice, available: item.available, saleCategory: item.saleCategory, itemSubtype: item.itemSubtype })}
                              className="flex items-center justify-center shrink-0"
                              style={{ width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', background: accentF, color: accentFT }}
                            >
                              <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const msg = `Olá! Tenho interesse em: *${item.name}*${item.setName ? ` (${item.setName})` : ''}\nMe avise quando tiver disponível! 😊`
                                window.open(`https://wa.me/5541997192058?text=${encodeURIComponent(msg)}`, '_blank')
                              }}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
                            >
                              Avisar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 max-w-container mx-auto px-4 md:px-6 py-6 w-full">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar */}
          <aside id="colecoes-sidebar" className="w-full lg:w-52 shrink-0 space-y-5">
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

            <div className={mobileFiltersOpen ? 'block' : 'hidden lg:block'}>
              <h3 className="font-display font-extrabold uppercase text-[11px] tracking-widest mb-3" style={{ color: isCroche ? '#8127cf' : '#3525cd' }}>
                {isCroche ? 'Tipo' : 'Coleções'}
              </h3>
              <nav className="flex flex-col gap-0.5 mb-5">
                <button
                  onClick={() => setActiveSet('all')}
                  className="px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-colors"
                  style={{ background: activeSet === 'all' ? (isCroche ? '#f0dbff' : '#e2dfff') : 'transparent', color: activeSet === 'all' ? (isCroche ? '#6900b3' : '#3323cc') : '#464555', fontWeight: activeSet === 'all' ? 700 : 500 }}
                >
                  {isCroche ? 'Todos' : 'Todas as coleções'}
                </button>
                {sets.map(set => (
                  <button
                    key={set}
                    onClick={() => setActiveSet(set)}
                    className="px-2.5 py-2 rounded-lg text-left text-xs transition-colors"
                    style={{ background: activeSet === set ? (isCroche ? '#f0dbff' : '#e2dfff') : 'transparent', color: activeSet === set ? (isCroche ? '#6900b3' : '#3323cc') : '#464555', fontWeight: activeSet === set ? 700 : 500 }}
                  >
                    {set}
                  </button>
                ))}
                {sets.length === 0 && !loading && (
                  <p className="text-xs text-on-surface-variant px-2">Nenhum item</p>
                )}
              </nav>

              {!isCroche && (
                <>
                  <h3 className="font-display font-extrabold text-on-surface uppercase text-[11px] tracking-widest mb-3">Tipo de Produto</h3>
                  <div className="flex flex-col gap-2 mb-5">
                    {SUBTYPES.map(s => (
                      <label key={s.key} className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={activeSubtypes.includes(s.key)}
                          onChange={() => toggleSubtype(s.key)}
                          className="form-checkbox bg-surface-container border-outline-variant rounded text-primary-container focus:ring-primary-container"
                          style={{ accentColor: '#3525cd', width: 14, height: 14 }}
                        />
                        <span className="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors">{s.label}</span>
                      </label>
                    ))}
                  </div>

                  <h3 className="font-display font-extrabold text-on-surface uppercase text-[11px] tracking-widest mb-3">Disponibilidade</h3>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={showOutOfStock}
                      onChange={() => setShowOutOfStock(v => !v)}
                      className="form-checkbox bg-surface-container border-outline-variant rounded text-primary-container focus:ring-primary-container"
                      style={{ accentColor: '#3525cd', width: 14, height: 14 }}
                    />
                    <span className="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors">Exibir esgotados</span>
                  </label>
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
            {/* Crochê banner */}
            {isCroche && (
              <div className="flex items-center gap-5 rounded-2xl px-6 py-5 mb-7 flex-wrap" style={{ background: '#f0dbff' }}>
                <span className="material-symbols-outlined text-[32px] shrink-0" style={{ color: '#8127cf' }}>auto_fix_high</span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 className="font-display font-extrabold text-base mb-1" style={{ color: '#6900b3' }}>Quer algo só seu?</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">Pokémon, animal ou personagem — feito à mão sob medida. Prazo de 1 a 2 dias por peça, preço combinado antes da produção.</p>
                </div>
                <button
                  onClick={openCustomOrderModal}
                  className="shrink-0 text-white font-bold text-xs px-4 py-2.5 rounded-lg border-none cursor-pointer hover:opacity-90 active:scale-[.98] transition-all"
                  style={{ background: '#8127cf' }}
                >
                  Encomendar peça
                </button>
              </div>
            )}

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
                  <div className="flex items-baseline gap-2 mb-4 pb-2.5 border-b border-outline-variant">
                    <h2 className="font-display text-lg font-extrabold text-on-surface">{set}</h2>
                    <span className="text-on-surface-variant text-xs">{groupItems.length} {groupItems.length !== 1 ? 'itens' : 'item'}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {groupItems.map(item => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        onCustomOrder={item.isCustomOrder ? openCustomOrderModal : undefined}
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
      <footer className="border-t border-outline-variant bg-white">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 px-6 md:px-16 py-10 max-w-container mx-auto">
          <div>
            <div className="flex items-center gap-2 rounded-[10px] pl-1.5 pr-3 py-1.5 w-fit mb-3" style={{ background: '#191c1e' }}>
              <img src="/logo-gengar.png" alt="logo" className="w-7 h-7 object-contain" />
              <img src="/logo-nome.png" alt="BAD TCG" className="h-4 object-contain" />
            </div>
            <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed">Catálogo online — cards, selados e coleções Pokémon, além de crochê feito à mão.</p>
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
          <p className="text-on-surface-variant text-sm">© 2026 Bad TCG. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* WhatsApp floating widget */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {showQR && (
          <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-2xl w-[min(16rem,calc(100vw-3rem))] animate-fade-in">
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
          className="w-14 h-14 rounded-full bg-[#25d366] hover:bg-[#20ba5a] shadow-lg flex items-center justify-center transition-all active:scale-95 relative"
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
        className="fixed bottom-6 left-6 z-30 flex items-center gap-2.5 text-on-primary shadow-2xl rounded-full pl-4 pr-5 py-3 font-bold text-sm animate-fab-pop hover:brightness-110 active:scale-95 transition-all"
        style={{ background: '#4f46e5' }}
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

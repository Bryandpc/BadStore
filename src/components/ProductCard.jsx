import { useState } from 'react'
import { createPortal } from 'react-dom'
import useCartStore from '../store/useCartStore'

const WA_NUMBER = import.meta.env.VITE_WA_NUMBER || '5541997192058'

function fmtBRL(val) {
  if (val == null) return 'A combinar'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ImageLightbox({ src, alt, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors" onClick={onClose}>
        <span className="material-symbols-outlined text-4xl">close</span>
      </button>
      <img src={src} alt={alt} className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>,
    document.body
  )
}

export default function ProductCard({ item, onCustomOrder }) {
  const add = useCartStore(s => s.add)
  const cartItems = useCartStore(s => s.items)
  const [lightbox, setLightbox] = useState(false)
  const [addedPop, setAddedPop] = useState(false)

  const isPreorder = item.saleCategory === 'croche'
  const isCustomOrder = item.isCustomOrder === true
  const inCart = cartItems.find(i => i.id === item.id)
  const canAdd = isPreorder || (item.available > 0 && (!inCart || inCart.quantity < item.available))
  const disabled = !isPreorder && item.available === 0

  const accent      = isPreorder ? '#8127cf' : '#3525cd'
  const accentFixed = isPreorder ? '#f0dbff' : '#e2dfff'
  const accentText  = isPreorder ? '#6900b3' : '#3323cc'
  const stripeClass = isPreorder ? 'stripe-croche' : 'stripe-tcg'

  const handleAdd = () => {
    const available = isPreorder ? 999 : item.available
    add({ id: item.id, name: item.name, imageUrl: item.imageUrl, unitPrice: item.targetPrice, available, saleCategory: item.saleCategory, itemSubtype: item.itemSubtype })
    setAddedPop(true)
    setTimeout(() => setAddedPop(false), 600)
  }

  if (isCustomOrder) {
    return (
      <div className="bg-white border border-outline-variant rounded-xl overflow-hidden flex flex-col hover:-translate-y-0.5 transition-all duration-200 hover:shadow-md">
        <div className="h-36 stripe-croche flex items-center justify-center relative">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-4xl" style={{ color: '#8127cf' }}>auto_fix_high</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: '#f0dbff', color: '#6900b3' }}>Personalizado</span>
          </div>
        </div>
        <div className="p-3 flex-1 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#8127cf' }}>Crochê · Encomenda</p>
          <h3 className="font-display font-bold text-on-surface text-sm leading-snug mb-1">Chaveiro Personalizado</h3>
          <p className="text-[10px] text-on-surface-variant leading-relaxed flex-1">Pokémon, animal ou personagem — feito à mão sob medida 🧶</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-price text-sm font-bold text-on-surface">A combinar</span>
            <button
              onClick={() => onCustomOrder?.()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors hover:opacity-80"
              style={{ background: '#f0dbff', color: '#6900b3', border: '1px solid #d8b4fe' }}
            >
              <span className="material-symbols-outlined text-sm">edit_note</span>
              Solicitar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    {lightbox && item.imageUrl && (
      <ImageLightbox src={item.imageUrl} alt={item.name} onClose={() => setLightbox(false)} />
    )}
    <div className={`bg-white border border-outline-variant rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${disabled ? 'opacity-55' : ''}`}>
      {/* Imagem / stripe */}
      <div className={`relative h-36 flex items-center justify-center ${!item.imageUrl ? stripeClass : 'bg-surface-container-low'}`}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="max-h-full object-contain cursor-zoom-in hover:scale-105 transition-transform duration-300 drop-shadow"
            loading="lazy"
            onClick={() => setLightbox(true)}
          />
        ) : isPreorder ? (
          <div className="flex flex-col items-center gap-1 select-none">
            <span className="text-3xl">🧶</span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#8127cf' }}>Em confecção</span>
          </div>
        ) : (
          <span className="material-symbols-outlined text-3xl text-on-surface-variant opacity-30">image</span>
        )}

        {/* Badge */}
        {isPreorder ? (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#f0dbff', color: '#6900b3' }}>Sob encomenda</span>
        ) : item.available === 0 ? (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">Esgotado</span>
        ) : item.available <= 3 ? (
          <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>Últimas {item.available}!</span>
        ) : null}

        {inCart && (
          <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: '#3525cd' }}>{inCart.quantity} no carrinho</span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        {item.setName && (
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>
            {item.setName} · {item.itemSubtype ?? 'produto'}
          </p>
        )}
        <h3 className="font-display font-bold text-on-surface text-sm line-clamp-2 leading-snug flex-1 mb-1">{item.name}</h3>
        {item.cardCondition && (
          <p className="text-[10px] text-on-surface-variant mb-1">{item.cardCondition}{item.cardLanguage ? ` · ${item.cardLanguage}` : ''}</p>
        )}
        <p className="text-[10px] mb-2" style={{ color: isPreorder ? '#8127cf' : item.available > 0 ? '#3525cd' : '#777587', fontWeight: 600 }}>
          {isPreorder ? '1–2 dias p/ produção' : item.available > 0 ? `${item.available} em estoque` : 'Esgotado'}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="font-price text-base font-bold text-on-surface">{fmtBRL(item.targetPrice)}</span>
          {disabled ? (
            <button
              onClick={() => {
                const msg = `Olá! Tenho interesse em: *${item.name}*${item.setName ? ` (${item.setName})` : ''}\nMe avise quando tiver disponível! 😊`
                window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
              }}
              className="text-[10px] font-bold px-2 py-1 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Avisar
            </button>
          ) : (
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-90"
              style={{ background: addedPop ? accent : accentFixed, color: addedPop ? '#fff' : accentText }}
            >
              <span className="material-symbols-outlined text-base">
                {addedPop ? 'check' : 'add_shopping_cart'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

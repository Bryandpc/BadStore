import { useState } from 'react'
import { createPortal } from 'react-dom'
import useCartStore from '../store/useCartStore'

const WA_NUMBER = import.meta.env.VITE_WA_NUMBER || '5541997192058'

function fmtBRL(val) {
  if (val == null) return '—'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ImageLightbox({ src, alt, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        onClick={onClose}
      >
        <span className="material-symbols-outlined text-4xl">close</span>
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}

export default function ProductCard({ item, onCustomOrder }) {
  const add = useCartStore(s => s.add)
  const cartItems = useCartStore(s => s.items)
  const [lightbox, setLightbox] = useState(false)
  const [addedPop, setAddedPop] = useState(false)
  const [cardFlash, setCardFlash] = useState(false)

  const isPreorder = item.saleCategory === 'croche'
  const isCustomOrder = item.isCustomOrder === true
  const inCart = cartItems.find(i => i.id === item.id)
  const canAdd = isPreorder || (item.available > 0 && (!inCart || inCart.quantity < item.available))

  const handleAdd = () => {
    // crochê: available fictício alto para não bloquear quantidade
    const available = isPreorder ? 999 : item.available
    add({ id: item.id, name: item.name, imageUrl: item.imageUrl, unitPrice: item.targetPrice, available, saleCategory: item.saleCategory, itemSubtype: item.itemSubtype })
    setAddedPop(true)
    setCardFlash(true)
    setTimeout(() => setAddedPop(false), 600)
    setTimeout(() => setCardFlash(false), 500)
  }

  if (isCustomOrder) {
    return (
      <div className="group bg-surface-container-low rounded-xl overflow-hidden flex flex-col border border-pink-500/30 hover:border-pink-500/60 hover:-translate-y-0.5 transition-all duration-300 glow-hover">
        {/* Image area */}
        <div
          className="relative h-44 flex items-center justify-center p-4"
          style={{ background: 'radial-gradient(ellipse at center, rgba(236,72,153,0.12) 0%, transparent 70%)' }}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="material-symbols-outlined text-5xl text-pink-300 opacity-80 group-hover:scale-110 transition-transform duration-500">
              auto_fix_high
            </span>
            <span className="text-[10px] font-bold text-pink-300 uppercase tracking-wider bg-pink-500/20 border border-pink-500/30 px-2 py-0.5 rounded">
              Personalizado
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 flex-1 flex flex-col">
          <p className="text-[9px] font-bold uppercase mb-1 tracking-wider text-pink-300">
            Crochê / Encomenda
          </p>
          <h3 className="font-display font-bold text-on-surface text-sm leading-snug mb-1">
            Chaveiro Personalizado
          </h3>
          <p className="text-[10px] text-on-surface-variant leading-relaxed flex-1">
            Pokémon, animal, personagem ou o que você quiser — feito à mão com amor 🧶
          </p>
          <div className="mt-3 flex justify-between items-center gap-2">
            <span className="font-price text-sm font-bold text-pink-300">A combinar</span>
            <button
              onClick={() => onCustomOrder?.()}
              className="bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 transition-colors px-2 py-1.5 rounded-lg text-pink-300 text-[10px] font-bold active:scale-95 whitespace-nowrap flex items-center gap-1"
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
    <div className={`group bg-surface-container-low rounded-xl overflow-hidden transition-all duration-300 flex flex-col border border-transparent hover:border-outline-variant hover:-translate-y-0.5 ${isPreorder || item.available > 0 ? 'glow-hover' : 'opacity-60'} ${cardFlash ? 'animate-card-flash' : ''}`}>
      {/* Image */}
      <div
        className="relative h-44 overflow-hidden bg-surface-container flex items-center justify-center p-3 ring-1 ring-inset ring-white/10"
        style={{ background: isPreorder
          ? 'radial-gradient(ellipse at center, rgba(236,72,153,0.07) 0%, transparent 70%)'
          : 'radial-gradient(ellipse at center, rgba(124,58,237,0.08) 0%, transparent 70%)' }}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="max-h-full object-contain group-hover:scale-110 transition-transform duration-500 cursor-zoom-in drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
            loading="lazy"
            onClick={() => setLightbox(true)}
          />
        ) : isPreorder ? (
          <div className="flex flex-col items-center gap-1.5 select-none">
            <span className="text-4xl group-hover:scale-110 transition-transform duration-500">🧶</span>
            <span className="text-[10px] font-bold text-pink-300/70 uppercase tracking-wider">Em confecção</span>
          </div>
        ) : (
          <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-30">image</span>
        )}
        {isPreorder ? (
          <div className="absolute top-2 right-2 bg-pink-500/20 text-pink-300 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg border border-pink-500/30">
            Sob encomenda
          </div>
        ) : item.available === 0 ? (
          <div className="absolute top-2 right-2 bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg border border-outline-variant">
            Esgotado
          </div>
        ) : item.available <= 3 && (
          <div className="absolute top-2 right-2 bg-tertiary-container text-on-tertiary-container text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
            Últimas {item.available}!
          </div>
        )}
        {inCart && (
          <div className="absolute top-2 left-2 bg-primary-container text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg">
            {inCart.quantity} no carrinho
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        {item.setName && (
          <p className={`text-[9px] font-bold uppercase mb-1 tracking-wider ${isPreorder ? 'text-pink-300' : 'text-primary'}`}>
            {item.setName} / {item.itemSubtype ?? 'produto'}
          </p>
        )}
        <h3 className="font-display font-bold text-on-surface text-sm line-clamp-2 mb-2 leading-snug flex-1">{item.name}</h3>
        {item.cardCondition && (
          <p className="text-[10px] text-on-surface-variant mb-1">{item.cardCondition}{item.cardLanguage ? ` · ${item.cardLanguage}` : ''}</p>
        )}
        <p className="text-[10px] mb-1.5">
          {isPreorder
            ? <span className="text-pink-300 font-semibold">1–2 dias p/ produção</span>
            : item.available > 0
              ? <span className="text-primary font-semibold">{item.available} em estoque</span>
              : <span className="text-on-surface-variant">Esgotado</span>
          }
        </p>
        <div className="mt-auto flex justify-between items-center gap-2">
          <span className={`font-price text-lg font-bold ${!isPreorder && item.available === 0 ? 'text-on-surface-variant' : 'text-on-surface'}`}>
            {fmtBRL(item.targetPrice)}
          </span>
          {!isPreorder && item.available === 0 ? (
            <button
              onClick={() => {
                const msg = `Olá! Tenho interesse em: *${item.name}*${item.setName ? ` (${item.setName})` : ''}\nMe avise quando tiver disponível! 😊`
                window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank')
              }}
              className="bg-surface-container hover:bg-surface-container-high transition-colors px-2 py-1 rounded-lg text-on-surface-variant text-[10px] font-bold active:scale-95 whitespace-nowrap border border-outline-variant"
            >
              Anotar interesse
            </button>
          ) : (
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className={`transition-all duration-150 p-1.5 rounded-lg text-on-primary-container disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 ${addedPop ? 'bg-primary-container scale-110 animate-pop-in' : 'bg-secondary-container hover:bg-primary-container hover:scale-110'}`}
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

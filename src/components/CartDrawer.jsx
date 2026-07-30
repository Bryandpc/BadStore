import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useCartStore from '../store/useCartStore'

function fmtBRL(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function CartDrawer() {
  const items = useCartStore(s => s.items)
  const open = useCartStore(s => s.open)
  const setOpen = useCartStore(s => s.setOpen)
  const remove = useCartStore(s => s.remove)
  const setQty = useCartStore(s => s.setQty)
  const conflict = useCartStore(s => s.conflict)
  const clearConflict = useCartStore(s => s.clearConflict)
  const navigate = useNavigate()

  // controla montagem pra não renderizar no SSR/initial mas animar na saída
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // dois RAFs: primeiro pinta com translate-x-full, segundo dispara a transição
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 280)
      return () => clearTimeout(t)
    }
  }, [open])

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  if (!mounted) return null

  return (
    <div
      className={`fixed inset-0 z-[60] transition-colors duration-300 ${visible ? 'bg-background/75 backdrop-blur-sm' : 'bg-transparent pointer-events-none'}`}
      onClick={() => setOpen(false)}
    >
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-surface-container-low shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-outline-variant flex justify-between items-center">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">shopping_cart</span>
            Meu Carrinho
            {items.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={items[0].saleCategory === 'croche'
                  ? { background: '#f0dbff', color: '#6900b3' }
                  : { background: '#e2dfff', color: '#3323cc' }}>
                {items[0].saleCategory === 'croche' ? '🧶 Crochê' : '⚡ TCG'}
              </span>
            )}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-on-surface-variant hover:text-primary hover:rotate-90 transition-all duration-200"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {conflict && (
          <div className="mx-4 mt-3 px-3 py-2.5 rounded-lg flex items-start gap-2 text-xs"
            style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
            <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1">
              <p className="font-bold text-amber-800">
                Carrinho é exclusivo para {conflict.currentCat === 'croche' ? 'Crochê 🧶' : 'TCG ⚡'}
              </p>
              <p className="text-amber-700 mt-0.5">
                Finalize ou esvazie o carrinho antes de adicionar {conflict.triedCat === 'croche' ? 'itens de Crochê' : 'cards TCG'}.
              </p>
            </div>
            <button onClick={clearConflict} className="text-amber-500 hover:text-amber-700 flex-shrink-0">✕</button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant gap-4">
            <span className="material-symbols-outlined text-5xl opacity-30">shopping_cart</span>
            <p className="text-sm">Seu carrinho está vazio</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex gap-4 items-start pb-6 border-b border-outline-variant/30 last:border-0 last:pb-0 animate-fade-in"
                  style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }}
                >
                  <div
                    className="w-16 h-16 shrink-0 rounded-lg overflow-hidden flex items-center justify-center relative"
                    style={{
                      backgroundImage: item.saleCategory === 'croche'
                        ? 'repeating-linear-gradient(135deg,#f0dbff 0px,#f0dbff 8px,#e6cdf7 8px,#e6cdf7 16px)'
                        : 'repeating-linear-gradient(135deg,#e2dfff 0px,#e2dfff 8px,#d7d2fb 8px,#d7d2fb 16px)'
                    }}
                  >
                    {(item.imagePreview || item.imageUrl) && (
                      <img src={item.imagePreview || item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    {item.isCustomOrder && !(item.imagePreview || item.imageUrl) && (
                      <span className="material-symbols-outlined text-2xl" style={{ color: '#8127cf' }}>auto_fix_high</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold leading-tight mb-0.5 truncate">{item.name}</h4>
                    {item.desc && (
                      <p className="text-xs text-on-surface-variant italic mb-1 line-clamp-2">"{item.desc}"</p>
                    )}
                    <p className="text-primary font-price text-lg mb-2">
                      {item.unitPrice > 0 ? fmtBRL(item.unitPrice) : 'A combinar'}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => item.quantity > 1 ? setQty(item.id, item.quantity - 1) : remove(item.id)}
                        className="w-9 h-9 border border-outline-variant rounded flex items-center justify-center text-sm hover:border-primary hover:text-primary active:scale-90 transition-all"
                      >-</button>
                      <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.id, item.quantity + 1)}
                        disabled={item.isCustomOrder || item.quantity >= item.available}
                        className="w-9 h-9 border border-outline-variant rounded flex items-center justify-center text-sm hover:border-primary hover:text-primary active:scale-90 transition-all disabled:opacity-30"
                      >+</button>
                      <button
                        onClick={() => remove(item.id)}
                        className="ml-2 p-2 text-on-surface-variant hover:text-error active:scale-90 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 sm:p-6 border-t border-outline-variant bg-surface-container">
              <div className="flex justify-between items-center mb-5">
                <span className="text-on-surface-variant font-medium">Total</span>
                <span className="text-2xl sm:text-3xl font-price font-bold text-on-surface">{fmtBRL(total)}</span>
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/checkout') }}
                className="w-full action-gradient text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                Finalizar Pedido
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-full mt-4 text-on-surface-variant hover:text-on-surface transition-colors text-sm font-medium"
              >
                Continuar Comprando
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

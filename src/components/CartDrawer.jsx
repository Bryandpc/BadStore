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
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-on-surface-variant hover:text-primary hover:rotate-90 transition-all duration-200"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

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
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-surface-container rounded-lg p-2 shrink-0 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="material-symbols-outlined text-on-surface-variant opacity-30">image</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold leading-tight mb-1 truncate">{item.name}</h4>
                    <p className="text-primary font-price text-lg mb-2">{fmtBRL(item.unitPrice)}</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => item.quantity > 1 ? setQty(item.id, item.quantity - 1) : remove(item.id)}
                        className="w-7 h-7 border border-outline-variant rounded flex items-center justify-center text-xs hover:border-primary hover:text-primary active:scale-90 transition-all"
                      >-</button>
                      <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.available}
                        className="w-7 h-7 border border-outline-variant rounded flex items-center justify-center text-xs hover:border-primary hover:text-primary active:scale-90 transition-all disabled:opacity-30"
                      >+</button>
                      <button
                        onClick={() => remove(item.id)}
                        className="ml-2 text-on-surface-variant hover:text-error active:scale-90 transition-all"
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
                className="w-full bg-primary-container text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:scale-[1.02] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
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

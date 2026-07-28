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

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] transition-opacity" onClick={() => setOpen(false)}>
      <div
        className="absolute right-0 top-0 h-full w-full max-w-md bg-surface-container-low shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ transition: 'transform 0.3s ease-in-out' }}
      >
        {/* Header */}
        <div className="p-6 border-b border-outline-variant flex justify-between items-center">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">shopping_cart</span>
            Meu Carrinho
          </h2>
          <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-primary transition-colors">
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {items.map(item => (
                <div key={item.id} className="flex gap-4 items-start pb-6 border-b border-outline-variant/30 last:border-0 last:pb-0">
                  <div className="w-20 h-20 bg-surface-container rounded-lg p-2 shrink-0 flex items-center justify-center">
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
                        className="w-7 h-7 border border-outline-variant rounded flex items-center justify-center text-xs hover:border-primary transition-colors"
                      >-</button>
                      <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.available}
                        className="w-7 h-7 border border-outline-variant rounded flex items-center justify-center text-xs hover:border-primary transition-colors disabled:opacity-30"
                      >+</button>
                      <button onClick={() => remove(item.id)} className="ml-2 text-on-surface-variant hover:text-error transition-colors">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-outline-variant bg-surface-container">
              <div className="flex justify-between items-center mb-5">
                <span className="text-on-surface-variant font-medium">Total</span>
                <span className="text-3xl font-price font-bold text-on-surface">{fmtBRL(total)}</span>
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/checkout') }}
                className="w-full bg-primary-container text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                Finalizar Pedido
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button onClick={() => setOpen(false)} className="w-full mt-4 text-on-surface-variant hover:text-on-surface transition-colors text-sm font-medium">
                Continuar Comprando
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

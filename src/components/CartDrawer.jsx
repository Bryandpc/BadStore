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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="brand-gradient px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Carrinho
            {items.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </h2>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <path d="M3 6h18M16 10a4 4 0 01-8 0"/>
            </svg>
            <p className="text-sm">Seu carrinho está vazio</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 hide-scrollbar">
              {items.map(item => (
                <div key={item.id} className="flex gap-3 items-center py-2 border-b border-gray-50 last:border-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-12 h-12 object-contain rounded-xl bg-gray-50 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs font-bold" style={{ color: '#3525cd' }}>{fmtBRL(item.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => item.quantity > 1 ? setQty(item.id, item.quantity - 1) : remove(item.id)}
                      className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold transition-colors"
                    >−</button>
                    <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => setQty(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.available}
                      className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 text-sm font-bold disabled:opacity-30 transition-colors"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 font-medium">Total</span>
                <span className="text-2xl font-black text-gray-900">{fmtBRL(total)}</span>
              </div>
              <button
                onClick={() => { setOpen(false); navigate('/checkout') }}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm active:scale-[.98] transition-all brand-gradient shadow-lg"
              >
                Finalizar Pedido →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

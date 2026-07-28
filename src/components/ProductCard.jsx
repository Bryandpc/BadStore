import useCartStore from '../store/useCartStore'

function fmtBRL(val) {
  if (val == null) return '—'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ProductCard({ item }) {
  const add = useCartStore(s => s.add)
  const cartItems = useCartStore(s => s.items)
  const setOpen = useCartStore(s => s.setOpen)

  const inCart = cartItems.find(i => i.id === item.id)
  const canAdd = item.available > 0 && (!inCart || inCart.quantity < item.available)

  const handleAdd = () => {
    add({ id: item.id, name: item.name, imageUrl: item.imageUrl, unitPrice: item.targetPrice, available: item.available, saleCategory: item.saleCategory, itemSubtype: item.itemSubtype })
    setOpen(true)
  }

  return (
    <div className="group bg-surface-container-low rounded-xl overflow-hidden glow-hover transition-all duration-300 flex flex-col border border-transparent hover:border-outline-variant">
      {/* Image */}
      <div className="relative h-64 overflow-hidden bg-surface-container flex items-center justify-center p-6">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="max-h-full object-contain group-hover:scale-110 transition-transform duration-500" loading="lazy" />
        ) : (
          <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30">image</span>
        )}
        {item.available <= 3 && (
          <div className="absolute top-3 right-3 bg-tertiary-container text-on-tertiary-container text-xs font-bold px-2 py-1 rounded shadow-lg">
            Últimas {item.available}!
          </div>
        )}
        {inCart && (
          <div className="absolute top-3 left-3 bg-primary-container text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
            {inCart.quantity} no carrinho
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5 flex-1 flex flex-col">
        {item.setName && (
          <p className="text-primary text-[10px] font-bold uppercase mb-2 tracking-wider">{item.setName} / {item.itemSubtype ?? 'produto'}</p>
        )}
        <h3 className="font-display font-bold text-on-surface line-clamp-2 mb-4 leading-tight flex-1">{item.name}</h3>
        {item.cardCondition && (
          <p className="text-xs text-on-surface-variant mb-2">{item.cardCondition}{item.cardLanguage ? ` · ${item.cardLanguage}` : ''}</p>
        )}
        <div className="mt-auto flex justify-between items-center gap-3">
          {/* Price with R$ emblem */}
          <div className="flex items-center gap-2">
            <img src="/preco.png" alt="" className="w-7 h-7 object-contain opacity-80" />
            <span className="font-price text-2xl font-bold text-on-surface">{fmtBRL(item.targetPrice)}</span>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="bg-secondary-container hover:bg-primary-container transition-colors p-2 rounded-lg text-on-primary-container disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
          </button>
        </div>
      </div>
    </div>
  )
}

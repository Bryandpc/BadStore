import useCartStore from '../store/useCartStore'

function fmtBRL(val) {
  if (val == null) return '—'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const CATEGORY_LABEL = {
  tcg: 'TCG',
  croche: 'Crochê',
}

const SUBTYPE_LABEL = {
  selado: 'Selado',
  carta: 'Carta',
  avulso: 'Avulso',
}

export default function ProductCard({ item }) {
  const add = useCartStore(s => s.add)
  const cartItems = useCartStore(s => s.items)
  const setOpen = useCartStore(s => s.setOpen)

  const inCart = cartItems.find(i => i.id === item.id)
  const canAdd = item.available > 0 && (!inCart || inCart.quantity < item.available)

  const handleAdd = () => {
    add({
      id: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      unitPrice: item.targetPrice,
      available: item.available,
      saleCategory: item.saleCategory,
      itemSubtype: item.itemSubtype,
    })
    setOpen(true)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Imagem */}
      <div className="relative aspect-square bg-gray-50">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-contain p-3"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-1.1 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </div>
        )}
        {item.available <= 3 && item.available > 0 && (
          <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
            Últimas {item.available}!
          </span>
        )}
        {item.available === 0 && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-400">Esgotado</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <div className="flex gap-1 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(53,37,205,0.08)', color: '#3525cd' }}>
            {CATEGORY_LABEL[item.saleCategory] ?? item.saleCategory}
          </span>
          {item.itemSubtype && item.itemSubtype !== 'selado' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              {SUBTYPE_LABEL[item.itemSubtype] ?? item.itemSubtype}
            </span>
          )}
          {item.cardCondition && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              {item.cardCondition}
            </span>
          )}
        </div>

        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">
          {item.name}
        </p>
        {item.setName && (
          <p className="text-[11px] text-gray-400">{item.setName}</p>
        )}

        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <span className="text-lg font-black" style={{ color: '#3525cd' }}>
            {fmtBRL(item.targetPrice)}
          </span>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 text-white"
            style={{ background: canAdd ? 'linear-gradient(135deg, #3525cd 0%, #8127cf 100%)' : '#9ca3af' }}
          >
            {inCart ? `+1 (${inCart.quantity})` : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

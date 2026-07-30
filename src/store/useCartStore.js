import { create } from 'zustand'

const useCartStore = create((set, get) => ({
  items: [], // { id, name, imageUrl, imagePreview, imageFile, unitPrice, quantity, available, saleCategory, isCustomOrder, desc }
  open: false,
  conflict: null, // { currentCat, triedCat } — set quando tenta misturar categorias

  // Regular items: merge quantity if same id
  add: (product) => {
    const state = get()
    const currentCat = state.items.length > 0 ? (state.items[0].saleCategory ?? 'tcg') : null
    const newCat = product.saleCategory ?? 'tcg'
    if (currentCat && currentCat !== newCat) {
      set({ conflict: { currentCat, triedCat: newCat } })
      return
    }
    set((state) => {
      const existing = state.items.find(i => i.id === product.id)
      if (existing) {
        if (existing.quantity >= product.available) return state
        return { items: state.items.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { items: [...state.items, { ...product, quantity: 1 }] }
    })
  },

  // Custom items: always create a new unique entry (desc/image differ per unit)
  addCustom: (product) => {
    const state = get()
    const currentCat = state.items.length > 0 ? (state.items[0].saleCategory ?? 'tcg') : null
    const newCat = product.saleCategory ?? 'croche'
    if (currentCat && currentCat !== newCat) {
      set({ conflict: { currentCat, triedCat: newCat } })
      return
    }
    const cartId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    set((state) => ({
      items: [...state.items, { ...product, id: cartId, quantity: 1 }],
    }))
  },

  clearConflict: () => set({ conflict: null }),

  remove: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),

  setQty: (id, qty) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i),
  })),

  clear: () => set({ items: [] }),

  toggleOpen: () => set((state) => ({ open: !state.open })),
  setOpen: (v) => set({ open: v }),

  get total() {
    return get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  },

  get count() {
    return get().items.reduce((s, i) => s + i.quantity, 0)
  },
}))

export default useCartStore

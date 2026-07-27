import { create } from 'zustand'

const useCartStore = create((set, get) => ({
  items: [], // { id, name, imageUrl, unitPrice, quantity, available, saleCategory, itemSubtype }
  open: false,

  add: (product) => {
    set((state) => {
      const existing = state.items.find(i => i.id === product.id)
      if (existing) {
        if (existing.quantity >= product.available) return state
        return { items: state.items.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) }
      }
      return { items: [...state.items, { ...product, quantity: 1 }] }
    })
  },

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

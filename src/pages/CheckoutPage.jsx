import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import useCartStore from '../store/useCartStore'
import { useAuth } from '../contexts/AuthContext'

const WA_NUMBER = import.meta.env.VITE_WA_NUMBER || '5541997192058'

function fmtBRL(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildWaMessage(items, total, name, contact, orderId) {
  const lines = items
    .map(i => `• ${i.quantity}x ${i.name} — ${fmtBRL(i.unitPrice * i.quantity)}`)
    .join('\n')

  return (
    `Olá! Gostaria de fazer um pedido 🛒\n\n` +
    `${lines}\n\n` +
    `Total: ${fmtBRL(total)}\n` +
    `Nome: ${name}\n` +
    `Contato: ${contact}\n\n` +
    `Pedido #${orderId.slice(-6).toUpperCase()}`
  )
}

export default function CheckoutPage() {
  const items = useCartStore(s => s.items)
  const clear = useCartStore(s => s.clear)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Redireciona para login se não estiver autenticado
  useEffect(() => {
    if (user === null) navigate('/login?next=/checkout', { replace: true })
  }, [user, navigate])

  // Pré-preenche nome com o do Google/cadastro
  useEffect(() => {
    if (user?.displayName && !name) setName(user.displayName)
  }, [user])

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  if (user === undefined) return null // carregando auth

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-on-surface-variant">
        <span className="material-symbols-outlined text-5xl opacity-40">shopping_cart</span>
        <p className="text-sm">Seu carrinho está vazio.</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2 rounded-lg text-on-primary text-sm font-bold bg-primary-container hover:opacity-90 transition-opacity"
        >
          Ver produtos
        </button>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !contact.trim()) { setError('Preencha seu nome e contato'); return }
    setSubmitting(true)
    setError(null)
    try {
      const docRef = await addDoc(collection(db, 'orders'), {
        customerName: name.trim(),
        customerContact: contact.trim(),
        customerEmail: user?.email ?? null,
        uid: user?.uid ?? null,
        items: items.map(i => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        total,
        status: 'pendente',
        createdAt: serverTimestamp(),
      })

      const msg = buildWaMessage(items, total, name.trim(), contact.trim(), docRef.id)
      const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`

      clear()
      window.open(url, '_blank')
      navigate('/?pedido=ok')
    } catch (err) {
      setError('Erro ao registrar pedido. Tente novamente.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-outline-variant bg-background/95 backdrop-blur-md shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <img src="/logo-gengar.png" alt="logo" className="w-9 h-9 object-contain" />
          <img src="/logo-nome.png" alt="BAD TCG" className="h-7 object-contain" />
          <h1 className="text-base font-display font-bold text-on-surface">Finalizar Pedido</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Resumo */}
        <div className="bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Resumo do pedido</p>
          </div>
          <div className="divide-y divide-outline-variant/30">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-contain bg-surface-container flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-surface-container flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{item.name}</p>
                  <p className="text-xs text-on-surface-variant">{item.quantity}x {fmtBRL(item.unitPrice)}</p>
                </div>
                <p className="text-sm font-bold text-on-surface flex-shrink-0">{fmtBRL(item.unitPrice * item.quantity)}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant bg-surface-container">
            <span className="text-sm font-semibold text-primary">Total</span>
            <span className="text-2xl font-price font-black text-on-surface">{fmtBRL(total)}</span>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-surface-container-low rounded-xl border border-outline-variant p-5 space-y-4">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Seus dados</p>

          <div>
            <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">Nome *</label>
            <input
              type="text"
              placeholder="Como você se chama?"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition placeholder:text-on-surface-variant/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">WhatsApp ou @instagram *</label>
            <input
              type="text"
              placeholder="(41) 99999-9999 ou @usuario"
              value={contact}
              onChange={e => setContact(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition placeholder:text-on-surface-variant/50"
            />
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting || !name.trim() || !contact.trim()}
              className="w-full py-3.5 rounded-lg font-bold text-sm active:scale-[.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg text-white bg-[#25d366] hover:bg-[#20ba5a]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M11.99 0C5.373 0 0 5.373 0 11.99c0 2.117.555 4.099 1.525 5.822L0 24l6.335-1.54A11.945 11.945 0 0011.99 24C18.607 24 24 18.627 24 11.99 24 5.373 18.607 0 11.99 0z" opacity=".5"/>
              </svg>
              {submitting ? 'Registrando...' : 'Enviar pedido pelo WhatsApp'}
            </button>
            <p className="text-[11px] text-on-surface-variant text-center mt-2">
              Seu pedido será registrado e você será redirecionado para o WhatsApp para confirmar.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

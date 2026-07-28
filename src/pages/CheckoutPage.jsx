import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import useCartStore from '../store/useCartStore'
import { useAuth } from '../contexts/AuthContext'

const WA_NUMBER = import.meta.env.VITE_WA_NUMBER || '5541997192058'
const RATE_LIMIT_MINUTES = 3

function fmtBRL(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Detecta se é telefone ou @handle
function detectContactType(value) {
  if (value.startsWith('@')) return 'instagram'
  const digits = value.replace(/\D/g, '')
  if (digits.length > 0) return 'phone'
  return null
}

// Auto-formata número BR: (XX) XXXXX-XXXX
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// Valida: telefone BR (10–11 dígitos) ou @handle (1–30 chars válidos)
function validateContact(value) {
  const v = value.trim()
  if (!v) return { valid: false, msg: 'Preencha seu WhatsApp ou @instagram.' }

  if (v.startsWith('@')) {
    if (!/^@[a-zA-Z0-9._]{1,30}$/.test(v))
      return { valid: false, msg: 'Handle inválido. Use @usuario com letras, números, . ou _' }
    return { valid: true, msg: null }
  }

  const digits = v.replace(/\D/g, '')
  if (digits.length < 10)
    return { valid: false, msg: 'Número incompleto. Informe DDD + número.' }
  if (digits.length > 11)
    return { valid: false, msg: 'Número muito longo. Verifique o formato.' }
  return { valid: true, msg: null }
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
  const [contactError, setContactError] = useState(null)
  const [contactTouched, setContactTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user === null) navigate('/login?next=/checkout', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (user?.displayName && !name) setName(user.displayName)
  }, [user])

  // Valida contato em tempo real após primeiro blur
  useEffect(() => {
    if (!contactTouched) return
    const { msg } = validateContact(contact)
    setContactError(msg)
  }, [contact, contactTouched])

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const contactType = detectContactType(contact)
  const contactValidation = validateContact(contact)
  const canSubmit = name.trim() && contactValidation.valid && !submitting

  const handleContactChange = (e) => {
    const raw = e.target.value
    // Se começa com @ ou vazio, mantém como texto livre (Instagram)
    if (raw.startsWith('@') || raw === '') {
      setContact(raw)
    } else {
      // Tenta formatar como telefone
      setContact(formatPhone(raw))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setContactTouched(true)
    const validation = validateContact(contact)
    if (!name.trim()) { setError('Preencha seu nome.'); return }
    if (!validation.valid) { setContactError(validation.msg); return }

    setSubmitting(true)
    setError(null)
    try {
      // Rate limit via localStorage — evita duplo envio sem precisar de índice Firestore
      const rlKey = `rl_order_${user.uid}`
      const lastTs = parseInt(localStorage.getItem(rlKey) || '0')
      const elapsed = Date.now() - lastTs
      if (elapsed < RATE_LIMIT_MINUTES * 60 * 1000) {
        const waitSecs = Math.ceil((RATE_LIMIT_MINUTES * 60 * 1000 - elapsed) / 1000)
        setError(`Aguarde ${waitSecs}s antes de enviar outro pedido.`)
        setSubmitting(false)
        return
      }

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
        status: 'draft',
        origem: 'badstore',
        createdAt: serverTimestamp(),
      })

      localStorage.setItem(rlKey, Date.now().toString())

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

  if (user === undefined) return null

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

  return (
    <div className="min-h-screen bg-background text-on-background">
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
        {items.some(i => i.saleCategory === 'croche') && (
          <div className="flex gap-3 bg-pink-500/10 border border-pink-500/30 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-pink-300 text-xl shrink-0">schedule</span>
            <div>
              <p className="text-sm font-bold text-pink-300">Itens sob encomenda</p>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                Seu pedido inclui peças de crochê produzidas após confirmação. Prazo de <strong className="text-on-surface">1 a 2 dias por peça</strong>, em ordem de chegada dos pedidos. Assim que confirmarmos, entramos em contato!
              </p>
            </div>
          </div>
        )}

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
            <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">
              WhatsApp ou @instagram *
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode={contactType === 'instagram' ? 'text' : 'tel'}
                placeholder="(41) 99999-9999 ou @usuario"
                value={contact}
                onChange={handleContactChange}
                onBlur={() => setContactTouched(true)}
                className={`w-full px-4 py-2.5 pr-10 rounded-lg border bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-1 transition placeholder:text-on-surface-variant/50
                  ${contactTouched
                    ? contactValidation.valid
                      ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                      : 'border-error focus:ring-error focus:border-error'
                    : 'border-outline-variant focus:ring-primary focus:border-primary'
                  }`}
              />
              {contactTouched && (
                <span className={`material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-base ${contactValidation.valid ? 'text-green-500' : 'text-error'}`}>
                  {contactValidation.valid ? 'check_circle' : 'error'}
                </span>
              )}
            </div>
            {contactTouched && contactError && (
              <p className="text-xs text-error mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span>
                {contactError}
              </p>
            )}
            {!contactTouched && (
              <p className="text-[11px] text-on-surface-variant/60 mt-1.5">
                Informe um número com DDD ou seu @instagram
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-error/10 border border-error/30 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-error text-base shrink-0">warning</span>
              <p className="text-xs text-error">{error}</p>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3.5 rounded-lg font-bold text-sm active:scale-[.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg text-white bg-[#25d366] hover:bg-[#20ba5a] disabled:cursor-not-allowed"
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

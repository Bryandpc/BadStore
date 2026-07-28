import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import useCartStore from '../store/useCartStore'
import { useAuth } from '../contexts/AuthContext'

const RATE_LIMIT_MINUTES = 3

function fmtBRL(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function detectContactType(value) {
  if (value.startsWith('@')) return 'instagram'
  const digits = value.replace(/\D/g, '')
  if (digits.length > 0) return 'phone'
  return null
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function validateContact(value) {
  const v = value.trim()
  if (!v) return { valid: false, msg: 'Preencha seu WhatsApp ou @instagram.' }
  if (v.startsWith('@')) {
    if (!/^@[a-zA-Z0-9._]{1,30}$/.test(v))
      return { valid: false, msg: 'Handle inválido. Use @usuario com letras, números, . ou _' }
    return { valid: true, msg: null }
  }
  const digits = v.replace(/\D/g, '')
  if (digits.length < 10) return { valid: false, msg: 'Número incompleto. Informe DDD + número.' }
  if (digits.length > 11) return { valid: false, msg: 'Número muito longo. Verifique o formato.' }
  return { valid: true, msg: null }
}

export default function CheckoutPage() {
  const items = useCartStore(s => s.items)
  const clear = useCartStore(s => s.clear)
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [contactError, setContactError] = useState(null)
  const [contactTouched, setContactTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successOrderId, setSuccessOrderId] = useState(null)

  useEffect(() => {
    if (user === null) navigate('/login?next=/checkout', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (!user) return
    if (!name) setName(profile?.name ?? user.displayName ?? '')
    if (!contact && profile?.phone) setContact(profile.phone)
  }, [user, profile])

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
      clear()
      setSuccessOrderId(docRef.id)
    } catch (err) {
      setError('Erro ao registrar pedido. Tente novamente.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (user === undefined) return null

  if (successOrderId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-6 text-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-primary">check_circle</span>
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-on-surface">Pedido recebido!</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Estamos preparando tudo com carinho para você.
            </p>
          </div>
          <div className="bg-surface-container-low border border-outline-variant rounded-xl px-5 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5">Número do pedido</p>
            <p className="text-lg font-mono font-black text-primary">#{successOrderId.slice(-6).toUpperCase()}</p>
          </div>
          <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">
            Acompanhe o status em <strong className="text-on-surface">Meus Pedidos</strong>. Entraremos em contato assim que confirmarmos.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate('/meus-pedidos')}
            className="w-full py-3 rounded-xl font-bold text-sm bg-primary text-on-primary hover:opacity-90 transition-opacity shadow-lg"
          >
            Ver meus pedidos
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-xl font-bold text-sm bg-surface-container-low border border-outline-variant text-on-surface hover:bg-surface-container transition-colors"
          >
            Continuar comprando
          </button>
        </div>
      </div>
    )
  }

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
              className="w-full py-3.5 rounded-lg font-bold text-sm active:scale-[.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg bg-primary text-on-primary hover:opacity-90 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base">
                {submitting ? 'hourglass_empty' : 'check_circle'}
              </span>
              {submitting ? 'Confirmando...' : 'Confirmar pedido'}
            </button>
            <p className="text-[11px] text-on-surface-variant text-center mt-2">
              Seu pedido será registrado e você poderá acompanhar o status em Meus Pedidos.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

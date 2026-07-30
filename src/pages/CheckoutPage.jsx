import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import useCartStore from '../store/useCartStore'
import { useAuth } from '../contexts/AuthContext'

const DELIVERY_ACK_KEY = 'bad_delivery_ack'

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
  const { user, profile, profileLoading, saveProfile } = useAuth()

  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [contactError, setContactError] = useState(null)
  const [contactTouched, setContactTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [successOrderId, setSuccessOrderId] = useState(null)
  const [deliveryModal, setDeliveryModal] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [crocheQueue, setCrocheQueue] = useState(null) // { crocheOrderCount, crocheItemCount }

  // O que já existe no perfil
  const hasName  = !profileLoading && !!profile?.name
  const hasPhone = !profileLoading && !!profile?.phone

  // Valores finais do pedido: perfil > input
  const finalName    = profile?.name    || name.trim()
  const finalContact = profile?.phone   || contact.trim()
  const finalPhoto   = profile?.photoUrl ?? user?.photoURL ?? null

  useEffect(() => {
    if (user === null) navigate('/login?next=/checkout', { replace: true })
  }, [user, navigate])

  const hasCroche = items.some(i => i.saleCategory === 'croche')
  const hasCustomOrder = items.some(i => i.isCustomOrder === true)

  useEffect(() => {
    if (!hasCroche) return
    getDoc(doc(db, 'config', 'production_queue'))
      .then(snap => { if (snap.exists()) setCrocheQueue(snap.data()) })
      .catch(() => {})
  }, [hasCroche])

  // Valida contato em tempo real após primeiro blur
  useEffect(() => {
    if (!contactTouched) return
    const { msg } = validateContact(contact)
    setContactError(msg)
  }, [contact, contactTouched])

  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const contactType = detectContactType(contact)
  const contactValidation = validateContact(hasPhone ? finalContact : contact)
  const nameOk    = hasName  || name.trim().length > 0
  const contactOk = hasPhone || contactValidation.valid
  const canSubmit = !profileLoading && nameOk && contactOk && !submitting

  const handleContactChange = (e) => {
    const raw = e.target.value
    if (raw.startsWith('@') || raw === '') {
      setContact(raw)
    } else {
      setContact(formatPhone(raw))
    }
  }

  function validateFields() {
    setContactTouched(true)
    if (!hasName && !name.trim()) { setError('Preencha seu nome.'); return false }
    if (!hasPhone) {
      const { valid, msg } = validateContact(contact)
      if (!valid) { setContactError(msg); return false }
    }
    return true
  }

  const handleConfirmClick = () => {
    if (!validateFields()) return
    if (localStorage.getItem(DELIVERY_ACK_KEY) === '1') {
      doSubmit()
    } else {
      setDeliveryModal(true)
    }
  }

  const handleDeliveryConfirm = () => {
    if (dontShowAgain) localStorage.setItem(DELIVERY_ACK_KEY, '1')
    setDeliveryModal(false)
    doSubmit()
  }

  const handleSubmit = (e) => { e.preventDefault() }

  const doSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const rlKey = `rl_order_${user.uid}`
      const lastTs = parseInt(localStorage.getItem(rlKey) || '0')
      const elapsed = Date.now() - lastTs
      if (elapsed < RATE_LIMIT_MINUTES * 60 * 1000) {
        const waitSecs = Math.ceil((RATE_LIMIT_MINUTES * 60 * 1000 - elapsed) / 1000)
        setError(`Aguarde ${waitSecs}s antes de enviar outro pedido.`)
        setSubmitting(false)
        return
      }

      // Upload reference images for custom items before saving
      const orderItems = await Promise.all(items.map(async (i) => {
        const base = { id: i.id, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, saleCategory: i.saleCategory ?? 'tcg' }
        if (i.desc) base.desc = i.desc
        if (i.imageUrl) { base.imageUrl = i.imageUrl; return base }
        if (i.imageFile) {
          try {
            const form = new FormData()
            form.append('file', i.imageFile)
            const res = await fetch('/api/upload-reference', { method: 'POST', body: form })
            if (res.ok) {
              const { url } = await res.json()
              if (url) base.imageUrl = url
            }
          } catch (_) {
            // Upload falhou — pedido prossegue sem imagem
          }
        }
        return base
      }))

      const docRef = await addDoc(collection(db, 'orders'), {
        customerName:     finalName,
        customerContact:  finalContact,
        customerEmail:    user?.email ?? null,
        customerPhotoUrl: finalPhoto,
        uid:  user?.uid ?? null,
        items: orderItems,
        total,
        status:  hasCustomOrder ? 'orcamento' : 'draft',
        origem:  'badstore',
        createdAt: serverTimestamp(),
      })

      // Salva dados novos no perfil automaticamente
      if (!hasName || !hasPhone) {
        saveProfile({
          name:     finalName,
          phone:    finalContact,
          photoUrl: profile?.photoUrl ?? null,
        }).catch(() => {})
      }

      localStorage.setItem(rlKey, Date.now().toString())
      clear()
      setSuccessOrderId(docRef.id)

      // Notificação por email — fire and forget, não bloqueia o UX
      fetch('/api/order-created', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: docRef.id,
          customerName: finalName,
          customerEmail: user?.email ?? null,
          customerContact: finalContact,
          items: orderItems.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, ...(i.desc ? { desc: i.desc } : {}) })),
          total,
        }),
      }).catch(() => {})
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
      <header className="sticky top-0 z-30 border-b border-outline-variant bg-background/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <a href="/" className="flex items-center gap-2 shrink-0 rounded-[10px] pl-1.5 pr-3 py-1.5" style={{ background: '#191c1e' }}>
            <img src="/logo-gengar.png" alt="Gengar" className="w-6 h-6 object-contain" />
            <img src="/logo-nome.png" alt="BAD TCG" className="h-3.5 object-contain" />
          </a>
          <h1 className="text-sm font-display font-bold text-on-surface">Finalizar Pedido</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {hasCroche && (
          <div className="flex gap-3 rounded-xl px-4 py-3.5" style={{ background: '#fdf4ff', border: '1px solid #e9d5ff' }}>
            <span className="material-symbols-outlined text-xl shrink-0" style={{ color: '#8127cf' }}>schedule</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#6900b3' }}>Itens sob encomenda</p>
              {crocheQueue ? (
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Seu pedido inclui peças de crochê feitas após confirmação.
                  {crocheQueue.crocheItemCount > 0 ? (
                    <> Há atualmente <strong className="text-on-surface">{crocheQueue.crocheItemCount} {crocheQueue.crocheItemCount === 1 ? 'peça' : 'peças'}</strong> na fila — você entrará na <strong className="text-on-surface">posição {crocheQueue.crocheItemCount + 1}</strong>. Prazo estimado de <strong className="text-on-surface">{crocheQueue.crocheItemCount + 1} a {crocheQueue.crocheItemCount + 2} dias</strong> após confirmação.</>
                  ) : (
                    <> A fila está <strong className="text-on-surface">vazia</strong> — seu pedido será o próximo! Prazo estimado de <strong className="text-on-surface">1 a 2 dias</strong> após confirmação.</>
                  )}
                  {' '}Assim que confirmarmos, entramos em contato!
                </p>
              ) : (
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  Seu pedido inclui peças de crochê produzidas após confirmação. Prazo de <strong className="text-on-surface">1 a 2 dias por peça</strong>, em ordem de chegada dos pedidos. Assim que confirmarmos, entramos em contato!
                </p>
              )}
            </div>
          </div>
        )}

        {/* Resumo */}
        <div className="bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden">
          <div className="px-5 py-3 border-b border-outline-variant">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Resumo do pedido</p>
          </div>
          <div className="divide-y divide-outline-variant/30">
            {items.map(item => {
              const thumb = item.imagePreview || item.imageUrl
              const isFree = item.unitPrice === 0
              return (
                <div key={item.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    {thumb ? (
                      <img src={thumb} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : item.isCustomOrder ? (
                      <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: '#f0dbff' }}>
                        <span className="material-symbols-outlined text-base" style={{ color: '#8127cf' }}>auto_fix_high</span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-surface-container flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-on-surface">{item.name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {item.quantity}x {isFree ? 'A combinar' : fmtBRL(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-on-surface flex-shrink-0">
                      {isFree ? '—' : fmtBRL(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                  {item.desc && (
                    <p className="text-xs text-on-surface-variant italic mt-1.5 ml-13 leading-relaxed pl-[52px]">
                      "{item.desc}"
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t border-outline-variant bg-surface-container">
            <span className="text-sm font-semibold text-primary">Total</span>
            <span className="text-2xl font-price font-black text-on-surface">{fmtBRL(total)}</span>
          </div>
        </div>

        {/* Dados do cliente */}
        <form onSubmit={handleSubmit} className="bg-surface-container-low rounded-xl border border-outline-variant p-5 space-y-4">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Seus dados</p>

          {/* Skeleton enquanto profile carrega */}
          {profileLoading ? (
            <div className="flex items-center gap-3 bg-surface-container rounded-xl px-4 py-3 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-outline-variant shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-outline-variant rounded w-32" />
                <div className="h-2.5 bg-outline-variant rounded w-24" />
              </div>
            </div>
          ) : (
            <>
              {/* ── Nome ── */}
              {hasName ? (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container/60">
                  {finalPhoto ? (
                    <img src={finalPhoto} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-sm font-black text-on-primary shrink-0">
                      {finalName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <p className="flex-1 text-sm font-semibold text-on-surface">{profile.name}</p>
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-base">lock</span>
                </div>
              ) : (
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
              )}

              {/* ── Contato ── */}
              {hasPhone ? (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container/60">
                  <span className="material-symbols-outlined text-on-surface-variant text-base">phone</span>
                  <p className="flex-1 text-sm text-on-surface">{profile.phone}</p>
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-base">lock</span>
                </div>
              ) : (
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
                      Será salvo no seu perfil para os próximos pedidos.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-error/10 border border-error/30 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-error text-base shrink-0">warning</span>
              <p className="text-xs text-error">{error}</p>
            </div>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={handleConfirmClick}
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

      {/* Modal de entrega */}
      {deliveryModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm bg-surface-container-low rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            {/* Topo colorido */}
            <div className="px-5 pt-5 pb-4 border-b border-outline-variant/40">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">local_shipping</span>
                </div>
                <h2 className="text-base font-display font-black text-on-surface leading-tight">Informações de entrega</h2>
              </div>
              <p className="text-sm text-on-surface leading-relaxed">
                Realizamos entregas <strong>apenas em Curitiba e região</strong>. Após a confirmação do pedido, entraremos em contato no número informado para combinar o envio.
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={e => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#3525cd' }}
                />
                <span className="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors">Não exibir novamente</span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeliveryModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleDeliveryConfirm}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold action-gradient text-white hover:opacity-90 transition-opacity"
                >
                  Estou ciente, confirmar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

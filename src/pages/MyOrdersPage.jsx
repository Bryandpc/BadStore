import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

function fmtBRL(val) {
  if (val == null) return '—'
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS = {
  draft:     { label: 'Aguardando pagamento', color: 'text-amber-400',          bg: 'bg-amber-400/10 border-amber-400/30',         icon: 'payments' },
  confirmado:{ label: 'Confirmado',           color: 'text-blue-400',           bg: 'bg-blue-400/10 border-blue-400/30',           icon: 'check_circle' },
  separando: { label: 'Separando',            color: 'text-primary',            bg: 'bg-primary/10 border-primary/30',             icon: 'inventory_2' },
  enviado:   { label: 'Enviado',              color: 'text-green-400',          bg: 'bg-green-400/10 border-green-400/30',         icon: 'local_shipping' },
  entregue:  { label: 'Entregue',             color: 'text-on-surface-variant', bg: 'bg-surface-container border-outline-variant', icon: 'done_all' },
  cancelado: { label: 'Cancelado',            color: 'text-error',              bg: 'bg-error/10 border-error/30',                 icon: 'cancel' },
}

function resolveStatus(order) {
  return order.status
}

function StatusBadge({ order }) {
  const key = resolveStatus(order)
  const s = STATUS[key] ?? STATUS.draft
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.color} ${s.bg}`}>
      <span className="material-symbols-outlined text-[11px]">{s.icon}</span>
      {s.label}
    </span>
  )
}

// Timeline de progresso do pedido — espelha os steps do BadTracking
const STEPS = [
  { key: 'draft',      label: 'Ag. pagamento', icon: 'payments' },
  { key: 'confirmado', label: 'Confirmado',    icon: 'check_circle' },
  { key: 'separando',  label: 'Separando',     icon: 'inventory_2' },
  { key: 'enviado',    label: 'Enviado',        icon: 'local_shipping' },
  { key: 'entregue',   label: 'Entregue',       icon: 'done_all' },
]

function stepIndex(status) {
  const map = { draft: 0, confirmado: 1, separando: 2, enviado: 3, entregue: 4 }
  return map[status] ?? 0
}

function OrderTimeline({ order }) {
  const resolved = resolveStatus(order)
  if (resolved === 'cancelado') return (
    <div className="flex items-center gap-2 px-4 py-3 bg-error/5 border-t border-error/20">
      <span className="material-symbols-outlined text-error text-base">cancel</span>
      <p className="text-xs text-error font-semibold">Pedido cancelado</p>
    </div>
  )

  const currentIdx = stepIndex(resolved)
  return (
    <div className="px-4 py-3 border-t border-outline-variant/30">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i <= currentIdx
          const active = i === currentIdx
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className={`flex flex-col items-center gap-1 ${active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-25'}`}>
                <span className={`material-symbols-outlined text-sm ${active ? 'text-primary' : done ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {done && !active ? 'check_circle' : step.icon}
                </span>
                <span className={`text-[8px] font-bold text-center leading-tight ${active ? 'text-primary' : done ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 mb-4 ${i < currentIdx ? 'bg-primary/50' : 'bg-outline-variant/40'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const REPLY_SEEN_KEY = 'reply_seen_'

const PIX_KEY = 'tcgbad@gmail.com'

function CopyPix() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(PIX_KEY)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">Chave Pix</p>
        <p className="text-sm font-mono font-semibold text-on-surface truncate">{PIX_KEY}</p>
      </div>
      <button
        onClick={copy}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          copied ? 'bg-green-500/20 text-green-400' : 'bg-primary/15 text-primary hover:bg-primary/25'
        }`}
      >
        <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}

function ProofField({ order }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  // Já enviou comprovante
  if (order.paymentProofUrl) {
    return (
      <div className="px-4 py-3 border-t border-outline-variant/30 bg-teal-500/5">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-teal-400 text-base">check_circle</span>
          <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Comprovante enviado</p>
        </div>
        <a
          href={order.paymentProofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-teal-400 underline underline-offset-2"
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          Ver comprovante
        </a>
        <p className="text-[11px] text-on-surface-variant mt-1">Aguardando confirmação da loja.</p>
      </div>
    )
  }

  const compressImage = (file) => new Promise((resolve) => {
    // PDFs passam direto
    if (file.type === 'application/pdf') { resolve(file); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1600
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })

  const handleFile = async (e) => {
    const raw = e.target.files?.[0]
    if (!raw) return
    e.target.value = ''
    setError(null)
    setUploading(true)
    setPreview(URL.createObjectURL(raw))
    try {
      const file = await compressImage(raw)
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload-proof', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const { url } = await res.json()
      await updateDoc(doc(db, 'orders', order.id), {
        paymentProofUrl: url,
        paymentProofAt: serverTimestamp(),
      })
    } catch (err) {
      setError(`Erro ao enviar: ${err.message ?? 'tente novamente'}`)
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="px-4 py-3 border-t border-blue-400/20 bg-blue-400/5 space-y-2">
      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Pedido confirmado — envie o pagamento</p>
      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        Realize o pagamento via Pix e anexe o comprovante abaixo para seguirmos com a separação.
      </p>
      <CopyPix />

      {preview && (
        <img src={preview} alt="preview" className="w-full max-h-40 object-contain rounded-lg border border-outline-variant/30" />
      )}

      {error && <p className="text-xs text-error">{error}</p>}

      {/* Botão grande, fácil de tocar no mobile */}
      <label className={`w-full py-4 rounded-xl border-2 border-dashed border-blue-400/50 text-blue-400 font-bold flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer active:bg-blue-400/10 ${uploading ? 'opacity-50 pointer-events-none' : 'hover:bg-blue-400/10'}`}>
        <span className="material-symbols-outlined text-2xl">
          {uploading ? 'hourglass_empty' : 'upload_file'}
        </span>
        <span className="text-sm">{uploading ? 'Enviando...' : 'Anexar comprovante'}</span>
        <span className="text-[11px] text-on-surface-variant font-normal">Foto, print ou PDF</span>
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  )
}

function NoteField({ order }) {
  const [text, setText] = useState(order.customerNote ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dirty = text !== (order.customerNote ?? '')

  const handleSave = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        customerNote: text.trim(),
        customerNoteAt: serverTimestamp(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const canEdit = !['entregue', 'cancelado'].includes(order.status)

  // Marca resposta como lida ao expandir
  useEffect(() => {
    if (order.storeReplyAt) {
      localStorage.setItem(REPLY_SEEN_KEY + order.id, order.storeReplyAt)
    }
  }, [order.id, order.storeReplyAt])

  return (
    <div className="border-t border-outline-variant/30 space-y-0">
      {/* Resposta da loja */}
      {order.storeReply && (
        <div className="px-4 py-3 bg-primary/5 border-b border-outline-variant/30">
          <div className="flex items-start gap-2">
            <img src="/logo-gengar.png" alt="loja" className="w-5 h-5 object-contain mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Resposta da loja</p>
              <p className="text-xs text-on-surface leading-relaxed">{order.storeReply}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recado do cliente */}
      <div className="px-4 pb-4 pt-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {order.customerNote ? 'Seu recado' : 'Deixar um recado'}
        </p>
        <textarea
          rows={2}
          disabled={!canEdit}
          placeholder={canEdit ? 'Alguma observação? Ex: endereço, preferência de entrega...' : 'Pedido finalizado.'}
          value={text}
          onChange={e => { setText(e.target.value); setSaved(false) }}
          className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition placeholder:text-on-surface-variant/40 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={[
              'text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 disabled:opacity-40',
              saved ? 'bg-green-600/20 text-green-400' : 'bg-primary/10 text-primary hover:bg-primary/20',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-sm">
              {saved ? 'check' : saving ? 'hourglass_empty' : 'send'}
            </span>
            {saved ? 'Enviado!' : saving ? 'Enviando...' : 'Enviar recado'}
          </button>
        )}
      </div>
    </div>
  )
}

function hasUnseenReply(order) {
  if (!order.storeReplyAt) return false
  const seen = localStorage.getItem(REPLY_SEEN_KEY + order.id)
  return seen !== order.storeReplyAt
}

export default function MyOrdersPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (user === null) { navigate('/login?next=/meus-pedidos', { replace: true }); return }
    if (!user) return

    const q = query(
      collection(db, 'orders'),
      where('uid', '==', user.uid)
    )
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Ordena por data decrescente no cliente — evita índice composto no Firestore
      docs.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0)
        const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0)
        return tb - ta
      })
      setOrders(docs)
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [user])

  if (user === undefined || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-t-transparent border-primary animate-spin" />
      </div>
    )
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
          <img src="/logo-completa.jpg" alt="BAD TCG" className="h-8 object-contain rounded" />
          <h1 className="text-base font-display font-bold text-on-surface flex-1">Meus Pedidos</h1>
          {/* Avatar do usuário */}
          <button onClick={() => navigate('/perfil')} className="shrink-0">
            {(profile?.photoUrl || user?.photoURL) ? (
              <img
                src={profile?.photoUrl || user?.photoURL}
                alt=""
                className="w-8 h-8 rounded-full object-cover border-2 border-primary/30"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-xs font-black text-on-primary">
                {(profile?.name || user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {orders.length === 0 ? (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-20 mb-4 block">receipt_long</span>
            <p className="text-sm text-on-surface-variant">Nenhum pedido ainda</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-5 py-2 rounded-xl text-white text-sm font-bold bg-primary-container hover:opacity-90 transition-opacity"
            >
              Ver produtos
            </button>
          </div>
        ) : orders.map(order => {
          const resolvedKey = resolveStatus(order)
          const st = STATUS[resolvedKey] ?? STATUS.draft
          const isOpen = expanded === order.id
          const isCancelled = order.status === 'cancelado'
          const unseenReply = hasUnseenReply(order)

          return (
            <div
              key={order.id}
              className={`bg-surface-container-low rounded-xl border overflow-hidden transition-all ${isCancelled ? 'border-error/20 opacity-70' : unseenReply ? 'border-primary/50 ring-1 ring-primary/30' : 'border-outline-variant hover:border-outline'}`}
            >
              {/* Linha principal */}
              <div
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : order.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[11px] font-mono font-bold text-on-surface-variant">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <StatusBadge order={order} />
                    {unseenReply && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        nova resposta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant">{fmtDate(order.createdAt)}</p>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="text-base font-price font-black text-on-surface">{fmtBRL(order.total)}</p>
                  <p className="text-[10px] text-on-surface-variant">
                    {order.items?.length} item{order.items?.length !== 1 ? 's' : ''}
                  </p>
                  {/* CTA comprovante visível no card fechado */}
                  {order.status === 'confirmado' && !order.paymentProofUrl && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-400/15 text-blue-400 animate-pulse">
                      <span className="material-symbols-outlined text-[10px]">upload</span>
                      enviar pix
                    </span>
                  )}
                </div>

                <span className={`material-symbols-outlined text-on-surface-variant text-lg shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </div>

              {/* Expandido */}
              {isOpen && (
                <>
                  {/* Itens */}
                  <div className="border-t border-outline-variant/30 divide-y divide-outline-variant/20">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                        <span className="text-sm text-on-surface-variant truncate">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="text-sm font-semibold text-on-surface shrink-0">
                          {fmtBRL((item.unitPrice ?? 0) * item.quantity)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Total</span>
                      <span className="text-lg font-price font-black text-on-surface">{fmtBRL(order.total)}</span>
                    </div>
                  </div>

                  {/* Timeline */}
                  <OrderTimeline order={order} />

                  {/* Comprovante Pix — só quando aguardando pagamento */}
                  {order.status === 'confirmado' && <ProofField order={order} />}

                  {/* Recado do cliente */}
                  <NoteField order={order} />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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

const STATUS_META = {
  draft:      { label: 'Ag. Pagamento', bg: '#fef3c7', fg: '#92400e', icon: 'payments' },
  confirmado: { label: 'Pago',          bg: '#dbeafe', fg: '#1e40af', icon: 'check_circle' },
  separando:  { label: 'Em confecção',  bg: '#fce7f3', fg: '#9d174d', icon: 'inventory_2' },
  enviado:    { label: 'Enviado',       bg: '#ede9fe', fg: '#5b21b6', icon: 'local_shipping' },
  entregue:   { label: 'Entregue',      bg: '#d1fae5', fg: '#065f46', icon: 'done_all' },
  cancelado:  { label: 'Cancelado',     bg: '#fee2e2', fg: '#991b1b', icon: 'cancel' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.draft
  return (
    <span style={{ background: m.bg, color: m.fg, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>
      {m.label}
    </span>
  )
}

// ── Vertical Timeline ────────────────────────────────────────────────────────

const STEPS = [
  { key: 'draft',      label: 'Aguardando pagamento',         helper: 'Aguardando a confirmação do Pix.',                      icon: 'payments' },
  { key: 'confirmado', label: 'Pagamento confirmado',          helper: 'Pagamento recebido, preparando seu pedido.',             icon: 'check_circle' },
  { key: 'separando',  label: 'Em confecção / separação',      helper: 'Seu pedido está sendo separado ou produzido.',          icon: 'inventory_2' },
  { key: 'enviado',    label: 'Enviado',                       helper: 'A caminho do endereço combinado.',                      icon: 'local_shipping' },
  { key: 'entregue',   label: 'Entregue',                      helper: 'Pedido concluído.',                                     icon: 'done_all' },
]

function stepIndex(status) {
  const map = { draft: 0, confirmado: 1, separando: 2, enviado: 3, entregue: 4 }
  return map[status] ?? 0
}

function OrderTimeline({ order }) {
  if (order.status === 'cancelado') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', marginBottom: 20 }}>
        <div style={{ width: 28, height: 28, borderRadius: 99, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#991b1b' }}>cancel</span>
        </div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', margin: '0 0 2px' }}>Pedido cancelado</p>
          <p style={{ fontSize: 11, color: '#9a97ab', margin: 0 }}>Entre em contato para mais informações.</p>
        </div>
      </div>
    )
  }

  const currentIdx = stepIndex(order.status)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
      {STEPS.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        const pending = i > currentIdx
        const circleStyle = {
          width: 28, height: 28, borderRadius: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: active ? '#3525cd' : done ? '#e2dfff' : '#eceef0',
          color: active ? '#fff' : done ? '#3323cc' : '#9a97ab',
        }
        const lineStyle = {
          width: 2, flex: 1, minHeight: 20,
          background: done ? '#c7c4d8' : active ? '#c7c4d8' : '#eceef0',
        }
        const labelColor = active ? '#191c1e' : done ? '#464555' : '#9a97ab'
        return (
          <div key={step.key} style={{ display: 'flex', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={circleStyle}>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  {done ? 'check' : step.icon}
                </span>
              </div>
              {i < STEPS.length - 1 && <div style={lineStyle} />}
            </div>
            <div style={{ paddingBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: labelColor, margin: '0 0 2px' }}>{step.label}</p>
              {(active || done) && (
                <p style={{ fontSize: 11, color: '#9a97ab', margin: 0 }}>{step.helper}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Pix / Proof upload ───────────────────────────────────────────────────────

const PIX_KEY = 'tcgbad@gmail.com'

function CopyPix() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(PIX_KEY)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 8, padding: '9px 12px' }}>
      <span style={{ flex: 1, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#191c1e' }}>{PIX_KEY}</span>
      <button
        onClick={copy}
        style={{ background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
      >
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}

function ProofField({ order }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  if (order.paymentProofUrl) {
    return (
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: '#065f46', margin: '0 0 8px' }}>Comprovante enviado</p>
        <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
          Ver comprovante
        </a>
        <p style={{ fontSize: 11, color: '#9a97ab', marginTop: 4 }}>Aguardando confirmação da loja.</p>
      </div>
    )
  }

  const compressImage = (file) => new Promise((resolve) => {
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
    <div style={{ background: '#dbeafe', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: '#1e40af', margin: '0 0 8px' }}>Envie o comprovante Pix</p>
      <CopyPix />
      {preview && (
        <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8, marginTop: 10 }} />
      )}
      {error && <p style={{ fontSize: 11, color: '#991b1b', marginTop: 6 }}>{error}</p>}
      <label style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        marginTop: 10, padding: '12px', borderRadius: 8, border: '2px dashed #93c5fd',
        cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1,
        color: '#1e40af', fontSize: 12, fontWeight: 700,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{uploading ? 'hourglass_empty' : 'upload_file'}</span>
        {uploading ? 'Enviando...' : 'Anexar comprovante'}
        <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 400 }}>Foto, print ou PDF</span>
        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  )
}

// ── Note field ───────────────────────────────────────────────────────────────

const REPLY_SEEN_KEY = 'reply_seen_'

function NoteField({ order }) {
  const [text, setText] = useState(order.customerNote ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dirty = text !== (order.customerNote ?? '')
  const canEdit = !['entregue', 'cancelado'].includes(order.status)

  useEffect(() => {
    if (order.storeReplyAt) {
      localStorage.setItem(REPLY_SEEN_KEY + order.id, order.storeReplyAt)
    }
  }, [order.id, order.storeReplyAt])

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

  return (
    <div style={{ borderTop: '1px solid #eceef0', paddingTop: 16 }}>
      {order.storeReply && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#f5f3ff', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <img src="/logo-gengar.png" alt="loja" style={{ width: 16, height: 16, objectFit: 'contain', marginTop: 2, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#3525cd', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 4px' }}>Resposta da loja</p>
            <p style={{ fontSize: 12, color: '#191c1e', lineHeight: 1.5, margin: 0 }}>{order.storeReply}</p>
          </div>
        </div>
      )}
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#777587', margin: '0 0 8px' }}>
        {order.customerNote ? 'Seu recado' : 'Deixar um recado'}
      </p>
      <textarea
        rows={2}
        disabled={!canEdit}
        placeholder={canEdit ? 'Alguma observação? Ex: endereço, preferência de entrega...' : 'Pedido finalizado.'}
        value={text}
        onChange={e => { setText(e.target.value); setSaved(false) }}
        style={{
          width: '100%', boxSizing: 'border-box', border: '1px solid #c7c4d8', borderRadius: 8,
          padding: '8px 10px', fontSize: 12, fontFamily: "'Inter',sans-serif",
          resize: 'none', color: '#191c1e', background: canEdit ? '#fff' : '#f2f4f6',
          opacity: canEdit ? 1 : 0.6, cursor: canEdit ? 'auto' : 'not-allowed',
        }}
      />
      {canEdit && (
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            marginTop: 8, background: saved ? '#d1fae5' : '#3525cd', color: saved ? '#065f46' : '#fff',
            border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 700,
            cursor: !dirty || saving ? 'not-allowed' : 'pointer', opacity: !dirty || saving ? 0.5 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            {saved ? 'check' : saving ? 'hourglass_empty' : 'send'}
          </span>
          {saved ? 'Enviado!' : saving ? 'Enviando...' : 'Enviar recado'}
        </button>
      )}
    </div>
  )
}

function hasUnseenReply(order) {
  if (!order.storeReplyAt) return false
  const seen = localStorage.getItem(REPLY_SEEN_KEY + order.id)
  return seen !== order.storeReplyAt
}

// ── Order Detail ─────────────────────────────────────────────────────────────

function OrderDetail({ order }) {
  const m = STATUS_META[order.status] ?? STATUS_META.draft
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#777587', margin: '0 0 4px' }}>
            Pedido #{order.id.slice(-6).toUpperCase()} · {fmtDate(order.createdAt)}
          </p>
          <p style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 17, fontWeight: 800, color: '#191c1e', margin: 0 }}>
            {m.label}
          </p>
        </div>
        {order.total > 0 && (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 800, color: '#191c1e' }}>
            {fmtBRL(order.total)}
          </span>
        )}
      </div>

      {/* Timeline */}
      <OrderTimeline order={order} />

      {/* Pix proof */}
      {order.status === 'confirmado' && <ProofField order={order} />}

      {/* Items */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#777587', margin: '0 0 10px' }}>Itens</p>
      <div style={{ borderTop: '1px solid #eceef0', marginBottom: 16 }}>
        {order.items?.map((item, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eceef0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {item.imageUrl && (
                  <a href={item.imageUrl} target="_blank" rel="noopener noreferrer">
                    <img src={item.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                  </a>
                )}
                <span style={{ fontSize: 12, color: '#464555' }}>{item.quantity}× {item.name}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#191c1e', flexShrink: 0 }}>
                {item.unitPrice > 0 ? fmtBRL((item.unitPrice ?? 0) * item.quantity) : '—'}
              </span>
            </div>
            {item.desc && (
              <p style={{ fontSize: 11, color: '#777587', margin: '4px 0 4px 8px', fontStyle: 'italic' }}>"{item.desc}"</p>
            )}
          </div>
        ))}
        {order.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#3525cd' }}>Total</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 800, color: '#191c1e' }}>{fmtBRL(order.total)}</span>
          </div>
        )}
      </div>

      {/* Note */}
      <NoteField order={order} />
    </div>
  )
}

// ── Profile Tab ──────────────────────────────────────────────────────────────

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return '(' + digits
  if (digits.length <= 7) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2)
  if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6)
  return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7)
}

function ProfileTab({ user, profile, saveProfile, uploadProfilePhoto }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? user?.displayName ?? '')
      setPhone(profile.phone ?? '')
      setPhotoPreview(profile.photoUrl ?? user?.photoURL ?? null)
    } else if (user) {
      setName(user.displayName ?? '')
      setPhotoPreview(user.photoURL ?? null)
    }
  }, [profile, user])

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handlePhoneChange = (e) => {
    const raw = e.target.value
    if (raw.startsWith('@') || raw === '') setPhone(raw)
    else setPhone(formatPhone(raw))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Nome é obrigatório.'); return }
    setSaving(true)
    setError(null)
    try {
      let photoUrl = profile?.photoUrl ?? user?.photoURL ?? null
      if (photoFile) photoUrl = await uploadProfilePhoto(photoFile)
      await saveProfile({ name: name.trim(), phone: phone.trim(), photoUrl })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError('Erro ao salvar. Tente novamente.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const initials = (name || user?.displayName || user?.email || '?').charAt(0).toUpperCase()
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid #c7c4d8',
    padding: '8px 0', fontSize: 13, color: '#191c1e', fontFamily: "'Inter',sans-serif",
    background: 'transparent', outline: 'none',
  }
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#464555', display: 'block', marginBottom: 6 }

  return (
    <div>
      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{ position: 'relative' }}>
          {photoPreview ? (
            <img src={photoPreview} alt="Foto de perfil" style={{ width: 64, height: 64, borderRadius: 99, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 99, background: '#e2dfff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#3323cc' }}>
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 99, background: '#3525cd', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#fff' }}>photo_camera</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        </div>
        <div>
          <p style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 16, fontWeight: 800, color: '#191c1e', margin: '0 0 2px' }}>
            {name || user?.displayName || 'Meu perfil'}
          </p>
          <p style={{ fontSize: 12, color: '#777587', margin: 0 }}>{user?.email}</p>
        </div>
      </div>

      {/* Form fields */}
      <form onSubmit={handleSave}>
        <div style={{ borderTop: '1px solid #c7c4d8', paddingTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 520 }}>
          <div>
            <label style={labelStyle}>Nome *</label>
            <input
              type="text"
              placeholder="Como você se chama?"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>WhatsApp / @instagram</label>
            <input
              type="text"
              inputMode="tel"
              placeholder="(41) 99999-9999 ou @usuario"
              value={phone}
              onChange={handlePhoneChange}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>E-mail</label>
            <input
              type="text"
              value={user?.email ?? ''}
              disabled
              style={{ ...inputStyle, borderBottom: '1px solid #eceef0', color: '#9a97ab', cursor: 'not-allowed' }}
            />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#991b1b', marginTop: 12 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 28, background: saved ? '#065f46' : '#3525cd', color: '#fff',
            border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 12, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {saved ? 'check_circle' : saving ? 'hourglass_empty' : 'save'}
          </span>
          {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MyOrdersPage({ defaultTab }) {
  const { user, profile, saveProfile, uploadProfilePhoto } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Determine initial tab from prop or location pathname
  const qTab = new URLSearchParams(location.search).get('tab')
  const initTab = defaultTab ?? qTab ?? (location.pathname === '/perfil' ? 'perfil' : 'pedidos')
  const [activeTab, setActiveTab] = useState(initTab)
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  // Mobile: whether we're showing detail panel
  const [mobileDetail, setMobileDetail] = useState(false)

  useEffect(() => {
    if (user === null) {
      navigate(location.pathname === '/perfil' ? '/login?next=/perfil' : '/login?next=/meus-pedidos', { replace: true })
      return
    }
    if (!user) return

    const q = query(collection(db, 'orders'), where('uid', '==', user.uid))
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0)
        const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0)
        return tb - ta
      })
      setOrders(docs)
      setLoadingOrders(false)
      // Auto-select first non-completed order
      if (!selectedId && docs.length > 0) {
        const first = docs.find(o => !['entregue', 'cancelado'].includes(o.status)) ?? docs[0]
        setSelectedId(first.id)
      }
    }, () => setLoadingOrders(false))
    return () => unsub()
  }, [user])

  if (user === undefined || (loadingOrders && activeTab === 'pedidos')) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-7 h-7 rounded-full border-2 border-t-transparent border-primary animate-spin" />
      </div>
    )
  }

  const selectedOrder = orders.find(o => o.id === selectedId) ?? null

  const NAV = [
    { key: 'perfil',   label: 'Perfil',       icon: 'person' },
    { key: 'pedidos',  label: 'Meus Pedidos',  icon: 'receipt_long' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', color: '#191c1e' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #c7c4d8', background: '#f4f6f9', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#464555', padding: 4, display: 'flex' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <h1 style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 15, fontWeight: 800, color: '#191c1e', margin: 0 }}>
            Minha Conta
          </h1>
        </div>
      </header>

      {/* Body */}
      <div className="account-body" style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px 64px', display: 'flex', gap: 40, alignItems: 'flex-start' }}>

        {/* Sidebar nav */}
        <nav className="account-nav" style={{ width: 170, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => {
            const active = activeTab === n.key
            return (
              <button
                key={n.key}
                onClick={() => { setActiveTab(n.key); setMobileDetail(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: active ? '#e2dfff' : 'transparent',
                  color: active ? '#3323cc' : '#464555',
                  border: 'none', borderRadius: 8, padding: '9px 12px',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{n.icon}</span>
                {n.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ── PROFILE TAB ── */}
          {activeTab === 'perfil' && (
            <ProfileTab
              user={user}
              profile={profile}
              saveProfile={saveProfile}
              uploadProfilePhoto={uploadProfilePhoto}
            />
          )}

          {/* ── ORDERS TAB ── */}
          {activeTab === 'pedidos' && (
            orders.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 80 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#c7c4d8', display: 'block', marginBottom: 12 }}>receipt_long</span>
                <p style={{ fontSize: 13, color: '#777587', marginBottom: 16 }}>Nenhum pedido ainda</p>
                <button
                  onClick={() => navigate('/')}
                  style={{ background: '#3525cd', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Ver produtos
                </button>
              </div>
            ) : (
              <div className="order-two-panel" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

                {/* Order list — hidden on mobile when detail is open */}
                <div
                  className={`order-list-panel${mobileDetail ? ' mobile-hidden' : ''}`}
                  style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  {orders.map(o => {
                    const m = STATUS_META[o.status] ?? STATUS_META.draft
                    const isSelected = o.id === selectedId
                    const unseenReply = hasUnseenReply(o)
                    return (
                      <button
                        key={o.id}
                        onClick={() => { setSelectedId(o.id); setMobileDetail(true) }}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left',
                          background: isSelected ? '#e2dfff' : '#ffffff',
                          border: `1px solid ${isSelected ? '#3525cd' : unseenReply ? '#3525cd' : '#c7c4d8'}`,
                          borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                          color: '#191c1e', fontFamily: "'Inter',sans-serif",
                          position: 'relative',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700 }}>
                            #{o.id.slice(-6).toUpperCase()}
                          </span>
                          <span style={{ background: m.bg, color: m.fg, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>
                            {m.label}
                          </span>
                        </span>
                        <span style={{ fontSize: 11, color: '#777587' }}>{fmtDate(o.createdAt)}</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800 }}>
                          {o.total > 0 ? fmtBRL(o.total) : '—'}
                        </span>
                        {unseenReply && !isSelected && (
                          <span style={{
                            position: 'absolute', top: 8, right: 8,
                            width: 7, height: 7, borderRadius: 99,
                            background: '#3525cd',
                          }} />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Order detail */}
                {selectedOrder && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Mobile back button */}
                    {mobileDetail && (
                      <button
                        onClick={() => setMobileDetail(false)}
                        className="order-back-mobile"
                        style={{ display: 'none', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#464555', fontSize: 12, fontWeight: 700, marginBottom: 16, padding: 0 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                        Voltar aos pedidos
                      </button>
                    )}
                    <OrderDetail order={selectedOrder} />
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .account-body { flex-direction: column !important; gap: 0 !important; padding: 16px 16px 64px !important; }
          .account-nav { width: 100% !important; flex-direction: row !important; gap: 4px !important; margin-bottom: 20px; }
          .account-nav button { flex: 1; justify-content: center; }
          .order-list-panel { width: 100% !important; }
          .order-list-panel.mobile-hidden { display: none !important; }
          .order-back-mobile { display: flex !important; }
          .order-two-panel { flex-direction: column !important; }
        }
      `}</style>
    </div>
  )
}

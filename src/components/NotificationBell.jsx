import { useEffect, useState, useRef } from 'react'
import { collection, query, orderBy, limit, onSnapshot, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [open, setOpen] = useState(false)
  const [shake, setShake] = useState(false)
  const prevUnread = useRef(0)
  const ref = useRef(null)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    )
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setNotifs(docs)
      const unread = docs.filter(n => !n.read).length
      if (unread > prevUnread.current) {
        setShake(true)
        setTimeout(() => setShake(false), 700)
      }
      prevUnread.current = unread
    })
    return unsub
  }, [user])

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifs.filter(n => !n.read).length

  const markAllRead = async () => {
    if (!user) return
    const unreadNotifs = notifs.filter(n => !n.read)
    if (unreadNotifs.length === 0) return
    const batch = writeBatch(db)
    unreadNotifs.forEach(n => {
      batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true })
    })
    await batch.commit()
  }

  const handleOpen = () => {
    setOpen(v => !v)
    if (!open) markAllRead()
  }

  if (!user) return null

  function fmtTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60) return 'agora'
    if (diff < 3600) return Math.floor(diff / 60) + 'min'
    if (diff < 86400) return Math.floor(diff / 3600) + 'h'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-1.5 text-on-surface-variant hover:text-primary transition-colors"
      >
        <span className={`material-symbols-outlined text-[22px] ${shake ? 'animate-bell-shake' : ''}`}>
          notifications
        </span>
        {unread > 0 && (
          <span
            key={unread}
            className="absolute top-0.5 right-0.5 bg-primary text-on-primary text-[9px] font-bold px-1 py-px rounded-full leading-none animate-badge-bump"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 rounded-xl shadow-2xl border border-outline-variant bg-surface-container-high animate-slide-up overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
              <p className="text-xs font-bold text-on-surface uppercase tracking-wider">Notificações</p>
              {notifs.length > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-primary hover:underline">
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant/30">
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant opacity-30 block mb-2">notifications_none</span>
                  <p className="text-xs text-on-surface-variant">Nenhuma notificação ainda</p>
                </div>
              ) : notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => { setOpen(false); navigate('/meus-pedidos') }}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                >
                  <img src="/logo-gengar.png" alt="" className="w-7 h-7 object-contain shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-on-surface leading-snug">{n.title}</p>
                    {n.body && <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug line-clamp-2">{n.body}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-on-surface-variant">{fmtTime(n.createdAt)}</span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

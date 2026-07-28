import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return '(' + digits
  if (digits.length <= 7) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2)
  if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6)
  return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7)
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, saveProfile, uploadProfilePhoto } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true })
  }, [user, navigate])

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
    if (raw.startsWith('@') || raw === '') {
      setPhone(raw)
    } else {
      setPhone(formatPhone(raw))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Nome e obrigatorio.'); return }
    setSaving(true)
    setError(null)
    try {
      let photoUrl = profile?.photoUrl ?? user?.photoURL ?? null
      if (photoFile) {
        photoUrl = await uploadProfilePhoto(photoFile)
      }
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

  if (user === undefined) return null

  const initials = (name || user?.displayName || user?.email || '?').charAt(0).toUpperCase()

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
          <h1 className="text-base font-display font-bold text-on-surface">Meu Perfil</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSave} className="space-y-6">

          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Foto de perfil"
                  className="w-24 h-24 rounded-full object-cover border-2 border-primary-container shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center text-3xl font-black text-on-primary border-2 border-primary-container shadow-lg">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-on-primary text-base">photo_camera</span>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <p className="text-xs text-on-surface-variant">Toque na camera para alterar a foto</p>
          </div>

          <div className="bg-surface-container-low rounded-xl border border-outline-variant p-5 space-y-4">
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Seus dados</p>

            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">Nome *</label>
              <input
                type="text"
                placeholder="Como voce se chama?"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition placeholder:text-on-surface-variant/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">
                WhatsApp ou @instagram
              </label>
              <input
                type="text"
                inputMode="tel"
                placeholder="(41) 99999-9999 ou @usuario"
                value={phone}
                onChange={handlePhoneChange}
                className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition placeholder:text-on-surface-variant/50"
              />
              <p className="text-[11px] text-on-surface-variant/60 mt-1.5">
                Salvo aqui, sera preenchido automaticamente no checkout.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1.5">E-mail</label>
              <input
                type="text"
                value={user?.email ?? ''}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container/50 text-on-surface-variant text-sm cursor-not-allowed"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-error/10 border border-error/30 rounded-lg px-3 py-2">
              <span className="material-symbols-outlined text-error text-base shrink-0">warning</span>
              <p className="text-xs text-error">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className={[
              'w-full py-3.5 rounded-lg font-bold text-sm active:scale-[.98] transition-all flex items-center justify-center gap-2 shadow-lg',
              saved ? 'bg-green-600 text-white' : 'bg-primary text-on-primary hover:opacity-90 disabled:opacity-50',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-base">
              {saved ? 'check_circle' : saving ? 'hourglass_empty' : 'save'}
            </span>
            {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </form>
      </div>
    </div>
  )
}

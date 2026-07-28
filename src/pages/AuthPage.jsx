import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { loginGoogle } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = params.get('next') || '/'

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      await loginGoogle()
      navigate(returnTo, { replace: true })
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError('Algo deu errado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 md:px-16 py-4 border-b border-outline-variant bg-background/95 backdrop-blur-md">
        <a href="/" className="flex items-center gap-2 w-fit">
          <img src="/logo-gengar.png" alt="gengar" className="w-9 h-9 object-contain" />
          <img src="/logo-nome.png" alt="BAD TCG" className="h-7 object-contain" />
        </a>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/logo-gengar.png" alt="Gengar" className="w-20 h-20 object-contain mx-auto mb-4" />
            <h1 className="font-display text-3xl font-bold text-on-surface">Acessar Vault</h1>
            <p className="text-on-surface-variant mt-2 text-sm">Entre com sua conta Google para acompanhar seus pedidos.</p>
          </div>

          <div className="glass-panel rounded-xl p-6 space-y-4">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 active:scale-[.98] bg-surface-container-high border border-outline-variant hover:border-primary text-on-surface"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Aguarde...' : 'Continuar com Google'}
            </button>
            {error && <p className="text-xs text-error text-center">{error}</p>}
          </div>

          <p className="text-center text-xs text-on-surface-variant mt-6">
            Ao entrar, você concorda com nossos <span className="text-primary cursor-pointer hover:underline">Termos de Uso</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

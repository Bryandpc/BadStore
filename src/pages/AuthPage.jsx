import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'

function fmtBRL(val) {
  if (!val) return null
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function MiniCard({ item }) {
  const isCroche = item.saleCategory === 'croche'
  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant/40 overflow-hidden flex flex-col shrink-0">
      <div
        className="h-36 flex items-center justify-center p-3"
        style={{
          background: isCroche
            ? 'radial-gradient(ellipse at center, rgba(236,72,153,0.08) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at center, rgba(124,58,237,0.10) 0%, transparent 70%)',
        }}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="max-h-full max-w-full object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]"
          />
        ) : isCroche ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl">🧶</span>
            <span className="text-[9px] font-bold text-pink-300/60 uppercase tracking-wider">Em confecção</span>
          </div>
        ) : (
          <span className="material-symbols-outlined text-3xl text-on-surface-variant opacity-20">image</span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[11px] font-bold text-on-surface line-clamp-2 leading-snug">{item.name}</p>
        {fmtBRL(item.targetPrice) && (
          <p className="text-sm font-price font-black text-primary mt-1">{fmtBRL(item.targetPrice)}</p>
        )}
      </div>
    </div>
  )
}

function ScrollColumn({ items, direction = 'up', speed = 28, offsetTop = 0 }) {
  const doubled = [...items, ...items]
  const animName = direction === 'up' ? 'showcaseUp' : 'showcaseDown'
  return (
    <div
      className="flex flex-col gap-3 w-full"
      style={{
        animation: `${animName} ${speed}s linear infinite`,
        marginTop: offsetTop,
      }}
    >
      {doubled.map((item, i) => (
        <MiniCard key={`${item.id}-${direction}-${i}`} item={item} />
      ))}
    </div>
  )
}

// Placeholder cards para quando não há produtos ainda
const PLACEHOLDER_CARDS = Array.from({ length: 6 }, (_, i) => ({
  id: `ph-${i}`,
  name: ['Pikachu EX', 'Blister Triplo', 'ETB Scarlet', 'Carte Rare', 'Pack Booster', 'Coleção Especial'][i],
  targetPrice: [45, 89.9, 219.9, 12.5, 18, 399][i],
  imageUrl: null,
  saleCategory: 'tcg',
}))

export default function AuthPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [products, setProducts] = useState([])
  const { loginGoogle } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = params.get('next') || '/'

  useEffect(() => {
    getDocs(query(collection(db, 'stock_items'), limit(24)))
      .then(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setProducts(docs.length >= 4 ? docs : PLACEHOLDER_CARDS)
      })
      .catch(() => setProducts(PLACEHOLDER_CARDS))
  }, [])

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

  const col1 = products.filter((_, i) => i % 3 === 0)
  const col2 = products.filter((_, i) => i % 3 === 1)
  const col3 = products.filter((_, i) => i % 3 === 2)

  return (
    <>
      <style>{`
        @keyframes showcaseUp {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes showcaseDown {
          0%   { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
      `}</style>

      <div className="h-screen bg-background flex overflow-hidden">

        {/* ── Left panel — Login ── */}
        <div className="relative z-10 w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col bg-background border-r border-outline-variant/60 shadow-[4px_0_32px_rgba(0,0,0,0.4)] h-full overflow-hidden">
          <header className="px-6 sm:px-8 py-5">
            <a href="/" className="flex items-center w-fit">
              <img src="/logo-completa.jpg" alt="BAD TCG" className="h-9 object-contain rounded" />
            </a>
          </header>

          <div className="flex-1 flex items-center justify-center pb-16 px-6 sm:px-8 py-10">
            <div className="w-full">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Bem-vindo</p>
                <h1 className="font-display text-2xl sm:text-3xl font-black text-on-surface leading-tight">
                  Entre na<br />BadTCG
                </h1>
                <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">
                  Faça login para acompanhar seus pedidos e receber novidades em primeira mão.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 active:scale-[.98] bg-surface-container-high border border-outline-variant hover:border-primary hover:bg-surface-container-highest text-on-surface shadow-sm"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loading ? 'Aguarde...' : 'Continuar com Google'}
                </button>

                {error && <p className="text-xs text-error text-center pt-1">{error}</p>}
              </div>

              <p className="text-[11px] text-on-surface-variant/50 mt-8 leading-relaxed">
                Ao entrar, você concorda com os termos de uso da plataforma.
              </p>
            </div>
          </div>

          {/* Decorative bottom gradient */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        </div>

        {/* ── Right panel — Product showcase ── */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden bg-surface-container-lowest">

          {/* Gradient fade edges */}
          <div className="absolute inset-x-0 top-0 h-32 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, #100c1b 0%, transparent 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-32 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to top, #100c1b 0%, transparent 100%)' }} />
          <div className="absolute inset-y-0 left-0 w-8 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, #100c1b 0%, transparent 100%)' }} />


          {/* Three scrolling columns */}
          {products.length > 0 && (
            <div className="flex gap-3 px-4 py-4 w-full overflow-hidden">
              {col1.length > 0 && (
                <div className="flex-1 overflow-hidden">
                  <ScrollColumn items={col1} direction="up" speed={32} offsetTop={0} />
                </div>
              )}
              {col2.length > 0 && (
                <div className="flex-1 overflow-hidden">
                  <ScrollColumn items={col2} direction="down" speed={26} offsetTop={-80} />
                </div>
              )}
              {col3.length > 0 && (
                <div className="flex-1 overflow-hidden">
                  <ScrollColumn items={col3} direction="up" speed={38} offsetTop={-40} />
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'

const STRIPES = {
  tcg:    ['#e2dfff', '#d7d2fb'],
  croche: ['#f0dbff', '#e6cdf7'],
}

function MiniCard({ item }) {
  const cat = item.saleCategory === 'croche' ? 'croche' : 'tcg'
  const [sA, sB] = STRIPES[cat]
  return (
    <div style={{ background: '#fff', border: '1px solid #c7c4d8', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ height: 110, backgroundImage: `repeating-linear-gradient(135deg,${sA} 0px,${sA} 8px,${sB} 8px,${sB} 16px)`, position: 'relative' }}>
        {item.imageUrl && (
          <img src={item.imageUrl} alt={item.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#191c1e', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
      </div>
    </div>
  )
}

const PLACEHOLDER_CARDS = Array.from({ length: 18 }, (_, i) => ({
  id: `ph-${i}`,
  name: ['Pikachu EX', 'Blister Triplo', 'ETB Scarlet', 'Carte Rare', 'Pack Booster', 'Coleção Especial', 'Charizard VMAX', 'Amigurumi Eevee', 'Chaveiro Snorlax', 'Blister Quádruplo', 'Mewtwo V', 'ETB Obsidian', 'Gengar EX', 'Pichu Baby', 'Rayquaza VMAX', 'Eevee Friends', 'Lucario V', 'Snorlax GX'][i],
  targetPrice: [45, 89.9, 219.9, 12.5, 18, 399, 159, 89.9, 39.9, 99, 55, 299, 79, 25, 189, 349, 65, 149][i],
  imageUrl: null,
  saleCategory: i % 5 === 4 ? 'croche' : 'tcg',
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
    getDocs(query(collection(db, 'stock_items'), limit(36)))
      .then(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setProducts(docs.length >= 6 ? docs : PLACEHOLDER_CARDS)
      })
      .catch(() => setProducts(PLACEHOLDER_CARDS))
  }, [])

  // Pack state
  const [opened, setOpened] = useState(false)
  const [bursting, setBursting] = useState(false)

  // 3D tilt
  const cardRef = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [gloss, setGloss] = useState({ x: 50, y: 50 })

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setTilt({ x: (y - 0.5) * 14, y: -(x - 0.5) * 14 })
    setGloss({ x: x * 100, y: y * 100 })
  }

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 })
    setGloss({ x: 50, y: 50 })
  }

  const handleTear = () => {
    if (opened || bursting) return
    setBursting(true)
    // flash → reveal
    setTimeout(() => {
      setOpened(true)
      setBursting(false)
    }, 420)
  }

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
    <div
      className="h-screen relative overflow-hidden flex items-center justify-center p-5"
      style={{ background: '#eceef0' }}
    >
      {/* Three-column static background */}
      <div className="absolute inset-0 flex gap-2.5 p-4 overflow-hidden" style={{ pointerEvents: 'none' }}>
        {[0, 1, 2].map(col => (
          <div key={col} className="flex-1 flex flex-col gap-2.5 overflow-hidden" style={{ marginTop: [0, -80, -40][col] }}>
            {[...products, ...products].filter((_, i) => i % 3 === col).slice(0, 14).map((item, i) => (
              <MiniCard key={`${item.id}-${col}-${i}`} item={item} />
            ))}
          </div>
        ))}
        <div className="absolute inset-0" style={{ background: 'rgba(236,238,240,0.78)', backdropFilter: 'blur(3px)' }} />
      </div>

      {/* Burst flash on tear */}
      {bursting && (
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50,
            animation: 'burstFlash 0.42s ease forwards',
            background: 'rgba(255,255,255,0)',
          }}
        />
      )}

      {/* Card */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative z-10 w-full select-none"
        style={{
          maxWidth: 320,
          borderRadius: 18,
          overflow: 'hidden',
          background: 'linear-gradient(165deg,#14121f 0%,#1c1830 55%,#191c1e 100%)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
          transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.5s cubic-bezier(0.23,1,0.32,1)',
          willChange: 'transform',
        }}
      >
        {/* Holographic sheen */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
          background: `radial-gradient(ellipse at ${gloss.x}% ${gloss.y}%, rgba(255,255,255,0.1) 0%, transparent 60%)`,
          mixBlendMode: 'screen',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 9, pointerEvents: 'none', opacity: 0.1,
          background: `linear-gradient(${110 + tilt.y * 4}deg, transparent 25%, rgba(120,80,255,0.8) 40%, rgba(255,120,200,0.8) 50%, rgba(80,200,255,0.8) 60%, transparent 75%)`,
        }} />

        {/* ── TOP FLAP — animates away on tear ── */}
        <div
          style={{
            background: 'linear-gradient(180deg,#1a1730 0%,#14121f 100%)',
            transformOrigin: 'top center',
            animation: opened ? 'flapAway 0.4s cubic-bezier(0.4,0,0.6,1) forwards' : bursting ? 'flapShake 0.4s ease' : 'none',
          }}
        >
          {/* Color stripe */}
          <div style={{
            height: 7,
            background: 'repeating-linear-gradient(90deg,#3525cd 0 22px,#8127cf 22px 44px,#db2777 44px 66px)',
            filter: bursting ? 'brightness(2)' : 'brightness(1)',
            transition: 'filter 0.1s',
          }} />

          {/* Tear zone */}
          {!opened && (
            <div
              onClick={handleTear}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 24px',
                cursor: 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\'><text y=\'20\' font-size=\'18\'>✂️</text></svg>") 0 16, crosshair',
              }}
            >
              <div style={{
                flex: 1,
                borderTop: '1.5px dashed rgba(255,255,255,0.45)',
                filter: bursting ? 'drop-shadow(0 0 6px #fff)' : 'none',
                animation: !opened && !bursting ? 'dashPulse 2s ease-in-out infinite' : 'none',
              }} />
              <span style={{
                fontSize: 9, letterSpacing: '0.18em', whiteSpace: 'nowrap',
                color: bursting ? '#fff' : 'rgba(255,255,255,0.65)',
                textShadow: bursting ? '0 0 12px #fff' : 'none',
                animation: !opened && !bursting ? 'dashPulse 2s ease-in-out infinite' : 'none',
                transition: 'color 0.15s, text-shadow 0.15s',
              }}>
                RASGUE AQUI
              </span>
              <div style={{
                flex: 1,
                borderTop: '1.5px dashed rgba(255,255,255,0.45)',
                filter: bursting ? 'drop-shadow(0 0 6px #fff)' : 'none',
                animation: !opened && !bursting ? 'dashPulse 2s ease-in-out infinite' : 'none',
              }} />
            </div>
          )}
        </div>

        {/* ── CONTENT — revealed after tear ── */}
        <div
          style={{
            padding: '0 24px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            opacity: opened ? 1 : 0.35,
            filter: opened ? 'none' : 'blur(1.5px)',
            transform: opened ? 'translateY(0)' : 'translateY(4px)',
            animation: opened ? 'revealContent 0.5s cubic-bezier(0.34,1.3,0.64,1) 0.1s both' : 'none',
            transition: opened ? 'none' : 'opacity 0.2s, filter 0.2s',
            paddingTop: opened ? 20 : 14,
            pointerEvents: opened ? 'auto' : 'none',
          }}
        >
          <img
            src="/logo-gengar.png"
            alt="Gengar"
            style={{
              height: 88, objectFit: 'contain',
              filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.5))',
              animation: opened ? 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) 0.15s both' : 'none',
            }}
          />

          <div style={{ textAlign: 'center' }}>
            <h1 className="font-display font-extrabold text-white leading-snug" style={{ fontSize: 22, margin: '0 0 6px' }}>
              Abra seu acesso.
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', maxWidth: 240, margin: '0 auto', lineHeight: 1.6 }}>
              Toda conta nova vem com novidades e reestoques em primeira mão.
            </p>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-extrabold transition-all disabled:opacity-50 active:scale-[.98]"
            style={{ background: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 13, color: '#191c1e', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Aguarde...' : 'Continuar com Google'}
          </button>

          {error && <p style={{ fontSize: 12, color: '#fca5a5', margin: 0, textAlign: 'center' }}>{error}</p>}

          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', margin: 0, textAlign: 'center' }}>
            1 conta por treinador(a) · Termos de uso
          </p>
        </div>
      </div>

      <style>{`
        @keyframes flapAway {
          0%   { transform: translateY(0) rotateX(0deg); opacity: 1; }
          60%  { transform: translateY(-40px) rotateX(-55deg); opacity: 0.6; }
          100% { transform: translateY(-120px) rotateX(-90deg); opacity: 0; }
        }
        @keyframes flapShake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-3px); }
          40%     { transform: translateX(3px); }
          60%     { transform: translateX(-2px); }
          80%     { transform: translateX(2px); }
        }
        @keyframes revealContent {
          from { opacity: 0; transform: translateY(12px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes popIn {
          from { transform: scale(0.7) translateY(-10px); opacity: 0; }
          to   { transform: scale(1)   translateY(0);     opacity: 1; }
        }
        @keyframes dashPulse {
          0%,100% { opacity: 0.6; }
          50%     { opacity: 1;   }
        }
        @keyframes burstFlash {
          0%   { background: rgba(255,255,255,0);    }
          25%  { background: rgba(255,255,255,0.18); }
          100% { background: rgba(255,255,255,0);    }
        }
      `}</style>
    </div>
  )
}

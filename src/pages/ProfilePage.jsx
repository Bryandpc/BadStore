import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Profile is now part of the unified "Minha Conta" page at /meus-pedidos
// We just redirect there with the perfil tab active
export default function ProfilePage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/meus-pedidos?tab=perfil', { replace: true })
  }, [])
  return null
}

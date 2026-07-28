import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import StorePage from './pages/StorePage'
import CheckoutPage from './pages/CheckoutPage'
import AuthPage from './pages/AuthPage'
import CartDrawer from './components/CartDrawer'
import './index.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CartDrawer />
        <Routes>
          <Route path="/" element={<StorePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<AuthPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

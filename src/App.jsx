import { BrowserRouter, Routes, Route } from 'react-router-dom'
import StorePage from './pages/StorePage'
import CheckoutPage from './pages/CheckoutPage'
import CartDrawer from './components/CartDrawer'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <CartDrawer />
      <Routes>
        <Route path="/" element={<StorePage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
      </Routes>
    </BrowserRouter>
  )
}

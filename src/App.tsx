import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider } from './lib/auth'
import { arrivedToSetPassword, supabase } from './lib/supabase'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'

// Quem chega por link de convite ou de recuperação vai direto definir a senha.
function PasswordLinkRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    if (arrivedToSetPassword) navigate('/definir-senha', { replace: true })
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/definir-senha', { replace: true })
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PasswordLinkRedirect />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
          <Route path="/definir-senha" element={<SetPassword />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

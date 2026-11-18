import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthProvider } from './lib/auth'
import { consumeSetPasswordLink, supabase } from './lib/supabase'
import Admin from './pages/Admin'
import Catalog from './pages/Catalog'
import EditProfile from './pages/EditProfile'
import EssenceDetail from './pages/EssenceDetail'
import Feed from './pages/Feed'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Login from './pages/Login'
import Members from './pages/Members'
import MyEssences from './pages/MyEssences'
import NewEssence from './pages/NewEssence'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import Rankings from './pages/Rankings'
import Recommendations from './pages/Recommendations'
import SetPassword from './pages/SetPassword'
import Wishlist from './pages/Wishlist'

// Quem chega por link de convite ou de recuperação vai direto definir a senha.
function PasswordLinkRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    if (consumeSetPasswordLink()) navigate('/definir-senha', { replace: true })
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
            <Route path="/" element={<Feed />} />
            <Route path="/essencias" element={<Home />} />
            <Route path="/quero-provar" element={<Wishlist />} />
            <Route path="/nova" element={<NewEssence />} />
            <Route path="/essencia/:id" element={<EssenceDetail />} />
            <Route path="/minhas" element={<MyEssences />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/membros" element={<Members />} />
            <Route path="/perfil" element={<Profile />} />
            <Route path="/perfil/editar" element={<EditProfile />} />
            <Route path="/perfil/:id" element={<Profile />} />
            <Route path="/perfil/:id/essencias" element={<MyEssences />} />
            <Route path="/recomendacoes" element={<Recommendations />} />
            <Route path="/notificacoes" element={<Notifications />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/admin/catalogo" element={<Catalog />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

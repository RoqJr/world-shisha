import { Link, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { Spinner } from './ui'

// Área logada: redireciona para o login se não houver sessão.
export default function Layout() {
  const { session, profile, isAdmin, loading, signOut } = useAuth()
  const { theme, toggle } = useTheme()

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-black/90">
        <Link to="/" className="text-lg font-bold tracking-tight">World Shisha</Link>
        <div className="flex items-center gap-2 text-sm">
          {isAdmin && (
            <span className="rounded-full border border-current px-2 py-0.5 text-xs font-semibold uppercase">Admin</span>
          )}
          <button onClick={toggle} aria-label="Alternar tema" className="rounded-full border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">
            {theme === 'dark' ? '☀︎' : '☾'}
          </button>
          <button onClick={signOut} className="rounded-full border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">
            Sair
          </button>
        </div>
      </header>
      <main className="flex-1 px-4 py-6">
        {profile && <p className="mb-6 text-sm text-neutral-500">Olá, {profile.apelido || profile.nome}!</p>}
        <Outlet />
      </main>
    </div>
  )
}

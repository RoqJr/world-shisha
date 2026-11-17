import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import { Spinner } from './ui'

/** Quantas essências aguardam aprovação (só para admins). */
function usePendingCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!enabled) return
    const load = () =>
      supabase
        .from('essences')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(({ count }) => setCount(count ?? 0))
    load()
    window.addEventListener('pending-changed', load)
    return () => window.removeEventListener('pending-changed', load)
  }, [enabled, pathname])

  return count
}

// Área logada: redireciona para o login se não houver sessão.
export default function Layout() {
  const { session, isAdmin, loading, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const pending = usePendingCount(isAdmin)

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `shrink-0 rounded-full px-3 py-1.5 text-sm ${
      isActive ? 'bg-black font-semibold text-white dark:bg-white dark:text-black' : 'text-neutral-600 dark:text-neutral-400'
    }`

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-black/90">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight">World Shisha</Link>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={toggle} aria-label="Alternar tema" className="rounded-full border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">
              {theme === 'dark' ? '☀︎' : '☾'}
            </button>
            <button onClick={signOut} className="rounded-full border border-neutral-300 px-3 py-1.5 dark:border-neutral-700">
              Sair
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          <NavLink to="/" end className={navClass}>Essências</NavLink>
          <NavLink to="/nova" className={navClass}>Cadastrar</NavLink>
          <NavLink to="/minhas" className={navClass}>Minhas</NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={navClass}>
              Aprovações
              {pending > 0 && (
                <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">{pending}</span>
              )}
            </NavLink>
          )}
        </nav>
      </header>
      <main className="flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useUnreadCount } from '../lib/notifications'
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

function Badge({ n }: { n: number }) {
  if (n <= 0) return null
  return <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold leading-none text-white">{n}</span>
}

// Ícones simples em traço, seguindo o visual preto e branco
const icons: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  check: <path d="M4 12.5 9 17.5 20 6.5" />,
  users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  sun: <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />,
  user: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" />,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  bell: <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
}

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {icons[name]}
    </svg>
  )
}

// Área logada: redireciona para o login se não houver sessão.
export default function Layout() {
  const { session, profile, isAdmin, loading, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const pending = usePendingCount(isAdmin)
  const unread = useUnreadCount(!!session)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // Fecha o menu ao trocar de página e com a tecla Esc
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (session.user.user_metadata?.must_change_password) return <Navigate to="/definir-senha" replace />

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-3 ${
      isActive ? 'bg-black font-semibold text-white dark:bg-white dark:text-black' : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
    }`
  const buttonClass = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900'

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-2 py-2 backdrop-blur dark:border-neutral-800 dark:bg-black/90">
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="relative rounded-xl p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-900">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          {pending > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-red-600" />}
        </button>
        <Link to="/" className="flex-1 text-lg font-bold tracking-tight">World Shisha</Link>
        <Link to="/notificacoes" aria-label={unread ? `Notificações (${unread} novas)` : 'Notificações'} className="relative rounded-xl p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-900">
          <Icon name="bell" />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-red-600 px-1 py-0.5 text-center text-[11px] font-bold leading-none text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>
      </header>

      {/* Menu lateral */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col gap-1 bg-white p-3 shadow-xl transition-transform dark:bg-black dark:shadow-neutral-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Menu"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="mb-3 border-b border-neutral-200 px-3 pb-4 pt-2 dark:border-neutral-800">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">World Shisha</p>
          <p className="mt-2 truncate font-semibold">{profile?.apelido || profile?.nome}</p>
          {isAdmin && <p className="text-xs text-neutral-500">Administrador</p>}
        </div>

        <NavLink to="/" end className={itemClass}><Icon name="home" /> Essências</NavLink>
        <NavLink to="/nova" className={itemClass}><Icon name="plus" /> Cadastrar essência</NavLink>
        <NavLink to="/rankings" className={itemClass}><Icon name="trophy" /> Rankings</NavLink>
        <NavLink to="/recomendacoes" className={itemClass}><Icon name="send" /> Recomendações</NavLink>
        <NavLink to="/membros" className={itemClass}><Icon name="users" /> Membros</NavLink>
        <NavLink to="/perfil" end className={itemClass}><Icon name="user" /> Meu perfil</NavLink>

        {isAdmin && (
          <>
            <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Administração</p>
            <NavLink to="/admin" className={itemClass}>
              <Icon name="check" /> <span className="flex-1">Aprovações</span> <Badge n={pending} />
            </NavLink>
          </>
        )}

        <div className="mt-auto border-t border-neutral-200 pt-2 dark:border-neutral-800">
          <button onClick={toggle} className={buttonClass}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} /> {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button onClick={signOut} className={buttonClass}><Icon name="logout" /> Sair</button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

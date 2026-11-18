import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabase'

export type Notification = {
  id: number
  tipo: 'recommendation' | 'pending_essence' | 'essence_approved' | 'essence_rejected' | 'recommended_reviewed' | string
  payload: {
    essence_id?: number
    essence?: string
    from_id?: string
    from?: string
    mensagem?: string | null
    motivo?: string | null
    nota?: number
    nome?: string
    icone?: string
  }
  lida: boolean
  created_at: string
}

/** Avisa o sino que as notificações mudaram (ex.: foram lidas). */
export function notificationsChanged() {
  window.dispatchEvent(new Event('notifications-changed'))
}

/** Quantidade de notificações não lidas; atualiza ao trocar de página e a cada minuto. */
export function useUnreadCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!enabled) return
    const load = () =>
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('lida', false)
        .then(({ count }) => setCount(count ?? 0))
    load()
    const timer = setInterval(load, 60_000)
    window.addEventListener('notifications-changed', load)
    return () => {
      clearInterval(timer)
      window.removeEventListener('notifications-changed', load)
    }
  }, [enabled, pathname])

  return count
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} d`
  return new Date(iso).toLocaleDateString('pt-BR')
}

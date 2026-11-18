import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui'
import { formatNota } from '../lib/data'
import { notificationsChanged, timeAgo, type Notification } from '../lib/notifications'
import { supabase } from '../lib/supabase'

function describe(n: Notification): { text: ReactNode; detail?: string; to: string } {
  const p = n.payload
  const essence = <b>{p.essence}</b>
  const from = <b>{p.from ?? 'Alguém'}</b>
  const toEssence = p.essence_id ? `/essencia/${p.essence_id}` : '/'
  switch (n.tipo) {
    case 'recommendation':
      return { text: <>{from} recomendou {essence} para você</>, detail: p.mensagem ? `“${p.mensagem}”` : undefined, to: toEssence }
    case 'pending_essence':
      return { text: <>{from} cadastrou {essence}, que aguarda aprovação</>, to: '/admin' }
    case 'essence_approved':
      return { text: <>Sua essência {essence} foi aprovada 🎉</>, to: toEssence }
    case 'essence_rejected':
      return { text: <>Sua essência {essence} foi rejeitada</>, detail: p.motivo ? `Motivo: ${p.motivo}` : undefined, to: '/minhas' }
    case 'recommended_reviewed':
      return {
        text: <>{from} avaliou {essence}, que você recomendou{p.nota != null && <> · ★ {formatNota(Number(p.nota))}</>}</>,
        to: toEssence,
      }
    default:
      return { text: 'Nova notificação', to: '/' }
  }
}

export default function Notifications() {
  const [items, setItems] = useState<Notification[] | null>(null)

  useEffect(() => {
    supabase
      .from('notifications')
      .select('id, tipo, payload, lida, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(async ({ data }) => {
        setItems((data ?? []) as Notification[])
        // Abriu a tela: marca todas como lidas (as novas continuam destacadas nesta visita)
        if (data?.some((n) => !n.lida)) {
          await supabase.from('notifications').update({ lida: true }).eq('lida', false)
          notificationsChanged()
        }
      })
  }, [])

  async function clearAll() {
    if (!confirm('Apagar todas as notificações?')) return
    const ids = (items ?? []).map((n) => n.id)
    await supabase.from('notifications').delete().in('id', ids)
    setItems([])
    notificationsChanged()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
        {items && items.length > 0 && (
          <Button variant="ghost" onClick={clearAll} className="px-3! py-2! text-xs!">Limpar todas</Button>
        )}
      </div>
      {items === null && <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>}
      {items?.length === 0 && <p className="text-sm text-neutral-500">Nenhuma notificação por aqui.</p>}
      {items?.map((n) => {
        const d = describe(n)
        return (
          <Link
            key={n.id}
            to={d.to}
            className={`flex gap-3 rounded-2xl border p-4 ${
              n.lida ? 'border-neutral-200 dark:border-neutral-800' : 'border-current'
            }`}
          >
            {!n.lida && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-red-600" aria-label="Nova" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{d.text}</p>
              {d.detail && <p className="mt-1 text-sm text-neutral-500">{d.detail}</p>}
              <p className="mt-1 text-xs text-neutral-500">{timeAgo(n.created_at)}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

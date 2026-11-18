import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { EssencePhoto } from '../components/EssenceCard'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/notifications'
import { supabase } from '../lib/supabase'

type Person = { nome: string; apelido: string | null; avatar_url: string | null }
type Rec = {
  id: number
  mensagem: string | null
  created_at: string
  from_user: string
  from: Person | null
  essence: { id: number; nome: string; foto_url: string | null; brand: { nome: string } | null } | null
  recommendation_recipients: { to_user: string; to: Person | null }[]
}

const name = (p: Person | null) => p?.apelido || p?.nome || 'Membro'

export default function Recommendations() {
  const { session } = useAuth()
  const me = session!.user.id
  const [tab, setTab] = useState<'recebidas' | 'enviadas'>('recebidas')
  const [recs, setRecs] = useState<Rec[] | null>(null)

  useEffect(() => {
    supabase
      .from('recommendations')
      .select(
        'id, mensagem, created_at, from_user, from:profiles!recommendations_from_user_fkey(nome, apelido, avatar_url), essence:essences(id, nome, foto_url, brand:brands(nome)), recommendation_recipients(to_user, to:profiles(nome, apelido, avatar_url))',
      )
      .order('created_at', { ascending: false })
      .then(({ data }) => setRecs((data ?? []) as unknown as Rec[]))
  }, [])

  const list = (recs ?? []).filter((r) => (tab === 'enviadas' ? r.from_user === me : r.from_user !== me))
  const tabClass = (on: boolean) =>
    `flex-1 rounded-xl px-3 py-2 text-sm ${on ? 'bg-black font-semibold text-white dark:bg-white dark:text-black' : ''}`

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Recomendações</h1>
      <div className="flex gap-1 rounded-2xl border border-neutral-200 p-1 dark:border-neutral-800">
        <button className={tabClass(tab === 'recebidas')} onClick={() => setTab('recebidas')}>Recebidas</button>
        <button className={tabClass(tab === 'enviadas')} onClick={() => setTab('enviadas')}>Enviadas</button>
      </div>

      {recs === null && <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>}
      {recs && list.length === 0 && (
        <p className="text-sm text-neutral-500">
          {tab === 'recebidas'
            ? 'Ninguém te recomendou nada ainda.'
            : 'Você ainda não recomendou nenhuma essência. Abra uma essência e toque em “Recomendar”.'}
        </p>
      )}

      {list.map((r) => (
        <div key={r.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-sm">
            {tab === 'recebidas' ? (
              <>
                <Link to={`/perfil/${r.from_user}`} className="flex items-center gap-2 font-semibold">
                  <Avatar url={r.from?.avatar_url} name={name(r.from)} size={28} /> {name(r.from)}
                </Link>
                <span className="text-neutral-500">recomendou</span>
              </>
            ) : (
              <span className="text-neutral-500">
                Para <b className="text-black dark:text-white">{r.recommendation_recipients.map((x) => name(x.to)).join(', ')}</b>
              </span>
            )}
            <span className="ml-auto shrink-0 text-xs text-neutral-500">{timeAgo(r.created_at)}</span>
          </div>
          {r.essence && (
            <Link to={`/essencia/${r.essence.id}`} className="flex items-center gap-3">
              <EssencePhoto url={r.essence.foto_url} className="w-14! shrink-0 rounded-lg text-xl" />
              <div className="min-w-0">
                <p className="truncate text-xs uppercase tracking-wide text-neutral-500">{r.essence.brand?.nome}</p>
                <p className="truncate font-semibold">{r.essence.nome}</p>
              </div>
            </Link>
          )}
          {r.mensagem && <p className="whitespace-pre-line text-sm text-neutral-700 dark:text-neutral-300">“{r.mensagem}”</p>}
        </div>
      ))}
    </div>
  )
}

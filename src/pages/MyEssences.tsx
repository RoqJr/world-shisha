import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EssencePhoto } from '../components/EssenceCard'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../lib/auth'
import { ESSENCE_SELECT, type Essence } from '../lib/data'
import { supabase } from '../lib/supabase'

export default function MyEssences() {
  const { session } = useAuth()
  const params = useParams()
  const userId = params.id ?? session!.user.id
  const isMe = userId === session!.user.id
  const [essences, setEssences] = useState<Essence[] | null>(null)
  const [ownerName, setOwnerName] = useState('')

  useEffect(() => {
    // Para visitantes, o banco só devolve as aprovadas
    supabase
      .from('essences')
      .select(ESSENCE_SELECT)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEssences((data ?? []) as unknown as Essence[]))
    if (!isMe)
      supabase
        .from('profiles')
        .select('nome, apelido')
        .eq('id', userId)
        .maybeSingle()
        .then(({ data }) => setOwnerName(data?.apelido || data?.nome || ''))
  }, [userId, isMe])

  return (
    <div className="flex flex-col gap-4">
      <Link to={isMe ? '/perfil' : `/perfil/${userId}`} className="text-sm text-neutral-500">
        ← {isMe ? 'Meu perfil' : `Perfil de ${ownerName || 'membro'}`}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{isMe ? 'Minhas essências' : 'Essências cadastradas'}</h1>
      {essences === null && <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>}
      {essences?.length === 0 && (
        <p className="text-sm text-neutral-500">
          {isMe ? (
            <>Você ainda não cadastrou nenhuma essência. <Link to="/nova" className="underline underline-offset-4">Cadastrar</Link></>
          ) : (
            'Este membro ainda não tem essências cadastradas.'
          )}
        </p>
      )}
      {essences?.map((e) => (
        <Link key={e.id} to={`/essencia/${e.id}`} className="flex gap-3 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
          <EssencePhoto url={e.foto_url} className="w-20! shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{e.brand?.nome}</p>
            <p className="font-semibold">{e.nome}</p>
            {e.status !== 'approved' && <div><StatusBadge status={e.status} /></div>}
            {e.status === 'rejected' && e.motivo_rejeicao && (
              <p className="text-sm text-red-600 dark:text-red-400">Motivo: {e.motivo_rejeicao}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

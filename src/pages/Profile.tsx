import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { EssencePhoto } from '../components/EssenceCard'
import { Stars } from '../components/Stars'
import { useAuth, type Profile as ProfileType } from '../lib/auth'
import { formatNota, useCatalog } from '../lib/data'
import { supabase } from '../lib/supabase'

type EssenceLite = { id: number; nome: string; foto_url: string | null; brand: { nome: string } | null; essence_tags?: { tag_id: number }[] }
type UserReview = { id: number; nota: number; observacao: string | null; updated_at: string; essence: EssenceLite | null }
type Top = { posicao: number; essence: EssenceLite | null }

function mostCommon(values: string[]) {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: string | null = null
  let max = 0
  for (const [v, c] of counts) if (c > max) [best, max] = [v, c]
  return best
}

export default function Profile() {
  const params = useParams()
  const { session } = useAuth()
  const { tags } = useCatalog()
  const id = params.id ?? session!.user.id
  const isMe = id === session!.user.id

  const [profile, setProfile] = useState<ProfileType | null | undefined>(undefined)
  const [reviews, setReviews] = useState<UserReview[]>([])
  const [top, setTop] = useState<Top[]>([])

  useEffect(() => {
    const essenceCols = 'id, nome, foto_url, brand:brands(nome)'
    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('reviews')
        .select(`id, nota, observacao, updated_at, essence:essences(${essenceCols}, essence_tags(tag_id))`)
        .eq('user_id', id)
        .order('updated_at', { ascending: false }),
      supabase.from('top5').select(`posicao, essence:essences(${essenceCols})`).eq('user_id', id).order('posicao'),
    ]).then(([p, r, t]) => {
      setProfile((p.data ?? null) as ProfileType | null)
      setReviews((r.data ?? []) as unknown as UserReview[])
      setTop((t.data ?? []) as unknown as Top[])
    })
  }, [id])

  const stats = useMemo(() => {
    const total = reviews.length
    const media = total ? reviews.reduce((s, r) => s + Number(r.nota), 0) / total : 0
    const marca = mostCommon(reviews.map((r) => r.essence?.brand?.nome).filter((x): x is string => !!x))
    // Tag preferida: a que soma mais pontos nas avaliações
    const tagScore = new Map<number, number>()
    for (const r of reviews)
      for (const et of r.essence?.essence_tags ?? []) tagScore.set(et.tag_id, (tagScore.get(et.tag_id) ?? 0) + Number(r.nota))
    const topTag = [...tagScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const tag = tags.find((t) => t.id === topTag)?.nome ?? null
    return { total, media, marca, tag }
  }, [reviews, tags])

  if (profile === undefined) return <p className="py-10 text-center text-sm text-neutral-500">Carregando…</p>
  if (profile === null) return <p className="py-10 text-center">Membro não encontrado.</p>

  const name = profile.apelido || profile.nome

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-center gap-3 text-center">
        <Avatar url={profile.avatar_url} name={name} size={96} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          {profile.apelido && <p className="text-sm text-neutral-500">{profile.nome}</p>}
          {profile.role === 'admin' && <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">Administrador</p>}
        </div>
        {profile.bio && <p className="max-w-md whitespace-pre-line text-neutral-700 dark:text-neutral-300">{profile.bio}</p>}
        {isMe && (
          <Link to="/perfil/editar" className="rounded-xl border border-current px-4 py-2 text-sm font-semibold">Editar perfil</Link>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Avaliações', String(stats.total)],
          ['Nota média', stats.total ? formatNota(stats.media) : '–'],
          ['Marca mais avaliada', stats.marca ?? '–'],
          ['Tag preferida', stats.tag ?? '–'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="mt-1 truncate text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Top 5</h2>
        {top.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {isMe ? (
              <>Você ainda não montou seu Top 5. <Link to="/perfil/editar" className="underline underline-offset-4">Montar agora</Link></>
            ) : (
              'Ainda não montou o Top 5.'
            )}
          </p>
        ) : (
          top.map(
            (t) =>
              t.essence && (
                <Link key={t.posicao} to={`/essencia/${t.essence.id}`} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-2 pr-4 dark:border-neutral-800">
                  <span className="w-8 text-center text-2xl font-bold tabular-nums text-neutral-400">{t.posicao}</span>
                  <EssencePhoto url={t.essence.foto_url} className="w-12! shrink-0 rounded-lg text-xl" />
                  <div className="min-w-0">
                    <p className="truncate text-xs uppercase tracking-wide text-neutral-500">{t.essence.brand?.nome}</p>
                    <p className="truncate font-semibold">{t.essence.nome}</p>
                  </div>
                </Link>
              ),
          )
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Avaliações</h2>
        {reviews.length === 0 && <p className="text-sm text-neutral-500">Nenhuma avaliação ainda.</p>}
        {reviews.map(
          (r) =>
            r.essence && (
              <Link key={r.id} to={`/essencia/${r.essence.id}`} className="flex gap-3 rounded-2xl border border-neutral-200 p-2 pr-4 dark:border-neutral-800">
                <EssencePhoto url={r.essence.foto_url} className="w-14! shrink-0 rounded-lg text-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs uppercase tracking-wide text-neutral-500">{r.essence.brand?.nome}</p>
                  <p className="truncate font-semibold">{r.essence.nome}</p>
                  <p className="flex items-center gap-1.5 text-sm tabular-nums">
                    <Stars value={Number(r.nota)} size={13} /> {formatNota(Number(r.nota))}
                  </p>
                  {r.observacao && <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{r.observacao}</p>}
                </div>
              </Link>
            ),
        )}
      </section>
    </div>
  )
}

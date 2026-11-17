import { Link } from 'react-router-dom'
import { formatNota, type Essence, type Rating } from '../lib/data'
import { Stars } from './Stars'

export function EssencePhoto({ url, className = '' }: { url: string | null; className?: string }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className={`aspect-square w-full object-cover ${className}`} />
  ) : (
    <div className={`flex aspect-square w-full items-center justify-center bg-neutral-100 text-4xl text-neutral-400 dark:bg-neutral-900 ${className}`}>
      ☁︎
    </div>
  )
}

/** Linha da visualização em lista: foto pequena à esquerda. */
export function EssenceRow({ essence, rating }: { essence: Essence; rating?: Rating }) {
  return (
    <Link to={`/essencia/${essence.id}`} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-2 pr-4 dark:border-neutral-800">
      <EssencePhoto url={essence.foto_url} className="w-16! shrink-0 rounded-xl text-2xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs uppercase tracking-wide text-neutral-500">{essence.brand?.nome}</p>
        <p className="truncate font-semibold">{essence.nome}</p>
      </div>
      <div className="shrink-0 text-right text-xs text-neutral-500">
        {rating ? (
          <>
            <p className="text-base font-semibold text-black tabular-nums dark:text-white">★ {formatNota(Number(rating.media))}</p>
            <p>{rating.total} {rating.total === 1 ? 'avaliação' : 'avaliações'}</p>
          </>
        ) : (
          <p>Sem avaliações</p>
        )}
      </div>
    </Link>
  )
}

export default function EssenceCard({ essence, rating }: { essence: Essence; rating?: Rating }) {
  return (
    <Link to={`/essencia/${essence.id}`} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <EssencePhoto url={essence.foto_url} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{essence.brand?.nome}</p>
        <p className="font-semibold leading-tight">{essence.nome}</p>
        <div className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-neutral-500">
          {rating ? (
            <>
              <Stars value={Number(rating.media)} size={12} />
              <span className="tabular-nums">
                {formatNota(Number(rating.media))} ({rating.total})
              </span>
            </>
          ) : (
            <span>Sem avaliações</span>
          )}
        </div>
      </div>
    </Link>
  )
}

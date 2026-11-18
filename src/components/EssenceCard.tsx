import { Link } from 'react-router-dom'
import { formatNota, type Essence, type Rating } from '../lib/data'
import { Stars } from './Stars'
import { WishIcon } from './WishButton'

type CardProps = { essence: Essence; rating?: Rating; wished?: boolean; onWish?: () => void }

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
export function EssenceRow({ essence, rating, wished, onWish }: CardProps) {
  return (
    <Link to={`/essencia/${essence.id}`} className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-2 pr-3 dark:border-neutral-800">
      <EssencePhoto url={essence.foto_url} className="w-16! shrink-0 rounded-xl text-2xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] uppercase tracking-wide text-neutral-500">{essence.brand?.nome}</p>
        <p className="truncate text-sm font-semibold leading-snug">{essence.nome}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500 tabular-nums">
          {rating ? (
            <>
              <Stars value={Number(rating.media)} size={11} />
              <span>
                {formatNota(Number(rating.media))} · {rating.total} {rating.total === 1 ? 'avaliação' : 'avaliações'}
              </span>
            </>
          ) : (
            'Sem avaliações'
          )}
        </p>
      </div>
      {onWish && <WishIcon on={!!wished} onToggle={onWish} />}
    </Link>
  )
}

export default function EssenceCard({ essence, rating, wished, onWish }: CardProps) {
  return (
    <Link to={`/essencia/${essence.id}`} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <div className="relative">
        <EssencePhoto url={essence.foto_url} />
        {onWish && (
          <div className="absolute right-2 top-2">
            <WishIcon on={!!wished} onToggle={onWish} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[11px] uppercase tracking-wide text-neutral-500">{essence.brand?.nome}</p>
        <p className="text-sm font-semibold leading-tight">{essence.nome}</p>
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

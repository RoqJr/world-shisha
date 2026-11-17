import { formatNota } from '../lib/data'

const STAR_PATH =
  'M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z'

function Star({ fill, size }: { fill: number; size: number }) {
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0 text-neutral-300 dark:text-neutral-700">
        <path d={STAR_PATH} fill="currentColor" />
      </svg>
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 24 24" width={size} height={size}>
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      </span>
    </span>
  )
}

/** Mostra a nota com estrelas (aceita frações). */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Nota ${formatNota(value)} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={Math.max(0, Math.min(1, value - i))} size={size} />
      ))}
    </span>
  )
}

/** Escolha da nota em passos de meia estrela: metade esquerda = x,5. */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const size = 40
  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="relative">
            <Star fill={Math.max(0, Math.min(1, value - (n - 1)))} size={size} />
            <button
              type="button"
              aria-label={`${formatNota(n - 0.5)} estrelas`}
              onClick={() => onChange(n - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              aria-label={`${n} estrelas`}
              onClick={() => onChange(n)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        ))}
      </div>
      <span className="min-w-8 text-lg font-semibold tabular-nums">{value ? formatNota(value) : '–'}</span>
    </div>
  )
}

import type { MouseEvent } from 'react'

function Bookmark({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

type Props = { on: boolean; onToggle: () => void }

const stop = (fn: () => void) => (e: MouseEvent) => {
  // Dentro de cards que são links: não abre a essência ao tocar no botão
  e.preventDefault()
  e.stopPropagation()
  fn()
}

/** Botão redondo pequeno, para ficar sobre a foto dos cards. */
export function WishIcon({ on, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={stop(onToggle)}
      aria-pressed={on}
      aria-label={on ? 'Remover de Quero provar' : 'Adicionar a Quero provar'}
      title={on ? 'Remover de Quero provar' : 'Quero provar'}
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-black shadow-sm backdrop-blur dark:bg-black/80 dark:text-white"
    >
      <Bookmark filled={on} size={18} />
    </button>
  )
}

/** Botão com texto, para a página da essência. */
export function WishButton({ on, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={stop(onToggle)}
      aria-pressed={on}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
        on ? 'border-current bg-black text-white dark:bg-white dark:text-black' : 'border-current'
      }`}
    >
      <Bookmark filled={on} size={16} />
      {on ? 'Na minha lista' : 'Quero provar'}
    </button>
  )
}

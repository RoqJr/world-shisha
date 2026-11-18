import Logo from './Logo'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-left text-sm font-medium">
      {label}
      <input
        {...props}
        className="rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-base font-normal outline-none focus:border-current dark:border-neutral-700"
      />
    </label>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const styles =
    variant === 'primary'
      ? 'bg-black text-white dark:bg-white dark:text-black'
      : 'border border-current'
  return (
    <button
      {...props}
      className={`rounded-xl px-5 py-3 text-sm font-semibold transition-opacity disabled:opacity-50 ${styles} ${className}`}
    />
  )
}

export function Alert({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  const styles =
    kind === 'error'
      ? 'border-red-500 text-red-600 dark:text-red-400'
      : 'border-green-600 text-green-700 dark:text-green-400'
  return <p className={`rounded-xl border px-4 py-3 text-left text-sm ${styles}`}>{children}</p>
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <header className="text-center">
        <Logo size={64} className="mx-auto mb-3 block" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">World Shisha</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>}
      </header>
      {children}
    </main>
  )
}

export function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </div>
  )
}

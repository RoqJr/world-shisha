import type { EssenceStatus } from '../lib/data'

const labels: Record<EssenceStatus, string> = {
  pending: 'Aguardando aprovação',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
}

const styles: Record<EssenceStatus, string> = {
  pending: 'border-amber-500 text-amber-700 dark:text-amber-400',
  approved: 'border-green-600 text-green-700 dark:text-green-400',
  rejected: 'border-red-500 text-red-600 dark:text-red-400',
}

export default function StatusBadge({ status }: { status: EssenceStatus }) {
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

export default function Avatar({ url, name, size = 40 }: { url?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 }
  return url ? (
    <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  ) : (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-neutral-200 font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

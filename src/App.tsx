import { useTheme } from './lib/theme'

export default function App() {
  const { theme, toggle } = useTheme()

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">World Shisha</h1>
      <p className="text-neutral-500">Avalie e descubra essências de narguilé.</p>
      <button
        onClick={toggle}
        className="rounded-full border border-current px-5 py-2 text-sm font-medium"
      >
        {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      </button>
    </main>
  )
}

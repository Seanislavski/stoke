import StokeWordmark from '@/components/StokeWordmark'

// Shown the instant a guide link is clicked. Without it the App Router keeps the
// previous page on screen until the guide has finished rendering on the server,
// so the menu click looked like it had done nothing (09/21/2026). Covers
// /guide, /guide/capture and /guide/discord.
export default function GuideLoading() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <StokeWordmark iconSize={28} />
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12 space-y-4 animate-pulse" aria-busy="true">
        <p className="text-sm text-stone-400">Opening the guide…</p>
        <div className="h-8 w-2/3 rounded bg-stone-200" />
        <div className="h-4 w-full rounded bg-stone-200" />
        <div className="h-4 w-5/6 rounded bg-stone-200" />
        <div className="h-4 w-4/6 rounded bg-stone-200" />
      </main>
    </div>
  )
}

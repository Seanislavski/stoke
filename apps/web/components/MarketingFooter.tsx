import Link from 'next/link'

export default function MarketingFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white py-6">
      <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-stone-400">
        <span>© {new Date().getFullYear()} Stoke Community</span>
        <div className="flex items-center gap-4">
          <Link href="/about" className="hover:text-stone-600 transition-colors">About</Link>
          <Link href="/changelog" className="hover:text-stone-600 transition-colors">What&apos;s new</Link>
          <Link href="/privacy" className="hover:text-stone-600 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-stone-600 transition-colors">Terms of Service</Link>
        </div>
      </div>
    </footer>
  )
}

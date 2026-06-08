import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Stoke Community collects, uses, and protects your information.',
  openGraph: {
    title: 'Privacy Policy — Stoke Community',
    url: 'https://stoke.community/privacy',
  },
}

export default async function PrivacyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href={user ? '/home' : '/'}>
            <StokeWordmark iconSize={28} />
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/home" className="text-sm text-stone-600 hover:text-stone-900 font-medium transition-colors">
                Home
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors font-medium">
                  Sign in
                </Link>
                <Link href="/signup" className="text-sm bg-orange-500 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-stone-400 mb-10">Last updated: June 7, 2026</p>

        <div className="prose prose-stone max-w-none space-y-8 text-stone-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">1. Who we are</h2>
            <p>
              Stoke Community (&ldquo;Stoke,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is an online platform for building reciprocal communities, accessible at{' '}
              <a href="https://stoke.community" className="text-orange-600 hover:underline">stoke.community</a>.
              This Privacy Policy explains how we collect, use, and protect your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">2. Information we collect</h2>
            <p className="mb-3">We collect information you provide directly to us:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account information:</strong> your email address and password when you create an account.</li>
              <li><strong>Profile information:</strong> display name, bio, avatar photo, and any links you choose to add to your profile.</li>
              <li><strong>Community content:</strong> posts, messages, comments, event details, resources, and other content you submit within communities.</li>
              <li><strong>Support tickets:</strong> messages and attachments you send through our support system.</li>
              <li><strong>Billing information:</strong> if you subscribe to a paid plan, payment details are collected and processed by Stripe. We do not store your full card number.</li>
            </ul>
            <p className="mt-3">We also collect limited technical information automatically:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your IP address and browser type for security and abuse prevention.</li>
              <li>Usage patterns (pages visited, features used) to improve the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">3. How we use your information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To operate, maintain, and improve the Stoke platform.</li>
              <li>To authenticate your account and keep it secure.</li>
              <li>To send you notifications related to your communities and activity (you can control these in settings).</li>
              <li>To process subscription payments and send billing-related communications.</li>
              <li>To respond to support requests.</li>
              <li>To detect and prevent fraud, abuse, and violations of our Terms of Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">4. Information we share</h2>
            <p className="mb-3">
              We do not sell your personal information. We share your information only in these limited circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Within communities:</strong> your display name, avatar, and community content are visible to other members of communities you join, according to each community&rsquo;s settings.
              </li>
              <li>
                <strong>Service providers:</strong> we use Supabase (database and authentication), Stripe (payments), and Resend (transactional email). Each operates under their own privacy policies and processes data only as needed to provide their services.
              </li>
              <li>
                <strong>Legal requirements:</strong> we may disclose information if required by law or to protect the rights and safety of our users.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">5. Your choices and rights</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Profile visibility:</strong> you can choose whether your community memberships appear on your public profile.</li>
              <li><strong>Email notifications:</strong> community organizers send emails through Stoke; every email includes an unsubscribe link for that community.</li>
              <li><strong>Account deletion:</strong> you can request deletion of your account and associated personal data by contacting us. Community content (posts, messages) may be retained in anonymized form to preserve the integrity of community discussions.</li>
              <li><strong>Data access:</strong> you can request a copy of the personal data we hold about you by reaching out through our support system.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">6. Data retention</h2>
            <p>
              We retain your account information for as long as your account is active. If you request account deletion, we will remove your personal data within 30 days, except where retention is required by law or for legitimate business purposes (such as fraud prevention or resolving disputes).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">7. Security</h2>
            <p>
              We take reasonable technical and organizational measures to protect your information against unauthorized access, loss, or misuse. Passwords are hashed and never stored in plain text. However, no internet transmission is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">8. Children</h2>
            <p>
              Stoke is not directed at children under 16. We do not knowingly collect personal information from anyone under 16. If you believe a minor has created an account, please contact us and we will remove it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">9. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email or by posting a notice on the platform before the changes take effect. Continued use of Stoke after changes become effective constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">10. Contact us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy or how we handle your data, please reach out through the{' '}
              <Link href={user ? '/support' : '/login'} className="text-orange-600 hover:underline">
                support portal
              </Link>{' '}
              or email us directly at{' '}
              <a href="mailto:support@stoke.community" className="text-orange-600 hover:underline">
                support@stoke.community
              </a>.
            </p>
          </section>

        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}

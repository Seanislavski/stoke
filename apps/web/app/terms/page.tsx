import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StokeWordmark from '@/components/StokeWordmark'
import MarketingFooter from '@/components/MarketingFooter'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms and conditions for using Stoke Community.',
  openGraph: {
    title: 'Terms of Service — Stoke Community',
    url: 'https://stoke.community/terms',
  },
}

export default async function TermsPage() {
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
        <h1 className="text-3xl font-bold text-stone-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-stone-400 mb-10">Last updated: June 7, 2026</p>

        <div className="prose prose-stone max-w-none space-y-8 text-stone-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">1. Acceptance of terms</h2>
            <p>
              By creating an account or using Stoke Community (&ldquo;Stoke,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) at{' '}
              <a href="https://stoke.community" className="text-orange-600 hover:underline">stoke.community</a>,
              you agree to these Terms of Service. If you do not agree, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">2. Eligibility</h2>
            <p>
              You must be at least 16 years old to use Stoke. By using the platform, you represent that you meet this requirement. If you are under 18, you represent that a parent or legal guardian has reviewed and agreed to these terms on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">3. Your account</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You may not share your account with others or create accounts on behalf of someone else without their consent.</li>
              <li>You must provide accurate information when creating your account.</li>
              <li>Notify us immediately at{' '}
                <a href="mailto:support@stoke.community" className="text-orange-600 hover:underline">support@stoke.community</a>{' '}
                if you believe your account has been compromised.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">4. Acceptable use</h2>
            <p className="mb-3">You agree not to use Stoke to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Post content that is illegal, harmful, threatening, abusive, harassing, defamatory, or discriminatory.</li>
              <li>Share content that infringes on the intellectual property rights of others.</li>
              <li>Distribute spam, unsolicited messages, or malicious software.</li>
              <li>Impersonate another person or misrepresent your affiliation with any entity.</li>
              <li>Scrape, crawl, or extract data from Stoke without our written permission.</li>
              <li>Attempt to circumvent security measures or gain unauthorized access to any part of the platform.</li>
              <li>Use Stoke for any purpose that violates applicable laws or regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">5. Community rules</h2>
            <p>
              Each community on Stoke may have its own rules set by the organizer. You agree to follow both these Terms of Service and the rules of any community you join. Violating a community&rsquo;s rules may result in removal from that community. Violating these Terms may result in suspension or termination of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">6. Your content</h2>
            <p className="mb-3">
              You retain ownership of the content you post on Stoke. By posting content, you grant us a non-exclusive, royalty-free license to display, store, and transmit that content as necessary to operate the platform.
            </p>
            <p>
              You are solely responsible for the content you post. We do not pre-screen content but reserve the right to remove any content that violates these Terms or that we determine, at our discretion, is harmful to the platform or its users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">7. Subscriptions and billing</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Paid plans (Starter and Pro) are billed monthly through Stripe.</li>
              <li>You may cancel your subscription at any time from your billing settings. Cancellation takes effect at the end of the current billing period.</li>
              <li>We do not offer refunds for partial billing periods, except where required by applicable law.</li>
              <li>We reserve the right to change pricing with at least 30 days&rsquo; notice. Price changes will not affect your current billing period.</li>
              <li>Free plan limits apply to new activity; communities and members created before a limit was introduced are not retroactively removed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">8. Termination</h2>
            <p className="mb-3">
              You may delete your account at any time. We may suspend or terminate your account if you violate these Terms, engage in harmful behavior, or for any other reason at our discretion, with or without notice.
            </p>
            <p>
              Upon termination, your access to the platform will end immediately. Content you have posted may remain visible to other users depending on community settings and our data retention practices.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">9. Disclaimers</h2>
            <p>
              Stoke is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied. We do not guarantee that the platform will be available at all times, error-free, or free of viruses or other harmful components. We are not responsible for the content posted by users or the conduct of community organizers and members.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">10. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, Stoke Community and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of (or inability to use) the platform, even if we have been advised of the possibility of such damages. Our total liability for any claim arising from your use of Stoke shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">11. Changes to these terms</h2>
            <p>
              We may update these Terms from time to time. If we make material changes, we will notify you by email or by posting a prominent notice on the platform at least 14 days before the changes take effect. Continued use of Stoke after that date constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 mb-3">12. Contact us</h2>
            <p>
              Questions about these Terms? Reach us through the{' '}
              <Link href={user ? '/support' : '/login'} className="text-orange-600 hover:underline">
                support portal
              </Link>{' '}
              or email{' '}
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

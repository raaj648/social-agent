import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <p className="text-lg text-muted-foreground">Last updated: May 19, 2026</p>

          <section>
            <h2 className="text-xl font-semibold mt-8">1. Introduction</h2>
            <p>SocialReply AI (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">2. Information We Collect</h2>
            <h3 className="font-medium mt-4">2.1 Personal Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, email address, and profile information when you register</li>
              <li>Facebook Page and Instagram Business account details you connect</li>
              <li>WhatsApp Business account information</li>
              <li>Customer messages and conversations processed through our platform</li>
            </ul>
            <h3 className="font-medium mt-4">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Usage data (pages visited, features used)</li>
              <li>Device and browser information</li>
              <li>IP address and location data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and maintain our AI auto-reply services</li>
              <li>To process and respond to customer messages via Facebook, Instagram, and WhatsApp</li>
              <li>To improve and optimize our AI responses</li>
              <li>To communicate with you about your account</li>
              <li>To ensure platform security and prevent abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">4. Data Sharing and Disclosure</h2>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Service Providers:</strong> Supabase (database hosting), OpenRouter (AI processing), Vercel (application hosting), Meta (Facebook/Instagram/WhatsApp APIs)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, sale, or acquisition</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">5. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>AES-256-GCM encryption for Meta access tokens</li>
              <li>Row-level security in PostgreSQL for data isolation</li>
              <li>Webhook signature verification (HMAC-SHA256)</li>
              <li>Rate limiting and quota management</li>
              <li>Encrypted connections (HTTPS/TLS)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">6. Data Retention</h2>
            <p>We retain your data for as long as your account is active. Upon account deletion, we delete your data within 30 days unless required to retain it for legal reasons.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">7. Your Rights</h2>
            <p>Depending on your location, you may have rights to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data</li>
              <li>Object to data processing</li>
              <li>Export your data</li>
              <li>Withdraw consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">8. Third-Party Services</h2>
            <p>Our platform integrates with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Meta Platforms (Facebook, Instagram, WhatsApp):</strong> Subject to Meta&apos;s privacy policy</li>
              <li><strong>OpenRouter:</strong> AI processing provider</li>
              <li><strong>Supabase:</strong> Database and authentication provider</li>
              <li><strong>Vercel:</strong> Hosting provider</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">9. Contact</h2>
            <p>For privacy-related inquiries, contact us at: privacy@socialreply.ai</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or through our platform.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
import Link from 'next/link';
import { Scale, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <p className="text-lg text-muted-foreground">Last updated: May 19, 2026</p>

          <section>
            <h2 className="text-xl font-semibold mt-8">1. Acceptance of Terms</h2>
            <p>By accessing or using SocialReply AI (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">2. Description of Service</h2>
            <p>SocialReply AI is a multi-tenant SaaS platform that provides AI-powered auto-reply services for Facebook Messenger, Instagram DMs, and WhatsApp Business. The Platform allows businesses to connect their social media accounts and automatically respond to customer messages using AI.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">3. User Responsibilities</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide accurate registration information</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Ensure your use complies with Meta&apos;s and WhatsApp&apos;s platform policies</li>
              <li>Review and approve AI-generated content before deployment</li>
              <li>Not use the Platform for spam, harassment, or illegal activities</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">4. AI-Generated Content</h2>
            <p>You acknowledge that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI responses are generated based on your knowledge base and settings</li>
              <li>You are responsible for the accuracy and appropriateness of AI responses</li>
              <li>The Platform is not liable for damages arising from AI-generated content</li>
              <li>You should monitor AI responses and maintain human oversight</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">5. Billing and Subscriptions</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>We offer various pricing plans as described on our website</li>
              <li>Fees are billed in advance on a monthly or annual basis</li>
              <li>No refunds for partial months of service</li>
              <li>We may change pricing with 30 days notice</li>
              <li>Accounts with unpaid fees may be suspended</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">6. Data and Privacy</h2>
            <p>Our data practices are described in our Privacy Policy. By using the Platform, you consent to our data practices as described therein.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, SocialReply AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">8. Termination</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You may terminate your account at any time</li>
              <li>We may suspend or terminate accounts for violations of these terms</li>
              <li>Upon termination, your data will be deleted within 30 days</li>
              <li>Sections on liability, privacy, and data survive termination</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">9. Service Level</h2>
            <p>We strive for 99.9% uptime but do not guarantee uninterrupted service. The Platform may be unavailable for scheduled maintenance or unforeseen issues.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">10. Changes to Terms</h2>
            <p>We may modify these terms at any time. Changes are effective upon posting. Continued use of the Platform after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">11. Governing Law</h2>
            <p>These terms are governed by the laws of Bangladesh. Any disputes shall be resolved in the courts of Dhaka, Bangladesh.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8">12. Contact</h2>
            <p>For questions about these terms, contact: legal@socialreply.ai</p>
          </section>
        </div>
      </div>
    </div>
  );
}
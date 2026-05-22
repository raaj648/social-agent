'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Bot,
  MessageSquare,
  Facebook,
  Instagram,
  Zap,
  BookOpen,
  Settings,
  BarChart3,
  Shield,
  Globe,
  Clock,
  Sparkles,
  ChevronDown,
  Menu,
  X,
  Check,
  Star,
  ArrowRight,
} from 'lucide-react';
import type { BillingPlan } from '@/types';

const features = [
  { icon: Bot, title: 'AI-Powered Replies', desc: 'GPT-4, Claude, Gemini — choose the best model for your business. AI understands context and responds naturally.' },
  { icon: BookOpen, title: 'Smart Knowledge Base', desc: 'Train your AI with FAQs, pricing, policies. It pulls from your knowledge to give accurate answers.' },
  { icon: MessageSquare, title: 'Multi-Platform', desc: 'Works with Facebook Messenger and Instagram DMs. One dashboard to manage all conversations.' },
  { icon: Clock, title: '24/7 Automation', desc: 'Never miss a message. AI replies instantly, even outside business hours. Set business hours if you prefer.' },
  { icon: Settings, title: 'Fully Customizable', desc: 'Control tone, model, blacklist keywords, greeting messages. Make the AI sound like your brand.' },
  { icon: BarChart3, title: 'Analytics & Insights', desc: 'Track reply volume, tokens used, customer satisfaction. See how much time AI saves you.' },
  { icon: Shield, title: 'Enterprise Security', desc: 'End-to-end encryption for tokens, Row Level Security, and full audit logs. Your data stays yours.' },
  { icon: Globe, title: 'Multi-Tenant SaaS', desc: 'Built for agencies and businesses. Each client gets isolated workspaces with their own settings.' },
];

const steps = [
  { num: '01', title: 'Connect', desc: 'Link your Facebook Pages and Instagram Business accounts in one click.' },
  { num: '02', title: 'Train', desc: 'Add your FAQs, pricing, policies to the knowledge base. AI learns your business.' },
  { num: '03', title: 'Configure', desc: 'Pick an AI model, set tone, business hours, and blacklist keywords.' },
  { num: '04', title: 'Automate', desc: 'Sit back. AI handles customer messages 24/7. You focus on growing your business.' },
];

const faqs = [
  { q: 'Which platforms does SocialReply AI support?', a: 'Currently we support Facebook Messenger and Instagram DMs. WhatsApp support is coming soon.' },
  { q: 'Which AI models can I use?', a: 'You can choose from GPT-4, GPT-4o Mini, Claude 3 Haiku/Sonnet, Gemini Pro, Llama 3, and more via OpenRouter.' },
  { q: 'Is my data secure?', a: 'Absolutely. All tokens are encrypted with AES-256-GCM. We use Supabase Row Level Security for tenant isolation. Every action is logged.' },
  { q: 'Can I set business hours?', a: 'Yes. You can configure the AI to only reply during business hours, with a fallback message for after-hours.' },
  { q: 'How does the knowledge base work?', a: 'You add FAQs, pricing, policies, and business info. The AI reads relevant entries before crafting each reply, ensuring accuracy.' },
  { q: 'Can I cancel anytime?', a: 'Yes, no contracts. Cancel anytime from your settings. Your data is yours to export.' },
];

const defaultPlans = [
  {
    name: 'Free',
    price: '$0',
    desc: 'Perfect for testing the waters',
    features: ['1 Facebook Page', '100 AI replies/day', 'Basic knowledge base', 'Email support'],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Starter',
    price: '$19',
    desc: 'For growing businesses',
    features: ['3 Facebook Pages', '500 AI replies/day', 'Instagram DM support', 'Full knowledge base', 'Priority email support'],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    name: 'Pro',
    price: '$49',
    desc: 'For serious automation',
    features: ['10 Facebook Pages', '2,000 AI replies/day', 'Instagram + Messenger', 'Advanced analytics', 'Custom AI model', 'Priority chat support'],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Enterprise',
    price: '$149',
    desc: 'For agencies & large teams',
    features: ['Unlimited pages', '10,000 AI replies/day', 'All platforms', 'Custom branding', 'Dedicated support', 'SLA guarantee', 'API access'],
    cta: 'Contact Sales',
    popular: false,
  },
];

export default function Home() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [plans, setPlans] = useState(defaultPlans);

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(data => {
        if (data.plans && data.plans.length > 0) {
          setPlans(data.plans.map((p: BillingPlan) => ({
            name: p.name,
            price: `$${(p.price_monthly_cents / 100).toFixed(0)}`,
            desc: p.description || '',
            features: p.features || [],
            cta: p.slug === 'enterprise' ? 'Contact Sales' : 'Start Free Trial',
            popular: p.is_popular,
          })));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">SocialReply AI</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow">
                Get Started Free
              </Button>
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenu && (
          <div className="border-t bg-background p-4 md:hidden animate-slide-in">
            <nav className="flex flex-col gap-3">
              <Link href="#features" className="text-sm font-medium py-2" onClick={() => setMobileMenu(false)}>Features</Link>
              <Link href="#pricing" className="text-sm font-medium py-2" onClick={() => setMobileMenu(false)}>Pricing</Link>
              <Link href="#faq" className="text-sm font-medium py-2" onClick={() => setMobileMenu(false)}>FAQ</Link>
              <hr />
              <Link href="/login"><Button variant="outline" className="w-full">Log in</Button></Link>
              <Link href="/signup"><Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white">Get Started Free</Button></Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
          <div className="absolute inset-0 bg-grid" />
          <div className="absolute inset-0 bg-gradient-radial from-blue-500/5 via-transparent to-transparent" />
          <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground mb-8 animate-fade-in-up">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span>AI-Powered Customer Reply Automation</span>
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl animate-fade-in-up delay-100">
              Never Miss a{' '}
              <span className="text-gradient">Customer Message</span>
              {' '}Again
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl animate-fade-in-up delay-200">
              Connect your Facebook Pages and Instagram accounts. Train AI with your business knowledge.
              Let intelligent automation reply to customers 24/7 — like having a support team that never sleeps.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in-up delay-300">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-8 text-base bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="h-14 px-8 text-base">
                  See How It Works
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground animate-fade-in-up delay-400">
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> No credit card</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 14-day free trial</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Cancel anytime</div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Everything you need to{' '}
                <span className="text-gradient-blue">automate replies</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Powerful features that make customer communication effortless
              </p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group rounded-xl border bg-card p-6 card-hover animate-fade-in-up"
                    style={{ animationDelay: `${(i % 4) * 100 + Math.floor(i / 4) * 200}ms` }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t bg-muted/30 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Set up in{' '}
                <span className="text-gradient-blue">4 simple steps</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                From zero to automating replies in under 10 minutes
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-4">
              {steps.map((step, i) => (
                <div key={step.num} className="relative text-center animate-fade-in-up" style={{ animationDelay: `${i * 150}ms` }}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-xl font-bold text-white shadow-lg">
                    {step.num}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="absolute left-[60%] top-8 hidden w-full border-t-2 border-dashed border-muted-foreground/20 md:block" />
                  )}
                  <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Simple, <span className="text-gradient-blue">transparent</span> pricing
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Start free. Upgrade when you grow.
              </p>
            </div>

            <div className="mt-16 grid gap-6 lg:grid-cols-4">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-xl border p-6 card-hover ${plan.popular ? 'border-blue-500 shadow-lg' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-1 text-xs font-medium text-white">
                      Most Popular
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <div className="mt-4 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      {plan.name !== 'Enterprise' && <span className="text-muted-foreground">/mo</span>}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
                  </div>
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className="mt-8 block">
                    <Button
                      className={`w-full ${plan.popular ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' : ''}`}
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t bg-gradient-to-r from-blue-600 to-purple-600 py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to automate your customer replies?
            </h2>
            <p className="mt-4 text-lg text-blue-100">
              Join businesses saving hours every day. Start your free trial now — no credit card needed.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="h-14 px-10 text-base bg-white text-blue-700 hover:bg-blue-50 shadow-xl hover:shadow-2xl transition-all">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">
                Frequently asked <span className="text-gradient-blue">questions</span>
              </h2>
            </div>

            <div className="mt-12 space-y-4">
              {faqs.map((faq) => (
                <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold">SocialReply AI</span>
            </div>
            <nav className="flex gap-6 text-sm text-muted-foreground">
              <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
              <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link href="#faq" className="hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </nav>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} SocialReply AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border">
      <button
        className="flex w-full items-center justify-between px-6 py-4 text-left font-medium"
        onClick={() => setOpen(!open)}
      >
        {question}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t px-6 py-4 text-sm text-muted-foreground leading-relaxed animate-slide-in">
          {answer}
        </div>
      )}
    </div>
  );
}

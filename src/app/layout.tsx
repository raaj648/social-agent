import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SocialReply AI — AI Auto Reply for Facebook & Instagram DMs',
  description:
    'Automate customer replies on Facebook Messenger and Instagram DMs with AI. Connect your pages, train the AI with your business info, and never miss a message.',
  keywords: ['AI auto reply', 'Facebook Messenger bot', 'Instagram DM automation', 'social media AI', 'customer service automation'],
  openGraph: {
    title: 'SocialReply AI — AI Auto Reply for Facebook & Instagram',
    description: 'Never miss a customer message. AI-powered auto reply 24/7.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import JsonLd, { OrganizationSchema, WebsiteSchema } from '@/components/seo/JsonLd';

const inter = Inter({ subsets: ['latin'] });

const BASE_URL = 'https://blueteeth.vercel.app';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1e40af',
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Blueteeth | Doctor B-Points Clinical Reward System',
    template: '%s | Blueteeth Clinical Portal',
  },
  description:
    'Blueteeth is India\'s premier clinical reward portal. Doctors earn B-Points for every patient case submission and redeem them as real cash payouts. Join now!',
  keywords: [
    'doctor reward system India',
    'clinical B-points',
    'Blueteeth portal',
    'doctor points earn redeem',
    'medical reward program',
    'doctor payout system',
    'clinical case rewards',
    'B-points reward',
    'doctor incentive platform',
  ],
  authors: [{ name: 'Blueteeth Clinical Team' }],
  creator: 'Blueteeth',
  publisher: 'Blueteeth',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: BASE_URL,
    siteName: 'Blueteeth Clinical Portal',
    title: 'Blueteeth | Doctor B-Points Clinical Reward System',
    description:
      'India\'s premier clinical reward portal. Doctors earn B-Points for every patient case and redeem as real cash.',
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Blueteeth Clinical Reward Portal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blueteeth | Doctor B-Points Clinical Reward System',
    description:
      'India\'s premier clinical reward portal. Earn B-Points for every patient case. Redeem as cash.',
    images: [`${BASE_URL}/og-image.png`],
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: BASE_URL,
  },
  category: 'healthcare',
  verification: {
    google: '7QTfOWQ7btw3B0_79p8u9s34X_o9vA_w5kR9w_0R4Y4',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} bg-slate-50`} suppressHydrationWarning>
      <body className="antialiased text-slate-900 selection:bg-blue-100" suppressHydrationWarning>
        <AuthProvider>
          <JsonLd data={OrganizationSchema} />
          <JsonLd data={WebsiteSchema} />
          <Toaster position="top-center" reverseOrder={false} />
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

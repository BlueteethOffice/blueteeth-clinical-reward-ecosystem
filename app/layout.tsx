import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import JsonLd, { OrganizationSchema, WebsiteSchema } from '@/components/seo/JsonLd';

const inter = Inter({ subsets: ['latin'] });

const BASE_URL = 'https://blueteeth-clinical-reward-ecosystem.vercel.app';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1e40af',
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Blueteeth | Associate B-Points Reward System',
    template: '%s | Blueteeth Associate Portal',
  },
  description:
    'Blueteeth is India\'s premier associate reward portal. Associates earn B-Points for every case submission and redeem them as real cash payouts. Join now!',
  keywords: [
    'associate reward system India',
    'associate B-points',
    'Blueteeth portal',
    'associate points earn redeem',
    'referral reward program',
    'associate payout system',
    'case rewards India',
    'B-points reward',
    'associate incentive platform',
  ],
  authors: [{ name: 'Blueteeth Associate Team' }],
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
    siteName: 'Blueteeth Associate Portal',
    title: 'Blueteeth | Associate B-Points Reward System',
    description:
      'India\'s premier associate reward portal. Associates earn B-Points for every case and redeem as real cash.',
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Blueteeth Associate Reward Portal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blueteeth | Associate B-Points Reward System',
    description:
      'India\'s premier associate reward portal. Earn B-Points for every case. Redeem as cash.',
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

import Loading from './loading';

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
          <Suspense fallback={<Loading />}>
            {children}
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

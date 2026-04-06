import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Blueteeth B-Points Reward System',
  description: 'A premium reward portal for doctors to earn B-points based on patient cases.',
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
          <Toaster position="top-center" reverseOrder={false} />
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}

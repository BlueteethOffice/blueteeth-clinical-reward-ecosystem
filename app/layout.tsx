import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Blueteeth B-Points Reward System',
  description: 'A premium reward portal for doctors to earn B-points based on patient cases.',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} h-full bg-slate-50`} suppressHydrationWarning>
      <body className="h-full antialiased text-slate-900 selection:bg-blue-100" suppressHydrationWarning>
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

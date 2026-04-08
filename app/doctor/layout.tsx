import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Doctor Dashboard',
  description:
    'Blueteeth Doctor Dashboard — Track your B-Points, submitted cases, earnings, and real-time approval status. India\'s premier clinical reward portal.',
  robots: { index: false, follow: false }, // Private dashboard — Google index nahi karega
  openGraph: {
    title: 'Doctor Dashboard | Blueteeth Clinical Portal',
    description: 'Track your B-Points, cases, and earnings on Blueteeth.',
    url: 'https://blueteeth-clinical-reward-ecosystem.vercel.app/doctor',
  },
};

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

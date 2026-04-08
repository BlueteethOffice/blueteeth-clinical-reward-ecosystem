import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Doctor Login',
  description:
    'Login to Blueteeth Clinical Portal. Access your B-Points dashboard, track your cases, and redeem rewards securely.',
  openGraph: {
    title: 'Login | Blueteeth Clinical Portal',
    description: 'Secure login for doctors on Blueteeth — India\'s top clinical reward platform.',
    url: 'https://blueteeth-clinical-reward-ecosystem.vercel.app/auth/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

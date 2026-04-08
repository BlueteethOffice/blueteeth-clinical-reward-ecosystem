import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description:
    'Blueteeth Admin Control Panel — Review cases, manage doctors, track payouts and monitor system health.',
  robots: { index: false, follow: false }, // Admin pages — Google kabhi index nahi karega
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Coins, 
  Stethoscope, 
  ChevronRight, 
  Activity, 
  Target,
  Zap,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="relative isolate min-h-screen bg-slate-50 selection:bg-blue-100 overflow-x-hidden">
      {/* Premium Background Layer */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-slate-50">
        {/* Glow Orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-blue-400/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[35rem] h-[35rem] bg-indigo-400/10 rounded-full blur-[120px]" />
        
        {/* Soft Grid Pattern */}
        <svg
          className="absolute left-[50%] top-0 h-[64rem] w-[128rem] -translate-x-[50%] stroke-slate-200/40 [mask-image:radial-gradient(64rem_64rem_at_top,white,transparent)] opacity-60"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="grid-pattern"
              width={48}
              height={48}
              x="50%"
              y={-1}
              patternUnits="userSpaceOnUse"
            >
              <path d="M.5 200V.5H200" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern)" />
        </svg>
      </div>

      {/* Hero Orbs */}
      <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl overflow-hidden" aria-hidden="true">
        <div 
          className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-blue-300 to-indigo-400 opacity-[0.12]"
          style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}
        />
      </div>

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-600 p-1.5 shadow-blue-200 shadow-lg">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Blueteeth
              </span>
            </div>
            <div className="hidden sm:flex sm:items-center sm:gap-6">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">Doctor Login</Button>
              </Link>
              <Link href="/auth/login?flow=admin">
                <Button variant="primary" size="sm" className="rounded-xl">Admin Portal</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <div className="relative pt-6 lg:pt-10 pb-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 flex justify-center">
                <div className="relative rounded-xl px-4 py-1.5 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/10 hover:ring-slate-900/20 transition-all bg-white shadow-sm">
                  <span className="font-semibold text-blue-600">New:</span> V1.0.0 Stable Version released.{' '}
                  <a href="#" className="font-semibold text-blue-600">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Read more <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 sm:text-4xl tracking-tighter">
                The Premium <span className="text-blue-600 whitespace-nowrap">B-Points</span> <br className="sm:hidden" /> Rewards Portal
              </h1>

              <p className="mt-6 text-lg leading-8 text-slate-600">
                A specialized rewards ecosystem for professional dentists. 
                Monetize every successful patient case with transparent 
                payouts and comprehensive case tracking.
              </p>

              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link href="/auth/login">
                  <Button variant="primary" size="lg" className="rounded-xl shadow-xl shadow-blue-100 group">
                    Doctor Login
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/auth/login?flow=admin" className="text-sm font-semibold leading-6 text-slate-900 flex items-center group">
                  Admin Access 
                  <ChevronRight className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="mx-auto mt-20 max-w-7xl px-0 lg:px-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <FeatureCard 
                  icon={<Coins className="h-6 w-6" />}
                  title="Earn Points"
                  description="1 B-Point = ₹50. Earn up to 10 points per implant case. Instant reflection in your wallet."
                />
                <FeatureCard 
                  icon={<Zap className="h-6 w-6" />}
                  title="Quick Payouts"
                  description="Secure UPI/Bank transfers with a minimum ₹500 withdrawal. Processing within 24 hours."
                />
                <FeatureCard 
                  icon={<Activity className="h-6 w-6" />}
                  title="Real-time Tracking"
                  description="Comprehensive dashboard to track cases, status updates, and historical earnings records."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 py-10 bg-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div className="flex items-center gap-2">
                <div className="rounded bg-blue-600 p-1">
                  <Stethoscope className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-bold text-slate-900">Blueteeth Reward System</p>
              </div>
              <p className="text-sm text-slate-500">
                &copy; {new Date().getFullYear()} Blueteeth Ecosystem. All rights reserved.
              </p>
              <div className="flex gap-6">
                <span className="flex items-center text-xs font-semibold text-green-600 uppercase tracking-wider bg-green-50 px-2 py-1 rounded">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Secure Platform
                </span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="relative group overflow-hidden rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity blur-2xl" />
      <div className="mb-6 inline-flex rounded-xl bg-blue-50 p-3 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-inner">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
}


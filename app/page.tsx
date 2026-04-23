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
  ArrowRight,
  Users
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="relative isolate min-h-screen bg-slate-50 selection:bg-blue-100 overflow-x-hidden">
      {/* Premium Background Layer */}
      <div className="absolute inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-slate-50">
        {/* Glow Orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-blue-400/10 rounded-full blur-[60px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[35rem] h-[35rem] bg-indigo-400/10 rounded-full blur-[60px]" />
        
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
      <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 blur-3xl overflow-hidden" aria-hidden="true" suppressHydrationWarning>
        <div 
          className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-blue-300 to-indigo-400 opacity-[0.12]"
          style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}
          suppressHydrationWarning
        />
      </div>

      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/70 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-600 p-1.5 shadow-blue-200 shadow-lg">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  Blueteeth
                </span>
              </div>
              <div className="hidden sm:flex sm:items-center sm:gap-6">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">Practitioner Login</Button>
                </Link>
                <Link href="/auth/login?flow=admin">
                  <Button variant="primary" size="sm" className="rounded-xl">Admin Portal</Button>
                </Link>
              </div>
              {/* Mobile CTA (Hidden on desktop) */}
              <div className="flex sm:hidden">
                <Link href="/auth/login">
                   <Button variant="primary" size="sm" className="rounded-lg px-3 py-1 text-[10px] font-bold">Login</Button>
                </Link>
              </div>
            </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <div className="relative pt-12 lg:pt-10 pb-12 sm:pb-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 flex justify-center">
                <div className="relative rounded-lg px-4 py-1.5 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/10 hover:ring-slate-900/20 transition-all bg-white shadow-sm">
                  <span className="font-semibold text-blue-600">New:</span> V1.0.0 Stable Version released.{' '}
                  <a href="#" className="font-semibold text-blue-600">
                    <span className="absolute inset-0" aria-hidden="true" />
                    Read more <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </div>

              <h1 className="text-3xl font-black text-slate-900 sm:text-4xl lg:text-5xl tracking-tight leading-[1.1]">
                The Premium <span className="text-blue-600">B-Points</span> <br /> Rewards Portal
              </h1>

              <p className="mt-5 sm:mt-6 text-base sm:text-lg lg:text-xl leading-relaxed text-slate-600 max-w-2xl mx-auto px-4 sm:px-0">
                A specialized clinical ecosystem for Blueteeth practitioners. 
                Monetize every successful case referral with transparent 
                payouts and comprehensive tracking.
              </p>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 px-6 sm:px-0">
                <Link href="/auth/login" className="w-full sm:w-auto">
                  <Button variant="primary" size="lg" className="w-full sm:w-auto rounded-lg bg-blue-600 shadow-xl shadow-blue-200/50 group h-14 sm:h-16 px-8 text-base font-bold border-none">
                    Practitioner Login
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/auth/login?flow=admin" className="w-full sm:w-auto">
                  <Button variant="ghost" size="lg" className="w-full sm:w-auto rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all h-14 sm:h-16 px-8 text-base font-bold shadow-xl shadow-slate-200 group border-none">
                    Admin Portal 
                    <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1 text-blue-400" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="mx-auto mt-8 sm:mt-20 max-w-7xl px-2 sm:px-8">
              <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <FeatureCard 
                  icon={<Coins className="h-5 w-5 sm:h-6 sm:w-6" />}
                  title="Earn Points"
                  description="1 B-Point = ₹50. Earn up to 10 points per implant case. Instant reflection in your wallet."
                  mobileColor="bg-amber-50/80 border-amber-200/50"
                  iconColor="bg-amber-100 text-amber-600"
                />
                <FeatureCard 
                  icon={<Zap className="h-5 w-5 sm:h-6 sm:w-6" />}
                  title="Quick Payouts"
                  description="Secure UPI/Bank transfers with a minimum ₹500 withdrawal. Processing within 24 hours."
                  mobileColor="bg-emerald-50/80 border-emerald-200/50"
                  iconColor="bg-emerald-100 text-emerald-600"
                />
                <FeatureCard 
                  icon={<Activity className="h-5 w-5 sm:h-6 sm:w-6" />}
                  title="Real-time Tracking"
                  description="Comprehensive dashboard to track cases, status updates, and historical earnings records."
                  mobileColor="bg-indigo-50/80 border-indigo-200/50"
                  iconColor="bg-indigo-100 text-indigo-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 py-6 sm:py-10 bg-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-600 p-1.5 shadow-lg shadow-blue-100">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-wider">Blueteeth Network</p>
              </div>
              <p className="text-[10px] sm:text-sm font-medium text-slate-500 text-center sm:text-left">
                &copy; <span suppressHydrationWarning>{new Date().getFullYear()}</span> Blueteeth Ecosystem. <br className="sm:hidden" /> All rights reserved.
              </p>
              <div className="flex gap-4">
                <span className="flex items-center text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                  <ShieldCheck className="h-3 w-3 mr-2" /> Secure
                </span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description, 
  mobileColor = "bg-white", 
  iconColor = "bg-blue-50 text-blue-600" 
}: { 
  icon: React.ReactNode, 
  title: string, 
  description: string,
  mobileColor?: string,
  iconColor?: string
}) {
  return (
    <div className={`relative group overflow-hidden rounded-lg p-6 sm:p-8 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-xl hover:-translate-y-1 sm:bg-white backdrop-blur-md ${mobileColor}`}>
      <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity blur-2xl" />
      <div className={`mb-4 sm:mb-6 inline-flex rounded-xl p-2.5 sm:p-3 sm:bg-blue-50 sm:text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-inner ${iconColor}`}>
        {icon}
      </div>
      <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 sm:mb-3 uppercase tracking-tight">{title}</h3>
      <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
        {description}
      </p>
    </div>
  );
}


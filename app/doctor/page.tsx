'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Coins, Plus, Clock, CheckCircle2, XCircle, TrendingUp, Activity, ShieldAlert, ShieldCheck, Wifi, WifiOff, ChevronLeft, ChevronRight, X, User, Phone, Stethoscope, Calendar, Hash, BadgeCheck, AlertCircle, Banknote, ArrowRight, Monitor, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

const CASE_GRADIENTS = [
  'bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700',
  'bg-gradient-to-br from-rose-500 via-pink-600 to-rose-700',
  'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700',
  'bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700',
  'bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700',
  'bg-gradient-to-br from-cyan-500 via-blue-600 to-cyan-700',
  'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900',
  'bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-600',
  'bg-gradient-to-br from-lime-500 via-emerald-600 to-teal-700',
  'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600',
];

const getCaseGradient = (id: string) => {
  if (!id) return CASE_GRADIENTS[0];
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CASE_GRADIENTS[Math.abs(hash) % CASE_GRADIENTS.length];
};

const getCaseBorderClass = (id: string) => {
  const COLORS = ['border-t-blue-500', 'border-t-rose-500', 'border-t-emerald-500', 'border-t-amber-500', 'border-t-violet-500', 'border-t-cyan-500', 'border-t-indigo-500', 'border-t-pink-500'];
  const hash = (id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLORS[Math.abs(hash) % COLORS.length];
};

export default function DoctorDashboard() {
  const { user, userData } = useAuth();
  const [dbStats, setDbStats] = React.useState<any>({ totalPoints: 0, totalEarnings: 0, pendingCases: 0, approvedToday: 0 });
  const [exchangeRate, setExchangeRate] = React.useState(50);
  const [cases, setCases] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 5;
  const [isMounted, setIsMounted] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<'Testing' | 'Connected' | 'Disconnected'>('Testing');
  const [selectedCase, setSelectedCase] = React.useState<any | null>(null);

  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  React.useEffect(() => {
    setIsMounted(true);
    // [PERFORMANCE] Instant Cache Load
    try {
      const cachedStats = localStorage.getItem(`clinical_stats_${user?.uid}`);
      const cachedCases = localStorage.getItem(`clinical_cases_${user?.uid}`);
      if (cachedStats) setDbStats(JSON.parse(cachedStats));
      if (cachedCases) setCases(JSON.parse(cachedCases));
    } catch (e) {}
  }, [user?.uid]);

  // [UX OPTIMIZATION] Hard-Lock background scroll including HTML tag to prevent "chaining"
  React.useEffect(() => {
    if (selectedCase) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [selectedCase]);

  // 0. FETCH GLOBAL SETTINGS (Exchange Rate)
  React.useEffect(() => {
    const loadSettings = async () => {
       const { fetchGlobalSettings } = await import('@/lib/firestore');
       const settings = await fetchGlobalSettings();
       if (settings?.exchangeRate) setExchangeRate(settings.exchangeRate);
    };
    loadSettings();
  }, []);

  // 1. REAL-TIME DATA SUBSCRIPTION
  React.useEffect(() => {
    if (!user?.uid || !db) {
      if (!db) setConnectionStatus('Disconnected');
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'cases'), where('doctorUid', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConnectionStatus('Connected');
      setErrorMsg(null);
      const allCases: any[] = [];
      let totalP = 0;
      let pendingC = 0;
      let approvedT = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const caseItem = {
          id: docSnap.id,
          ...data,
          date: data.submittedAt?.toDate()?.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          }) || 'Recently'
        };
        allCases.push(caseItem);

        const isAdminEntry = String(data.patientName || '').trim().toUpperCase() === 'ADMIN MANUAL ADJUSTMENT';
        if (!isAdminEntry) {
          if (data.status === 'Approved') {
            totalP += (Number(data.points) || 0) + (Number(data.bonusPoints) || 0);
            const approvedAt = data.approvedAt?.toDate();
            if (approvedAt && approvedAt >= today) approvedT++;
          } else if (data.status === 'Pending') {
            pendingC++;
          }
        } else {
          totalP += Number(data.points) || 0;
        }
      });

      const sortedCases = allCases.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      const statsPayload = {
        totalPoints: totalP,
        totalEarnings: totalP * exchangeRate,
        pendingCases: pendingC,
        approvedToday: approvedT
      };

      setCases(sortedCases);
      setDbStats(statsPayload);
      
      // [PERFORMANCE] Persist to Cache
      try {
        localStorage.setItem(`clinical_stats_${user.uid}`, JSON.stringify(statsPayload));
        localStorage.setItem(`clinical_cases_${user.uid}`, JSON.stringify(sortedCases.slice(0, 10))); // Only cache first 10 for speed
      } catch (e) {}

      setLoading(false);
    }, (err: any) => {
      console.warn("Dashboard Sync Error:", err.message);
      setConnectionStatus('Disconnected');
      setErrorMsg(err.code === 'permission-denied' ? "Security Error: Missing cloud permissions." : "Network Error: System is offline.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, exchangeRate]);

  const filteredCases = React.useMemo(() => {
    const visibleCases = cases.filter(c =>
      String(c.patientName || '').trim().toUpperCase() !== 'ADMIN MANUAL ADJUSTMENT'
    );
    if (!searchQuery) return visibleCases;
    const q = searchQuery.toLowerCase();
    return visibleCases.filter(c => {
      return (
        String(c.patientName || '').toLowerCase().includes(q) ||
        String(c.patientMobile || '').includes(q) ||
        String(c.treatment || '').toLowerCase().includes(q)
      );
    });
  }, [cases, searchQuery]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = filteredCases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = [
    { name: 'Total B-Points', value: dbStats?.totalPoints?.toString() || '0', icon: Coins, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Total Earnings', value: `₹${dbStats?.totalEarnings?.toLocaleString() || '0'}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { name: 'Pending Cases', value: dbStats?.pendingCases?.toString() || '0', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { name: 'Approved Today', value: dbStats?.approvedToday?.toString() || '0', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  if (!isMounted) return null;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-[1600px] mx-auto px-1 sm:px-0 space-y-6 pb-0 w-full"
      >
        {/* Diagnostic & Connection Hub */}
        <div className="flex flex-col gap-6 lg:gap-8">

          {/* Error Feed */}
          {errorMsg && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex items-center gap-4 text-red-800 shadow-xl shadow-red-900/5">
              <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0 border border-red-200"><ShieldAlert className="h-6 w-6" /></div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest mb-0.5">Critical System Error</p>
                <p className="text-sm font-bold opacity-90">{errorMsg}</p>
              </div>
              <Button onClick={() => window.location.reload()} size="sm" className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase h-10 px-6 rounded-md">Retry Cloud Sync</Button>
            </motion.div>
          )}

          <div className="flex flex-wrap items-center gap-3 bg-white/30 p-2 rounded-lg border border-slate-100/50 backdrop-blur-xl w-full">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 shadow-sm transition-all group">
              <div className={`h-2 w-2 rounded-full ${connectionStatus === 'Connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : connectionStatus === 'Disconnected' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700/80">Status: {connectionStatus}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/40 backdrop-blur-md border border-slate-200/50 shadow-sm text-slate-600 transition-all">
              {connectionStatus === 'Connected' ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-red-400" />}
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700/70 leading-none">System Level: {connectionStatus === 'Connected' ? 'Live' : 'Offline'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-500/10 backdrop-blur-md text-indigo-700/90 text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 shadow-sm leading-none">
              <CheckCircle2 size={12} className="text-indigo-600" /> Secure Login Verified
            </div>
          </div>

          {/* Clinical Welcome Header */}
          <div className="w-full">
            <div className="flex flex-col space-y-3">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="-mt-1 inline-flex items-center gap-2 self-start px-3 py-2 rounded-md bg-blue-50/80 backdrop-blur-md border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm leading-none">
                <Activity className="h-3 w-3" /> System Status: {loading ? 'UPDATING...' : 'REAL-TIME SYNC'}
              </motion.div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight max-w-full break-words">
                Welcome, <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                  {userData?.name || user?.displayName ? 
                    (String(userData?.name || user?.displayName).startsWith('Dr.') ? (userData?.name || user?.displayName) : `Dr. ${userData?.name || user?.displayName}`) 
                    : 'Doctor'
                  }
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] leading-none mb-1">
                Doctor Rewards Dashboard • {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Practitioner Identity & CTA - Mobile Order-3 */}
          <div className="order-3 lg:order-3 w-full">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-0 lg:pt-6 border-t border-slate-100/50 lg:border-t-0">
                <div className="flex items-center gap-2.5 group cursor-default">
                  <div className="h-7 w-7 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-all shadow-sm border border-blue-100/50">
                    <User size={13} className="text-blue-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] opacity-100">Doctor ID</span>
                    <span className="text-[11px] font-bold text-slate-600 transition-colors group-hover:text-blue-900">{user?.email || 'Guest User'}</span>
                  </div>
                </div>

                <div className="h-6 w-[1px] bg-slate-100 hidden sm:block" />

                <div className="flex items-center gap-2.5 group cursor-default">
                  <div className="h-7 w-7 rounded-full bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-all shadow-sm border border-indigo-100/50">
                    <ShieldCheck size={13} className="text-indigo-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] opacity-100">Session Code</span>
                    <span className="text-[11px] font-black text-blue-600 uppercase tracking-tight opacity-70 group-hover:opacity-100">{(user?.uid || '').slice(0, 8).toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <Link href="/doctor/submit-case" className="block w-full lg:w-auto">
                <Button className="w-full h-12 lg:h-14 px-6 rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 flex items-center justify-between gap-4 transition-all duration-500 active:scale-95 group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/10 to-blue-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <div className="bg-white/20 p-1.5 rounded-md group-hover:bg-white/30 transition-colors relative z-10 shrink-0"><Plus className="h-4 w-4 lg:h-5 lg:w-5" /></div>
                  <div className="text-center relative z-10 flex-1">
                    <span className="block text-[8px] lg:text-[9px] font-black uppercase tracking-[0.2em] opacity-100">Action Centre</span>
                    <span className="block font-black text-sm lg:text-base">New Case Submission</span>
                  </div>
                  <div className="w-8 shrink-0 hidden lg:block" /> {/* Dummy to push text to center */}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* High-Fidelity Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {stats.map((item, idx) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`bg-white p-5 rounded-lg border border-slate-100 shadow-sm hover:shadow-xl transition-all group border-t-4 ${getCaseBorderClass(item.name)}`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${item.bg} group-hover:scale-110 transition-transform shadow-inner`}><item.icon className={`h-6 w-6 ${item.color}`} /></div>
                <div className="flex flex-col min-0">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{item.name}</p>
                  <h3 className="text-xl font-black text-slate-900 tracking-tighter">{item.value}</h3>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Global Stream Portal Header - Mobile Fixed Row */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-8 w-full">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="h-9 w-9 sm:h-10 sm:w-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg shrink-0"><Activity className="h-4 w-4 sm:h-5 sm:w-5 text-white" /></div>
              <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight truncate whitespace-nowrap">Recent Case Activity</h2>
            </div>
             <div className="flex items-center gap-2 sm:gap-4 ml-3 sm:ml-4 flex-shrink-0">
              <Link href="/doctor/cases">
                <button className="text-[8px] sm:text-[9px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-all bg-white/40 backdrop-blur-md border border-white px-3 py-1.5 rounded-[4px] hover:bg-white/60 shadow-sm whitespace-nowrap">Open Archive</button>
              </Link>
              <Link href="/doctor/submit-case">
                <button className="h-7 w-7 sm:h-8 sm:w-8 rounded-[4px] bg-white/40 backdrop-blur-md flex items-center justify-center text-blue-600 hover:bg-white/60 transition-all border border-white shadow-sm">
                  <Plus size={14} />
                </button>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden w-full">
            {/* Mobile View - Professional Card Stack */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="p-6 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded-md w-1/2 mb-3"></div>
                    <div className="h-3 bg-slate-50 rounded-md w-1/3"></div>
                  </div>
                ))
              ) : filteredCases.length === 0 ? (
                <div className="p-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No nodes synced</div>
              ) : (
                paginatedCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className="p-5 active:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-[14px] font-black text-slate-900 leading-tight uppercase tracking-tight">{c.patientName}</p>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">REF: {(c.id || '').slice(0, 6).toUpperCase()}</p>
                      </div>
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${c.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        c.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                        }`}>{c.status}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="text-[9px] font-bold text-slate-600 border-l-2 border-blue-500 pl-2 leading-none">
                        {c.date}
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-slate-900 tracking-tighter">+{c.points || 0}</span>
                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest ml-1">B-PTS</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View - Audit Ledger */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-3 text-left text-[9px] font-black text-slate-600 uppercase tracking-widest">Patient Name</th>
                    <th className="px-8 py-3 text-center text-[9px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Case Status</th>
                    <th className="px-8 py-3 text-right text-[9px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Points Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={3} className="px-8 py-10 bg-slate-50/30"></td></tr>)
                  ) : filteredCases.length === 0 ? (
                    <tr><td colSpan={3} className="px-8 py-24 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No Cases Found</td></tr>
                  ) : (
                    paginatedCases.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-blue-50/40 transition-all group cursor-pointer"
                        onClick={() => setSelectedCase(c)}
                      >
                        <td className="px-8 py-3.5">
                          <div className="font-black text-slate-900 text-[15px] tracking-tight capitalize group-hover:text-blue-600 transition-colors uppercase">{c.patientName}</div>
                          <div className="text-[8.5px] text-slate-600 font-black uppercase tracking-widest flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1"><Hash size={10} className="text-blue-500" /> REF: {(c.id || '').slice(0, 6).toUpperCase()}</span>
                            <span className="opacity-20">|</span>
                            <span className="flex items-center gap-1"><Phone size={10} className="text-indigo-400" /> {(c.patientMobile || '').slice(0, 3)}****{(c.patientMobile || '').slice(-3)}</span>
                            <span className="opacity-20">|</span>
                            {c.date}
                          </div>
                        </td>
                        <td className="px-8 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-2 rounded-md px-3 py-1 text-[8.5px] font-black uppercase tracking-widest border ${c.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            c.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'
                            }`}>{c.status}</span>
                        </td>
                        <td className="px-8 py-3.5 text-right">
                          <span className="text-base font-black text-slate-900 tracking-tighter">+{c.points || 0}</span>
                          <div className="text-[8px] font-black text-blue-500 uppercase tracking-widest ml-1 inline-block">B-PTS</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-8 py-5 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  Showing {paginatedCases.length} of {filteredCases.length} Records
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="h-8 w-8 p-0 rounded-md border-slate-200 text-slate-600 disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`h-8 w-8 rounded-md text-[10px] font-black transition-all ${currentPage === i + 1
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                        : 'bg-white border border-slate-100 text-slate-600 hover:border-blue-200 hover:text-blue-600 shadow-sm'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="h-8 w-8 p-0 rounded-md border-slate-200 text-slate-600 disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── CASE DETAIL MODAL ── */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 overscroll-contain">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedCase(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />

            <motion.div
              key={selectedCase?.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="fixed inset-0 flex items-center justify-center z-[210] p-4 sm:p-6 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-full max-w-[500px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header - Condensed Height */}
                <div className={`px-6 sm:px-8 py-3.5 sm:py-5 shrink-0 relative overflow-hidden ${getCaseGradient(selectedCase.id)}`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-white/80 mb-0.5 opacity-90">Case Details</p>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none uppercase">{selectedCase.patientName}</h2>
                    </div>
                    <button
                      onClick={() => setSelectedCase(null)}
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-md sm:rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all active:scale-90"
                    >
                      <X className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </button>
                  </div>

                  <div className="mt-2.5 sm:mt-3 flex items-center gap-3 relative z-10">
                    <span className="inline-flex items-center gap-2 bg-white/25 backdrop-blur-md text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md border border-white/10">
                      {selectedCase.status === 'Approved' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {selectedCase.status}
                    </span>
                    <span className="text-white/70 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">{selectedCase.date}</span>
                  </div>
                </div>

                {/* Modal Body - Scrollable (Hidden Bar) */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-5 sm:px-8 py-3 sm:py-4 space-y-2 sm:space-y-3">
                  <div className="flex gap-2 sm:gap-4">
                    <div className="flex-1 bg-blue-50/50 rounded-lg px-4 sm:px-5 py-2 sm:py-3 border border-blue-100 flex items-center justify-between group hover:bg-blue-50 transition-colors">
                      <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-blue-500">B-Points</p>
                      <p className="text-base sm:text-2xl font-black text-blue-700 tracking-tighter">+{selectedCase.points || 0} <span className="text-[7px] sm:text-[10px] font-black text-blue-400">PTS</span></p>
                    </div>
                    <div className="flex-1 bg-emerald-50/50 rounded-lg px-4 sm:px-5 py-2 sm:py-3 border border-emerald-100 flex items-center justify-between group hover:bg-emerald-50 transition-colors">
                      <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-600">Points Value</p>
                      <p className="text-base sm:text-2xl font-black text-emerald-700 tracking-tighter">₹{((selectedCase.points || 0) * exchangeRate).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-0.5 divide-y divide-slate-50">
                    {[
                      { icon: User,        label: 'Patient',    value: selectedCase.patientName || '—', color: 'text-blue-500', bg: 'bg-blue-50' },
                      { icon: Phone,       label: 'Mobile',     value: selectedCase.patientMobile || '—', color: 'text-emerald-500', bg: 'bg-emerald-50' },
                      { icon: Stethoscope, label: 'Treatment',  value: selectedCase.treatment || '—', color: 'text-sky-500', bg: 'bg-sky-50' },
                      { icon: Monitor,     label: 'Tooth No.',  value: selectedCase.toothNumber || '—', color: 'text-amber-500', bg: 'bg-amber-50' },
                      { icon: Calendar,    label: 'Submitted',  value: selectedCase.date || '—', color: 'text-indigo-500', bg: 'bg-indigo-50' },
                      { icon: Hash,        label: 'Case ID',    value: selectedCase.id ? selectedCase.id.slice(0, 8).toUpperCase() : '—', color: 'text-slate-700', bg: 'bg-slate-50' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 sm:gap-4 py-1 sm:py-2 group">
                        <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-md ${item.bg} flex items-center justify-center shrink-0 border border-black/5 group-hover:scale-110 transition-transform shadow-sm`}>
                          <item.icon size={16} className={`${item.color}`} />
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.15em] text-slate-600 mb-0.5">{item.label}</span>
                           <span className="font-extrabold text-slate-900 text-[10px] sm:text-sm tracking-tight">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedCase.evidenceUrl && (
                    <div className="pt-0.5 sm:pt-1">
                       <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1.5 ml-1">Evidence Proof</p>
                      <div 
                        onClick={() => {
                          const url = selectedCase.evidenceUrl;
                          if (!url) return;
                          
                          if (url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf')) {
                            const toastId = toast.loading("Opening clinical PDF...");
                            try {
                              if (url.startsWith('data:application/pdf')) {
                                const base64Data = url.split(',')[1];
                                const byteCharacters = atob(base64Data);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);
                                const blob = new Blob([byteArray], { type: 'application/pdf' });
                                const blobUrl = URL.createObjectURL(blob);
                                window.open(blobUrl, '_blank');
                              } else {
                                window.open(url, '_blank');
                              }
                              toast.success("Document opened.", { id: toastId });
                            } catch (e) {
                              toast.error("Format error. Try again.", { id: toastId });
                              window.open(url, '_blank');
                            }
                          } else {
                            // If it's an image, just open in new tab
                            window.open(url, '_blank');
                          }
                        }}
                        className="relative group bg-slate-50 rounded-lg border-2 border-slate-100 overflow-hidden min-h-[50px] sm:min-h-[70px] flex items-center justify-center p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all active:scale-[0.99]"
                      >
                         {(String(selectedCase.evidenceUrl).toLowerCase().includes('.pdf') || 
                           String(selectedCase.evidenceUrl).toLowerCase().includes('application/pdf')) ? (
                           <div className="w-full flex items-center justify-between gap-4">
                             <div className="flex items-center gap-3">
                               <div className="h-10 w-10 bg-rose-50 rounded-md flex items-center justify-center text-rose-600 border border-rose-100 group-hover:scale-110 transition-transform">
                                 <FileText size={20} />
                               </div>
                               <div>
                                 <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight leading-none group-hover:text-blue-600 transition-colors">Treatment Proof</p>
                                 <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">Medical Document Attached</p>
                               </div>
                             </div>
                             <div className="h-9 px-4 bg-slate-900 group-hover:bg-blue-600 text-white rounded-md flex items-center justify-center text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200 transition-all">
                               Open PDF
                             </div>
                           </div>
                         ) : (
                           <img
                             src={selectedCase.evidenceUrl}
                             alt="Clinical evidence"
                             className="w-full h-auto max-h-24 sm:max-h-32 object-contain hover:scale-105 transition-all duration-500"
                           />
                         )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer - Guaranteed View */}
                <div className="p-5 sm:p-8 pt-0 pb-6 sm:pb-8 shrink-0">
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="w-full h-11 sm:h-14 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-200"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

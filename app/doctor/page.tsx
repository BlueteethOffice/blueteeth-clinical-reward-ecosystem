'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Coins, Plus, Clock, CheckCircle2, XCircle, TrendingUp, Activity, ShieldAlert, Wifi, WifiOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function DoctorDashboard() {
  const { user, userData } = useAuth();
  const [dbStats, setDbStats] = React.useState<any>({ totalPoints: 0, totalEarnings: 0, pendingCases: 0, approvedToday: 0 });
  const [cases, setCases] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 5;
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<'Testing' | 'Connected' | 'Disconnected'>('Testing');
  
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  // 1. CONNECTION DIAGNOSTICS & LIVE DATA SYNC
  const refreshDashboard = React.useCallback(async () => {
    if (!user?.uid || !db) return;
    try {
      const q = query(collection(db, 'cases'), where('doctorUid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      setConnectionStatus('Connected');
      setErrorMsg(null);
      const allCases: any[] = [];
      let totalP = 0;
      let pendingC = 0;
      let approvedT = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const caseItem = {
          id: docSnap.id,
          ...data,
          date: data.submittedAt?.toDate()?.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) || 'Recently'
        };
        allCases.push(caseItem);

        // Skip Admin internal adjustments from stats calculation
        const isAdminEntry = String(data.patientName || '').trim().toUpperCase() === 'ADMIN MANUAL ADJUSTMENT';
        if (!isAdminEntry) {
          if (data.status === 'Approved') {
            totalP += data.points || 0;
            const approvedAt = data.approvedAt?.toDate();
            if (approvedAt && approvedAt >= today) approvedT++;
          } else if (data.status === 'Pending') {
            pendingC++;
          }
        }
      });

      // Client-side Sort
      const sortedCases = allCases.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || 0;
        const timeB = b.submittedAt?.seconds || 0;
        return timeB - timeA;
      });

      setCases(sortedCases);
      setDbStats({
        totalPoints: totalP,
        totalEarnings: totalP * 50,
        pendingCases: pendingC,
        approvedToday: approvedT
      });
      setLoading(false);
    } catch (err: any) {
      console.warn("Dashboard Sync Error:", err.message);
      setConnectionStatus('Disconnected');
      setErrorMsg(err.code === 'permission-denied' ? "Security Error: Missing cloud permissions." : "Network Error: System is offline.");
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (!user?.uid || !db) {
        if (!db) setConnectionStatus('Disconnected');
        return;
    }
    setLoading(true);
    refreshDashboard();
    const interval = setInterval(refreshDashboard, 30000); // 30s Poll
    return () => clearInterval(interval);
  }, [user, refreshDashboard]);

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

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Connection & Error Diagnostics */}
        <div className="flex flex-col gap-4">
          {errorMsg && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex items-center gap-4 text-red-800 shadow-xl shadow-red-900/5">
              <div className="h-10 w-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0 border border-red-200"><ShieldAlert className="h-6 w-6" /></div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest mb-0.5">Critical System Error</p>
                <p className="text-sm font-bold opacity-90">{errorMsg}</p>
              </div>
              <Button onClick={() => window.location.reload()} size="sm" className="bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase h-10 px-6 rounded-lg">Retry Cloud Sync</Button>
            </motion.div>
          )}

          {/* Diagnostic Status Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-white/50 p-3 rounded-2xl border border-slate-100 backdrop-blur-sm">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-100 shadow-sm">
                <div className={`h-2 w-2 rounded-full ${connectionStatus === 'Connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : connectionStatus === 'Disconnected' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Cloud Link: {connectionStatus}</span>
             </div>
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-100 shadow-sm text-slate-500">
                {connectionStatus === 'Connected' ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-red-400" />}
                <span className="text-[10px] font-black uppercase tracking-widest">Protocol: {connectionStatus === 'Connected' ? 'Production (Live)' : 'Disconnected'}</span>
             </div>
             {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? (
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100">✔ API Credentials Loaded</div>
             ) : connectionStatus === 'Connected' ? (
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest border border-blue-100">✔ Master Link Active</div>
             ) : (
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-widest border border-red-100">✖ Missing API Secret</div>
             )}
          </div>
        </div>

        {/* Dynamic Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-0">
          <div className="space-y-2">
             <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm">
               <Activity className="h-3 w-3" /> System Synchronized: {loading ? 'UPDATING...' : 'REAL-TIME'}
             </motion.div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
               Welcome, <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                 {userData?.name ? (userData.name.startsWith('Dr.') ? userData.name : `Dr. ${userData.name}`) : 'loading...'}
               </span>
             </h1>
             <p className="text-slate-400 font-medium text-xs max-w-lg leading-relaxed mt-2 italic">
               Practitioner Identity: {user?.email || 'N/A'} (ID: {user?.uid?.slice(0, 6)}...)
             </p>
          </div>
          
          <Link href="/doctor/submit-case" className="group">
            <Button className="h-14 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 flex items-center gap-4 transition-all duration-300 active:scale-95 group">
              <div className="bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors"><Plus className="h-5 w-5" /></div>
              <div className="text-left">
                <span className="block text-[9px] font-black uppercase tracking-[0.2em] opacity-80">Initialize</span>
                <span className="block font-black text-base">New Submission</span>
              </div>
            </Button>
          </Link>
        </div>

        {/* High-Fidelity Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((item, idx) => (
            <motion.div key={item.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${item.bg} group-hover:scale-110 transition-transform shadow-inner`}><item.icon className={`h-6 w-6 ${item.color}`} /></div>
                <div className="flex flex-col min-w-0">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.name}</p>
                   <h3 className="text-xl font-black text-slate-900 tracking-tighter">{item.value}</h3>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Global Stream Portal */}
        <div className="pt-6">
          <div className="flex items-center justify-between mb-8 px-2">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg"><Activity className="h-5 w-5 text-white" /></div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Global Clinical Stream</h2>
              </div>
             <Link href="/doctor/cases" className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-2 group p-2">Open Archive <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" /></Link>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                       <th className="px-8 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Patient Identity</th>
                       <th className="px-8 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Node Status</th>
                       <th className="px-8 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Clinical Yield</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={3} className="px-8 py-10 bg-slate-50/30"></td></tr>)
                    ) : filteredCases.length === 0 ? (
                      <tr><td colSpan={3} className="px-8 py-24 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">No Clinical Records Synchronized</td></tr>
                    ) : (
                      paginatedCases.map((c) => (
                         <tr key={c.id} className="hover:bg-blue-50/30 transition-all group">
                            <td className="px-8 py-3.5">
                               <div className="font-black text-slate-900 text-[15px] tracking-tight capitalize group-hover:text-blue-600 transition-colors uppercase">{c.patientName}</div>
                               <div className="text-[8.5px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2 mt-1">ID: {(c.patientMobile || '').slice(0, 3)}****{(c.patientMobile || '').slice(-3)} <span className="opacity-20">|</span> {c.date}</div>
                            </td>
                            <td className="px-8 py-3.5 text-center">
                               <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1 text-[8.5px] font-black uppercase tracking-widest border ${
                                 c.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
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

              {/* Enhanced Dashboard Pagination */}
              {totalPages > 1 && (
                <div className="px-8 py-5 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Showing {paginatedCases.length} of {filteredCases.length} Records
                   </p>
                   <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 disabled:opacity-30"
                      >
                         <ChevronLeft size={14} />
                      </Button>
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`h-8 w-8 rounded-lg text-[10px] font-black transition-all ${
                            currentPage === i + 1 
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                              : 'bg-white border border-slate-100 text-slate-400 hover:border-blue-200 hover:text-blue-600 shadow-sm'
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
                        className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 disabled:opacity-30"
                      >
                         <ChevronRight size={14} />
                      </Button>
                   </div>
                </div>
              )}
             </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

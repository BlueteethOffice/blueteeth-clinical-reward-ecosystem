'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Coins, 
  Wallet, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight, 
  History as HistoryIcon, 
  IndianRupee, 
  BadgeCheck, 
  AlertCircle, 
  TrendingUp, 
  Info, 
  ExternalLink, 
  X, 
  Smartphone, 
  FileText, 
  FileBadge, 
  Award, 
  ShieldCheck, 
  Gift, 
  Mail, 
  Key, 
  Plus, 
  Activity, 
  Phone, 
  Stethoscope, 
  Hash, 
  FileImage, 
  Monitor, 
  Calendar, 
  User, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Filter,
  Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { sendEmail } from '@/lib/email';

export default function EarningsPage() {
  const { user, userData } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  // Cache-First Identity State
  const [history, setHistory] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
       const cached = localStorage.getItem('blueteeth_earnings_cache');
       return cached ? JSON.parse(cached) : [];
    }
    return [];
  });
  
  const [stats, setStats] = useState(() => {
    if (typeof window !== 'undefined') {
       const cached = localStorage.getItem('blueteeth_stats_cache');
       return cached ? JSON.parse(cached) : {
         casePoints: 0,
         totalPoints: 0,
         totalRevenue: 0,
         pendingPoints: 0
       };
    }
    return { casePoints: 0, totalPoints: 0, totalRevenue: 0, pendingPoints: 0 };
  });

  const [loading, setLoading] = useState(history.length === 0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [perks, setPerks] = useState<any[]>([]);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false);
  const [totalRedeemedAmount, setTotalRedeemedAmount] = useState(0);
  const [showThresholdWarning, setShowThresholdWarning] = useState(false);

  // Identity Hydration Guard
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  // Synchronizing Official Clinical Wallet & History with Cache Logic
  useEffect(() => {
    if (!user || !db) return;

    // Listen to Redemptions
    const qRedemptions = query(collection(db, 'redemptions'), where('doctorUid', '==', user.uid));
    const unsubRedemptions = onSnapshot(qRedemptions, (snap) => {
      let redeemed = 0;
      let pending = false;
      snap.docs.forEach(doc => {
        const data = doc.data();
        redeemed += Number(data.amount || 0);
        if (data.status === 'Pending') pending = true;
      });
      setTotalRedeemedAmount(redeemed);
      setHasPendingWithdrawal(pending);
    });

    // Listen to Case History
    const q = query(
      collection(db, 'cases'),
      where('doctorUid', '==', user.uid)
    );

    const unsubCases = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => {
        const item = docSnap.data();
        return {
          id: docSnap.id,
          ...item,
          rawDate: item.submittedAt?.toDate(),
          date: item.submittedAt?.toDate()?.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          }) || 'Recently'
        } as any;
      });

      const sortedData = data.sort((a, b) => (b.rawDate?.getTime() || 0) - (a.rawDate?.getTime() || 0));
      setHistory(sortedData);
      localStorage.setItem('blueteeth_earnings_cache', JSON.stringify(sortedData));
      
      let clinicalCasePoints = 0;
      let totalAdminPerks = 0;

      sortedData.forEach(curr => {
        const isManual = String(curr.patientName || '').trim().toUpperCase() === "ADMIN MANUAL ADJUSTMENT";
        if (!isManual) {
          if (curr.status === 'Approved') {
            clinicalCasePoints += Number(curr.points || 0);
            totalAdminPerks += Number(curr.bonusPoints || 0);
          }
        } else {
          totalAdminPerks += Number(curr.points || 0);
        }
      });

      const EXCHANGE_RATE = 50;
      const totalAllPoints = clinicalCasePoints + totalAdminPerks;
      const liveRevenue = totalAllPoints * EXCHANGE_RATE;

      const newStats = {
        casePoints: clinicalCasePoints,
        pendingPoints: totalAdminPerks,
        totalPoints: totalAllPoints,
        totalRevenue: liveRevenue
      };

      setStats(newStats);
      localStorage.setItem('blueteeth_stats_cache', JSON.stringify(newStats));
      setLoading(false);
    }, (error) => {
      console.error("Clinical Sync Failure:", error);
      setLoading(false);
    });

    return () => { unsubCases(); unsubRedemptions(); };
  }, [user]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const isManualAdjustment = String(item.patientName || '').trim().toUpperCase() === "ADMIN MANUAL ADJUSTMENT";
      if (isManualAdjustment) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(item.patientName || '').toLowerCase().includes(q) ||
        String(item.treatment || '').toLowerCase().includes(q)
      );
    });
  }, [history, searchQuery]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const currentItems = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleViewAttachment = (url: string) => {
    if (!url) return;
    const newTab = window.open();
    if (newTab) {
      newTab.document.write(`
        <html>
          <head>
            <title>Blueteeth Clinical Proof | ${selectedCase?.patientName || 'Archive'}</title>
            <style>
              body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; font-family: -apple-system, sans-serif; }
              img { max-width: 95%; max-height: 90%; object-fit: contain; box-shadow: 0 25px 50px rgba(0,0,0,0.5); border-radius: 12px; }
              embed { width: 100%; height: 100%; }
              .header { position: fixed; top: 0; width: 100%; background: rgba(30,41,59,0.8); backdrop-filter: blur(10px); color: white; padding: 15px 30px; display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); }
            </style>
          </head>
          <body>
            <div class="header"><span>BLUETEETH SECURE AUDIT</span><span>${new Date().toLocaleDateString()}</span></div>
            ${url.includes('application/pdf') ? `<embed src="${url}" type="application/pdf">` : `<img src="${url}">`}
          </body>
        </html>
      `);
      newTab.document.close();
    }
  };

  if (!isMounted) return null;

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-6xl mx-auto space-y-8 overflow-x-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-0 md:pt-4">
          <div className="order-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Earnings Ledger</h1>
            <p className="text-slate-600 font-medium text-[10px] sm:text-[11px] mt-1 uppercase tracking-widest">Verified Clinical Revenue & Resource Distribution</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto order-2">
            <Button 
                onClick={() => {
                  if (Number(stats.totalPoints || 0) < 10) {
                    setShowThresholdWarning(true);
                  } else {
                    setShowRedeemModal(true);
                  }
                }}
                disabled={hasPendingWithdrawal || Math.max(0, stats.totalRevenue - totalRedeemedAmount) <= 0}
                className="h-12 w-full md:w-auto px-8 rounded-lg md:rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 transition-all active:scale-95 text-[10px] font-black uppercase tracking-[0.2em]"
            >
              Withdraw Request
            </Button>
          </div>
        </div>

        {/* Hero Stats Section - Stable Heights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-slate-900 border-none rounded-2xl relative overflow-hidden shadow-2xl shadow-slate-400/20 group h-36">
            <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Live Withdrawable</div>
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-white tracking-tighter italic">₹{Math.max(0, stats.totalRevenue - totalRedeemedAmount).toLocaleString()}</h3>
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
                   <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Active Reserve</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border-slate-100 rounded-2xl shadow-xl shadow-slate-200/40 h-36 border-t-4 border-t-indigo-500">
            <div className="flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Net Distribution</div>
              <div className="space-y-1">
                 <h2 className="text-2xl font-black text-slate-900 tracking-tighter italic">₹{Math.round(stats.totalRevenue).toLocaleString()}</h2>
                 <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest tracking-tighter">Aggregated Across {history.length} Nodes</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border-slate-100 rounded-2xl shadow-xl shadow-slate-200/40 h-36 border-t-4 border-t-blue-500">
            <div className="flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Settled Archive</div>
              <div className="space-y-1">
                 <h2 className="text-2xl font-black text-slate-900 tracking-tighter italic">₹{totalRedeemedAmount.toLocaleString()}</h2>
                 <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Transfer Nodes Completed</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border-slate-100 rounded-2xl shadow-xl shadow-slate-200/40 h-36 border-t-4 border-t-amber-500 group">
             <div className="flex flex-col h-full justify-between relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-10 transition-opacity"><Gift className="text-amber-500" size={40} /></div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Protocol PTS</div>
                <div className="flex flex-col space-y-1">
                   <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic leading-none">
                     {Number(stats.totalPoints || 0).toFixed(1)} <span className="text-xs text-amber-500 font-black">PTS</span>
                   </h2>
                   {stats.pendingPoints > 0 && (
                      <div className="flex items-center gap-1.5 pt-1">
                         <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                         <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">+{Number(stats.pendingPoints).toFixed(1)} BONUS SYNCED</p>
                      </div>
                   )}
                </div>
             </div>
          </Card>
        </div>

        {/* Ledger Section - Scroll Liquidated */}
        <Card className="border-none rounded-2xl shadow-2xl shadow-slate-200/40 bg-white">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg">
                   <HistoryIcon size={18} />
                </div>
                <div>
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Treatment Credits</h3>
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Unified Settlement Record</p>
                </div>
             </div>
             <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-lg uppercase tracking-widest border border-blue-100">
               Audit Window Active
             </div>
          </div>
               {/* Mobile View - Professional Card Stack */}
          <div className="block lg:hidden divide-y divide-slate-100">
            {loading ? (
               [...Array(3)].map((_, i) => (
                  <div key={i} className="p-6 animate-pulse">
                    <div className="h-4 bg-slate-100 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-slate-50 rounded w-1/4"></div>
                  </div>
               ))
            ) : currentItems.length > 0 ? (
              currentItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedCase(item)}
                  className="p-5 active:bg-blue-50/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <p className="text-[14px] font-black text-slate-900 uppercase tracking-tight leading-tight">{item.patientName}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5"><Calendar size={10} /> {item.date}</p>
                     </div>
                     <span className={`inline-flex px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                        item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        item.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                     }`}>{item.status}</span>
                  </div>
                  <div className="flex justify-between items-end">
                     <div>
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Net Valuation</p>
                        <p className="text-xl font-black text-slate-900 tracking-tighter italic leading-none">₹{Math.round((Number(item.points || 0) + Number(item.bonusPoints || 0)) * 50).toLocaleString()}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[14px] font-black text-blue-600 leading-none">
                           +{(Number(item.points || 0) + Number(item.bonusPoints || 0)).toFixed(1)} 
                           <span className="text-[8px] ml-1 uppercase tracking-tighter">Pts</span>
                        </p>
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1 leading-none">Yield Node</p>
                     </div>
                  </div>
                </div>
              ))
            ) : (
                <div className="p-12 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                  Zero Clinical Distributions Identified
                </div>
            )}
          </div>

          {/* Desktop View - Full Professional Table */}
          <div className="hidden lg:block overflow-visible">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100">
                  <th className="px-10 py-5 text-[9px] font-black uppercase tracking-[0.2em]">Clinical Identity</th>
                  <th className="px-10 py-5 text-[9px] font-black uppercase tracking-[0.2em]">Yield node</th>
                  <th className="px-10 py-5 text-[9px] font-black uppercase tracking-[0.2em]">Valuation</th>
                  <th className="px-10 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-center">Protocol Status</th>
                  <th className="px-10 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-lg w-32"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-lg w-20"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-lg w-16"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-xl w-24 mx-auto"></div></td>
                      <td className="px-10 py-8"></td>
                    </tr>
                   ))
                ) : currentItems.length > 0 ? (
                  currentItems.map((item, idx) => (
                    <motion.tr 
                      key={item.id}
                      className="group transition-colors hover:bg-slate-50/40"
                    >
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-[14px] group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none">{item.patientName}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                             <Calendar size={10} className="text-slate-300" /> {item.date}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                           <span className="font-black text-blue-600 text-sm">
                             +{(Number(item.points || 0)).toFixed(1)}
                             {item.bonusPoints > 0 && <span className="text-emerald-500 ml-1"> (+{Number(item.bonusPoints).toFixed(1)})</span>}
                           </span>
                           <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">Points Yield</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                           <span className="font-black text-slate-800 text-[16px] tracking-tighter">₹{Math.round((Number(item.points || 0) + Number(item.bonusPoints || 0)) * 50).toLocaleString()}</span>
                           <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">Settlement Value</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border mx-auto ${
                           item.status === 'Approved' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 
                           item.status === 'Pending' ? 'bg-amber-50/50 border-amber-100 text-amber-600' : 'bg-rose-50 border-rose-100 text-rose-500'
                        }`}>
                           <div className={`h-1.5 w-1.5 rounded-full ${item.status === 'Approved' ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20' : item.status === 'Pending' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                           <span className="text-[9px] font-black uppercase tracking-[0.2em]">{item.status}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button 
                           onClick={() => setSelectedCase(item)}
                           className="h-11 w-10 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-slate-900 hover:border-slate-300 hover:shadow-xl transition-all flex items-center justify-center active:scale-90"
                        >
                           <Eye className="h-5 w-5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                   <tr>
                    <td colSpan={5} className="px-10 py-32 text-center text-slate-400 font-black uppercase text-[9px] sm:text-[10px] tracking-widest leading-loose">
                        Zero Clinical Distributions Identified
                      </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-8 bg-slate-50/20 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Archive Node {currentPage} OF {totalPages} <span className="mx-2 opacity-20">|</span> Total {filteredHistory.length}
               </p>
               <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-12 px-6 rounded-xl bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase transition-all active:scale-95 disabled:opacity-30"
                  >
                    Prev
                  </Button>
                  <div className="flex gap-2">
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`h-12 w-10 rounded-xl font-black text-[10px] transition-all ${
                            currentPage === i + 1 
                            ? 'bg-slate-900 text-white shadow-xl' 
                            : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-300'
                          }`}
                        >
                           {i + 1}
                        </button>
                      ))}
                  </div>
                  <Button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-12 px-6 rounded-xl bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase transition-all active:scale-95 disabled:opacity-30"
                  >
                    Next
                  </Button>
               </div>
            </div>
          )}
        </Card>

        {/* Sync Status Overlay (Glassmorphism Modal) */}
        <AnimatePresence>
          {selectedCase && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedCase(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 10 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.98, y: 10 }} 
                className="relative bg-white w-full max-w-xl rounded-[24px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[96vh] p-2 sm:p-0"
              >
                 {/* Modal Header - Dark Slate Strip (Pati) */}
                 <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between relative overflow-hidden shrink-0 rounded-t-[20px] sm:rounded-none">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-4 relative z-10">
                       <div className="h-9 w-9 sm:h-10 sm:w-10 bg-white/10 rounded-lg flex items-center justify-center text-white border border-white/10 shadow-inner">
                          <FileText size={18} />
                       </div>
                       <div>
                          <h3 className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] leading-none mb-1">Audit IDENTITY Node</h3>
                          <p className="text-[12px] font-black text-white uppercase tracking-tight">#{selectedCase.id.toUpperCase()}</p>
                       </div>
                    </div>
                    <button 
                      onClick={() => setSelectedCase(null)} 
                      className="h-11 w-11 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 border border-white/10 relative z-50 cursor-pointer"
                    >
                       <X size={20} />
                    </button>
                 </div>
                 
                 {/* Modal Body - Premium Colorful List */}
                  <div className="p-6 space-y-6 bg-slate-50/30">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 shadow-sm">
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-1">B-Points</p>
                        <div className="flex items-end gap-1">
                          <span className="text-2xl font-black text-blue-700 leading-none">+{selectedCase.points}</span>
                          <span className="text-[10px] font-black text-blue-400 uppercase pb-1">pts</span>
                        </div>
                      </div>
                      <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/50 shadow-sm">
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Yield</p>
                        <span className="text-2xl font-black text-emerald-700 leading-none">₹{Math.round((Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)) * 50).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        { label: 'Patient', value: selectedCase.patientName, icon: User, color: 'text-blue-500', bg: 'bg-blue-50' },
                        { label: 'Mobile', value: selectedCase.patientMobile || '—', icon: Phone, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                        { label: 'Treatment', value: selectedCase.treatment, icon: Stethoscope, color: 'text-sky-500', bg: 'bg-sky-50' },
                        { label: 'Tooth No.', value: selectedCase.toothNo || '—', icon: Monitor, color: 'text-amber-500', bg: 'bg-amber-50' },
                        { label: 'Submitted', value: selectedCase.date, icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                        { label: 'Case ID', value: selectedCase.id.toUpperCase(), icon: Hash, color: 'text-slate-500', bg: 'bg-slate-50' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 group">
                          <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform shadow-sm border border-black/5`}>
                            <item.icon size={18} />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-0.5">{item.label}</p>
                            <p className="font-bold text-slate-800 text-sm tracking-tight">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Evidence Proof</p>
                       {selectedCase.evidenceUrl ? (
                         <div className="aspect-video bg-white rounded-lg overflow-hidden border border-slate-200 relative group shadow-sm flex items-center justify-center">
                            {selectedCase.evidenceUrl.toLowerCase().includes('.pdf') ? (
                              <div className="flex flex-col items-center justify-center p-6 space-y-3">
                                <div className="h-12 w-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 border border-rose-100 font-bold">
                                  <FileText size={24} />
                                </div>
                                <Button 
                                  onClick={() => handleViewAttachment(selectedCase.evidenceUrl)}
                                  className="bg-slate-900 text-white rounded-lg px-6 py-2 font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                >
                                  Open PDF
                                </Button>
                              </div>
                            ) : (
                              <>
                                <img 
                                  src={selectedCase.evidenceUrl} 
                                  alt="Evidence" 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                   <Button onClick={() => handleViewAttachment(selectedCase.evidenceUrl)} className="bg-white text-slate-900 rounded-lg px-4 py-2 font-black text-[10px] uppercase tracking-widest shadow-xl">Expand Image</Button>
                                </div>
                              </>
                            )}
                         </div>
                       ) : (
                         <div className="bg-slate-50 p-6 rounded-lg border border-dashed border-slate-200 text-center text-slate-400 italic text-[10px] font-bold uppercase tracking-tighter">No Visual Proof Synced</div>
                       )}
                    </div>
                  </div>

                 {/* Modal Footer */}
                 <div className="p-4 sm:p-6 shrink-0 bg-white border-t border-slate-100">
                    <Button onClick={() => setSelectedCase(null)} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all">Dismiss Dossier Record</Button>
                 </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Withdrawal Modal & Logic Placeholder */}
        {showRedeemModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowRedeemModal(false)} />
             <div className="relative bg-white w-full max-w-sm rounded-2xl p-8 space-y-6 shadow-2xl">
                <div className="text-center space-y-2">
                   <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-inner">
                      <Wallet size={32} className="text-blue-600" />
                   </div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Clinical Settlement</h2>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ready to initiate your protocol withdrawal?</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                   <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Available Balance</p>
                   <h4 className="text-4xl font-black text-slate-900 tracking-tighter italic">₹{Math.max(0, stats.totalRevenue - totalRedeemedAmount).toLocaleString()}</h4>
                </div>

                <Button 
                   onClick={() => {
                     toast.success("Request Initiated! Admin team will verify your payout node.");
                     setShowRedeemModal(false);
                   }}
                   className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.3em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                >
                   Finalize Withdrawal
                </Button>
             </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Re-using common icons for internal consistency
const Eye = ({ className, size = 20 }: { className?: string, size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

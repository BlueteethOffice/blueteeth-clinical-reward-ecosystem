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
  Landmark, 
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
  Clock,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
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
  const [exchangeRate, setExchangeRate] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [perks, setPerks] = useState<any[]>([]);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [totalRedeemedAmount, setTotalRedeemedAmount] = useState(0);
  const [showThresholdWarning, setShowThresholdWarning] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank'>('upi');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [redemptionPage, setRedemptionPage] = useState(1);
  const redemptionsPerPage = 4;
  const [isPayoutEditing, setIsPayoutEditing] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    if (userData?.payoutNode?.method) {
      setPayoutMethod(userData.payoutNode.method);
    }
    const loadSettings = async () => {
       const { fetchGlobalSettings } = await import('@/lib/firestore');
       const settings = await fetchGlobalSettings();
       if (settings?.exchangeRate) setExchangeRate(settings.exchangeRate);
    };
    loadSettings();
  }, [userData]);

  // [UX OPTIMIZATION] Hard-Lock background scroll including HTML tag to prevent "chaining"
  useEffect(() => {
    const isLocked = !!(selectedCase || showThresholdWarning || showRedeemModal);
    if (isLocked) {
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
  }, [selectedCase, showThresholdWarning, showRedeemModal]);

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
      setRedemptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
      setLoading(false);
    }, (error) => {
      console.error("Clinical Sync Failure:", error);
      setLoading(false);
    });

    return () => {
      unsubRedemptions();
      unsubCases();
    };
  }, [user, db]);

  // 📊 Reactive Stats Engine (History + Redemptions change)
  useEffect(() => {
    if (!history.length && !redemptions.length) return;

    let clP = 0;
    let adP = 0;
    let avR = 0;

    const lastR = [...redemptions].sort((a,b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0))[0];
    const lastT = lastR?.requestedAt?.seconds || 0;

    history.forEach(curr => {
      const isM = String(curr.patientName || '').trim().toUpperCase() === "ADMIN MANUAL ADJUSTMENT";
      const cTime = curr.submittedAt?.seconds || 0;

      if (!isM) {
        if (curr.status === 'Approved') {
          clP += Number(curr.points || 0);
          adP += Number(curr.bonusPoints || 0);
          if (cTime > lastT) {
             avR += (Number(curr.points || 0) + Number(curr.bonusPoints || 0)) * exchangeRate;
          }
        }
      } else {
        adP += Number(curr.points || 0);
        if (cTime > lastT) {
           avR += Number(curr.points || 0) * exchangeRate;
        }
      }
    });

    const newStats = {
      casePoints: clP,
      pendingPoints: adP,
      totalPoints: clP + adP,
      totalRevenue: (clP + adP) * exchangeRate,
      availableRevenue: avR
    };

    setStats(newStats);
    localStorage.setItem('blueteeth_stats_cache', JSON.stringify(newStats));
  }, [history, redemptions, exchangeRate]);

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
      <div className="flex-1 w-full max-w-[1600px] mx-auto px-2 sm:px-6 lg:px-8 pb-2 space-y-8 overflow-x-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-0 md:pt-4">
          <div className="order-1">
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">Your Earnings Summary</h1>
            <p className="text-slate-600 font-medium text-[10px] sm:text-[11px] mt-1 uppercase tracking-widest">History of all your earnings and payouts</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto order-2">
            <Button 
                onClick={() => {
                  setModalError(null);
                  setShowRedeemModal(true);
                }}
                disabled={stats.availableRevenue < 500}
                className="h-12 w-full md:w-auto px-8 rounded-lg md:rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 transition-all active:scale-95 text-[10px] font-black uppercase tracking-[0.2em] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              Request Payout
            </Button>
          </div>
        </div>

        {/* Hero Stats Section - Stable Heights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 bg-slate-900 border-none rounded-lg relative overflow-hidden shadow-2xl shadow-slate-400/20 group h-36">
            <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Available to Withdraw</div>
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-white tracking-tighter italic">₹{(stats as any).availableRevenue?.toLocaleString() || '0'}</h3>
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
                   <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Ready to be paid out</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border-slate-100 rounded-lg shadow-xl shadow-slate-200/40 h-36 border-t-4 border-t-indigo-500">
            <div className="flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Total Earnings</div>
              <div className="space-y-1">
                 <h2 className="text-2xl font-black text-slate-900 tracking-tighter italic">₹{Math.round(stats.totalRevenue).toLocaleString()}</h2>
                 <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest tracking-tighter">Across all your {history.length} cases</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border-slate-100 rounded-lg shadow-xl shadow-slate-200/40 h-36 border-t-4 border-t-blue-500">
            <div className="flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Already Paid Out</div>
              <div className="space-y-1">
                 <h2 className="text-2xl font-black text-slate-900 tracking-tighter italic">₹{totalRedeemedAmount.toLocaleString()}</h2>
                 <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Successful bank transfers</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white border-slate-100 rounded-lg shadow-xl shadow-slate-200/40 h-36 border-t-4 border-t-amber-500 group">
             <div className="flex flex-col h-full justify-between relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-10 transition-opacity"><Gift className="text-amber-500" size={40} /></div>
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Total Points Earned</div>
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
        <Card className="border-none rounded-lg shadow-2xl shadow-slate-200/40 bg-white overflow-visible">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg">
                   <HistoryIcon size={18} />
                </div>
                <div>
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Payment History</h3>
                   <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter mt-1">Recent case payments</p>
                </div>
             </div>
             <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-lg uppercase tracking-widest border border-blue-100">
               System Online
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
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1 flex items-center gap-1.5"><Calendar size={10} /> {item.date}</p>
                     </div>
                     <span className={`inline-flex px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                        item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        item.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                     }`}>{item.status}</span>
                  </div>
                  <div className="flex justify-between items-end">
                     <div>
                        <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-1 leading-none">Net Cash Value</p>
                        <p className="text-xl font-black text-slate-900 tracking-tighter italic leading-none">₹{Math.round((Number(item.points || 0) + Number(item.bonusPoints || 0)) * exchangeRate).toLocaleString()}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[14px] font-black text-blue-600 leading-none">
                           +{(Number(item.points || 0) + Number(item.bonusPoints || 0)).toFixed(1)} 
                           <span className="text-[8px] ml-1 uppercase tracking-tighter">Pts</span>
                        </p>
                        <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mt-1 leading-none">Points Earned</p>
                     </div>
                  </div>
                </div>
              ))
            ) : (
                <div className="p-12 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest leading-loose">
                  No earnings found yet
                </div>
            )}
          </div>

          {/* Desktop View - Full Professional Table */}
          <div className="hidden lg:block">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-700 border-b border-slate-100">
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Patient Name</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Points Earned</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Cash Value</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center">Status</th>
                  <th className="px-6 pr-12 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-lg w-32"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-lg w-20"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-lg w-16"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-lg w-24 mx-auto"></div></td>
                      <td className="px-10 py-8"></td>
                    </tr>
                   ))
                ) : currentItems.length > 0 ? (
                  currentItems.map((item, idx) => (
                    <motion.tr 
                      key={item.id}
                      className="group transition-colors hover:bg-slate-50/40"
                    >
                      <td className="px-6 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-[14px] group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none">{item.patientName}</span>
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-2 flex items-center gap-2">
                             <Calendar size={10} className="text-slate-500" /> {item.date}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex flex-col">
                           <span className="font-black text-blue-600 text-sm">
                             +{(Number(item.points || 0)).toFixed(1)}
                             {item.bonusPoints > 0 && <span className="text-emerald-500 ml-1"> (+{Number(item.bonusPoints).toFixed(1)})</span>}
                           </span>
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mt-1">Reward Points</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex flex-col">
                           <span className="font-black text-slate-800 text-[16px] tracking-tighter">₹{Math.round((Number(item.points || 0) + Number(item.bonusPoints || 0)) * exchangeRate).toLocaleString()}</span>
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Cash Value</span>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border mx-auto ${
                           item.status === 'Approved' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 
                           item.status === 'Pending' ? 'bg-amber-50/50 border-amber-100 text-amber-600' : 'bg-rose-50 border-rose-100 text-rose-500'
                        }`}>
                           <div className={`h-1.5 w-1.5 rounded-full ${item.status === 'Approved' ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20' : item.status === 'Pending' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                           <span className="text-[9px] font-black uppercase tracking-[0.2em]">{item.status}</span>
                        </div>
                      </td>
                      <td className="px-6 pr-12 py-6 text-right">
                        <button 
                           onClick={() => setSelectedCase(item)}
                           className="h-11 w-10 rounded-lg bg-white border border-slate-100 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:shadow-xl transition-all flex items-center justify-center active:scale-90 ml-auto"
                        >
                           <Eye className="h-5 w-5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                   <tr>
                    <td colSpan={5} className="px-10 py-32 text-center text-slate-600 font-black uppercase text-[9px] sm:text-[10px] tracking-widest leading-loose">
                        No earnings found yet
                      </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-5 sm:p-8 bg-slate-50/20 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6">
               <p className="text-[9px] sm:text-[10px] font-black text-slate-600 uppercase tracking-widest text-center sm:text-left">
                  Archive Node {currentPage} OF {totalPages} <span className="mx-1 sm:mx-2 opacity-20">|</span> Total {filteredHistory.length}
               </p>
               <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-12 px-6 rounded-lg bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase transition-all active:scale-95 disabled:opacity-30"
                  >
                    Prev
                  </Button>
                  <div className="flex gap-2">
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`h-12 w-10 rounded-lg font-black text-[10px] transition-all ${
                            currentPage === i + 1 
                            ? 'bg-slate-900 text-white shadow-xl' 
                            : 'bg-white text-slate-600 border border-slate-100 hover:border-slate-300'
                          }`}
                        >
                           {i + 1}
                        </button>
                      ))}
                  </div>
                  <Button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-12 px-6 rounded-lg bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase transition-all active:scale-95 disabled:opacity-30"
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
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 overscroll-contain">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedCase(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
              <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 10 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.98, y: 10 }} 
                className="relative bg-white w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[96vh] p-2 sm:p-0"
              >
                 {/* Modal Header - Dark Slate Strip (Pati) */}
                 <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between relative overflow-hidden shrink-0 rounded-t-lg sm:rounded-none">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-4 relative z-10">
                       <div className="h-9 w-9 sm:h-10 sm:w-10 bg-white/10 rounded-lg flex items-center justify-center text-white border border-white/10 shadow-inner">
                          <FileText size={18} />
                       </div>
                       <div>
                          <h3 className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em] leading-none mb-1">Case Payment Details</h3>
                          <p className="text-[12px] font-black text-white uppercase tracking-tight">#{(selectedCase.id || '').toUpperCase().slice(0, 10)}</p>
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
                  <div className="p-6 space-y-6 bg-slate-50/30 overflow-y-auto flex-1 no-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100/50 shadow-sm">
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-1">B-Points</p>
                        <div className="flex items-end gap-1">
                          <span className="text-2xl font-black text-blue-700 leading-none">+{selectedCase.points}</span>
                          <span className="text-[10px] font-black text-blue-400 uppercase pb-1">pts</span>
                        </div>
                      </div>
                      <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100/50 shadow-sm">
                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Yield</p>
                        <span className="text-2xl font-black text-emerald-700 leading-none">₹{Math.round((Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)) * exchangeRate).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        { label: 'Patient', value: selectedCase.patientName, icon: User, color: 'text-blue-500', bg: 'bg-blue-50' },
                        { label: 'Mobile', value: selectedCase.patientMobile || '—', icon: Phone, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                        { label: 'Treatment', value: selectedCase.treatment, icon: Stethoscope, color: 'text-sky-500', bg: 'bg-sky-50' },
                        { label: 'Tooth No.', value: selectedCase.toothNo || '—', icon: Monitor, color: 'text-amber-500', bg: 'bg-amber-50' },
                        { label: 'Submitted', value: selectedCase.date, icon: Calendar, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                        { label: 'Case ID', value: (selectedCase.id || '').toUpperCase().slice(0, 10), icon: Hash, color: 'text-slate-700', bg: 'bg-slate-50' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 group">
                          <div className={`w-10 h-10 rounded-md ${item.bg} flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform shadow-sm border border-black/5`}>
                            <item.icon size={18} />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black uppercase text-slate-600 tracking-wider mb-0.5">{item.label}</p>
                            <p className="font-bold text-slate-800 text-sm tracking-tight">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                        <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-3">Evidence Proof</p>
                        {selectedCase.evidenceUrl ? (
                          <div className="h-44 sm:h-56 bg-slate-100/50 rounded-lg overflow-hidden border border-slate-200 relative group shadow-inner flex items-center justify-center">
                             {(selectedCase.evidenceUrl.toLowerCase().includes('.pdf') || selectedCase.evidenceUrl.includes('application/pdf')) ? (
                               <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-white/50 w-full h-full">
                                 <div className="h-16 w-16 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xl shadow-blue-600/20 transition-transform group-hover:scale-110">
                                   <FileText size={32} />
                                 </div>
                                 <div className="text-center">
                                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mb-1">PDF DOCUMENT</p>
                                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Clinical Archive v1.0</p>
                                 </div>
                                 <Button 
                                   onClick={() => handleViewAttachment(selectedCase.evidenceUrl)}
                                   className="bg-slate-900 text-white rounded-lg px-8 h-11 font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-4 border-none"
                                 >
                                   Open PDF Archive
                                 </Button>
                               </div>
                             ) : (
                               <>
                                 <img 
                                   src={selectedCase.evidenceUrl} 
                                   alt="Evidence" 
                                   className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                   onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.parentElement?.querySelector('.doc-fallback')?.classList.remove('hidden');
                                   }}
                                 />
                                 <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
                                    <Button onClick={() => handleViewAttachment(selectedCase.evidenceUrl)} className="bg-white text-slate-900 rounded-lg px-6 h-10 font-black text-[10px] uppercase tracking-widest shadow-2xl border-none">Expand Image</Button>
                                 </div>
                                 <div className="doc-fallback hidden flex flex-col items-center justify-center p-8 space-y-4 bg-white/50 w-full h-full">
                                    <div className="h-16 w-16 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xl">
                                       <FileBadge size={32} />
                                    </div>
                                    <Button 
                                       onClick={() => handleViewAttachment(selectedCase.evidenceUrl)}
                                       className="bg-slate-900 text-white rounded-lg px-8 h-11 font-black text-[10px] uppercase tracking-[0.2em]"
                                    >
                                       Open Clinical File
                                    </Button>
                                 </div>
                               </>
                             )}
                          </div>
                        ) : (
                          <div className="bg-slate-50 p-6 rounded-lg border border-dashed border-slate-200 text-center text-slate-600 italic text-[10px] font-bold uppercase tracking-tighter">No photos attached</div>
                        )}
                    </div>
                  </div>

                 {/* Modal Footer */}
                 <div className="p-4 sm:p-6 shrink-0 bg-white border-t border-slate-100">
                    <Button onClick={() => setSelectedCase(null)} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-12 rounded-lg font-black text-[10px] sm:text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all">Close Details Summary</Button>
                 </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Withdrawal Modal & Logic Placeholder */}
        {showRedeemModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4">
             <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setShowRedeemModal(false)} />
             <motion.div 
                initial={{ opacity: 0, scale: 1, y: 0, x: 0 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 1, y: 0, x: 0 }}
                className="relative bg-white w-[95%] sm:w-full max-w-lg rounded-xl p-5 sm:p-8 space-y-5 shadow-2xl border border-slate-100 overflow-y-auto overflow-x-hidden no-scrollbar max-h-[92vh] will-change-transform mx-auto"
                onClick={(e) => e.stopPropagation()}
             >
                <button 
                  onClick={() => setShowRedeemModal(false)}
                  className="absolute top-2 right-2 h-10 w-10 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 hover:text-slate-900 transition-all active:scale-95 z-[310] border border-slate-100/50"
                 >
                    <X size={20} />
                </button>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-10 -mr-16 -mt-16" />
                
                <div className="text-center space-y-1 relative z-10">
                   <div className="h-14 w-14 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-xl shadow-blue-600/20 text-white leading-none">
                      <Wallet size={24} />
                   </div>
                   <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">Clinical Payout Hub</h2>
                   <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Financial Identity node active</p>
                </div>

                {modalError && (
                    <motion.div initial={{ opacity: 1 }} className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 shadow-md relative z-20">
                       <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={14} />
                       <div className="flex-1">
                          <p className="text-[9px] font-black text-red-700 uppercase tracking-widest mb-1 leading-none">Security Alert: Action Blocked</p>
                          <p className="text-[10px] font-bold text-red-600/90 leading-tight">{modalError}</p>
                       </div>
                       <button onClick={() => setModalError(null)} className="text-red-400 hover:text-red-700 transition-colors"><X size={12} /></button>
                    </motion.div>
                 )}

                <div className="bg-slate-900 py-3.5 px-6 rounded-lg text-center shadow-inner relative overflow-hidden group text-white">
                   <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500 rounded-full blur-2xl opacity-10 -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
                   <div className="flex flex-col items-center">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1 relative z-10">Available Redemption Balance</p>
                      <h1 className="text-3xl font-black text-white tracking-tighter italic relative z-10">₹{stats.availableRevenue.toLocaleString()}</h1>
                   </div>
                </div>

                <div className="space-y-4 relative z-10">
                  {/* Step 1: Selection */}
                   <div className="space-y-4 px-1 sm:px-2">
                     <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-l-4 border-blue-600 pl-4">Step 1: Select Transfer Node</p>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                      {['upi', 'bank'].map((method) => (
                        <button
                          key={method}
                          onClick={() => setPayoutMethod(method as 'upi' | 'bank')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${payoutMethod === method ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          {method === 'upi' ? `Saved UPI ${userData?.payoutNode?.method === 'upi' ? '✓' : ''}` : `Bank Node ${userData?.payoutNode?.method === 'bank' ? '✓' : ''}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Credentials */}
                   <div className="space-y-4 px-1 sm:px-2">
                     <div className="flex items-center justify-between">
                       <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-l-4 border-emerald-500 pl-4">
                         Step 2: Financial Credentials {userData?.payoutNode && !isPayoutEditing && <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] rounded font-black tracking-tighter">SYSTEM LOCKED</span>}
                      </p>
                      <button 
                        onClick={() => {
                          setIsPayoutEditing(!isPayoutEditing);
                          if (!isPayoutEditing) toast.success("Security Node: Edit Mode Active");
                        }}
                        className={`text-[8px] font-black uppercase tracking-widest hover:underline ${isPayoutEditing ? 'text-amber-600' : 'text-blue-600'}`}
                      >
                         {isPayoutEditing ? '[ LOCK & SAVE VIEW ]' : '[ EDIT / UPDATE NODE ]'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {payoutMethod === 'bank' ? (
                        <>
                          <input id="payout_bank_acc" key={`acc_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.accountNumber} placeholder="Account Number" className="payout-input w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all disabled:opacity-60" disabled={!isPayoutEditing} />
                          <input id="payout_bank_ifsc" key={`ifsc_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.ifsc} placeholder="IFSC Code" className="payout-input w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all uppercase disabled:opacity-60" disabled={!isPayoutEditing} />
                          <input id="payout_bank_name" key={`bank_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.bankName} placeholder="Bank Name" className="payout-input w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all disabled:opacity-60" disabled={!isPayoutEditing} />
                          <input id="payout_bank_holder" key={`hold_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.holderName} placeholder="Account Holder Name" className="payout-input w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all disabled:opacity-60" disabled={!isPayoutEditing} />
                        </>
                      ) : (
                        <input id="payout_upi_id" key={`upi_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.upiId} placeholder="Enter UPI ID (e.g. name@upi)" className="payout-input w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 text-[12px] font-bold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all md:col-span-2 disabled:opacity-60" disabled={!isPayoutEditing} />
                      )}
                    </div>
                  </div>
 
                  {/* Step 3: KYC */}
                   <div className="space-y-4 px-1 sm:px-2">
                     <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-l-4 border-rose-500 pl-4">Step 3: Identity Verification (KYC)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                       <input id="payout_kyc_pan" key={`pan_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.kyc?.pan} disabled={!isPayoutEditing} placeholder="PAN Number (10 Digits)" maxLength={10} className="payout-input w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 text-[12px] font-bold outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-600 transition-all uppercase disabled:opacity-60" />
                       <input id="payout_kyc_aadhar" key={`aad_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.kyc?.aadhar} disabled={!isPayoutEditing} placeholder="Aadhaar Number (12 Digits)" maxLength={12} className="payout-input w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 text-[12px] font-bold outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-600 transition-all disabled:opacity-60" />
                    </div>
                    
                    <div className="group relative">
                       <input 
                         type="file" 
                         id="payout_pan_image" 
                         accept="image/*"
                         disabled={!isPayoutEditing}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed" 
                         onChange={(e) => {
                            const fileName = e.target.files?.[0]?.name;
                            if (fileName) {
                               const label = document.getElementById('pan_label');
                                if (label) {
                                   const truncated = fileName.length > 25 ? fileName.slice(0, 10) + '...' + fileName.slice(-10) : fileName;
                                   label.innerText = `PAN: ${truncated}`;
                                }
                            }
                         }}
                       />
                       <div className="w-full h-12 bg-rose-50 border-2 border-dashed border-rose-200 rounded-xl flex items-center justify-center gap-3 group-hover:bg-rose-100 transition-all group-hover:border-rose-300">
                          <FileImage className="text-rose-500" size={16} />
                          <span id="pan_label" className="text-[8px] font-black text-rose-700 uppercase tracking-widest">Upload PAN Image Proof</span>
                       </div>
                    </div>
                  </div>

                  {/* Step 4: Security Sync (OTP) */}
                   <div className="space-y-4 px-1 sm:px-2 pt-1">
                     <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-l-4 border-indigo-600 pl-4">Step 4: Security Verification (OTP)</p>
                    {isOtpSent ? (
                      <div className="grid grid-cols-1 gap-2.5">
                         <input id="payout_otp" placeholder="Enter 6-Digit OTP from Email" maxLength={6} className="w-full h-11 bg-indigo-50 border border-indigo-200 rounded-lg px-4 text-[12px] font-black outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 text-center tracking-[0.5em] transition-all" />
                         <p className="text-[8px] font-bold text-slate-500 uppercase text-center">OTP synced to registered clinical mail</p>
                      </div>
                    ) : (
                      <Button 
                        onClick={async () => {
                          const tid = toast.loading("Syncing Security Node...");
                          const otp = Math.floor(100000 + Math.random() * 900000).toString();
                          (window as any).payout_otp_val = otp;
                          try {
                            await sendEmail({ 
                              to_email: user?.email, 
                              otp, 
                              passcode: otp, // Map specifically to passcode for the template box
                              message: `Your Blueteeth Security OTP for Payout Verification is: ${otp}. This code is required to secure your financial identity node.`,
                              subject: "SECURITY: Payout Node Verification 🛡️",
                              to_name: userData?.name || "Doctor"
                            });
                            setIsOtpSent(true);
                            toast.success("Security OTP Dispatched!", { id: tid });
                          } catch (err) { toast.error("Mail Sync Failure", { id: tid }); }
                        }}
                        className="w-full h-11 bg-slate-900 text-white rounded-lg font-black text-[9px] uppercase tracking-widest active:scale-95"
                      >
                         <Key size={14} className="mr-2" /> Request Security OTP
                      </Button>
                    )}
                  </div>
                </div>

                <Button 
                   onClick={async () => {
                     const method = (window as any).payoutNodeMethod || userData?.payoutNode?.method || 'upi';
                     const toastId = toast.loading('Initiating Security Protocol...');
                     
                     try {
                        const enteredOtp = (document.getElementById('payout_otp') as HTMLInputElement)?.value;
                        const correctOtp = (window as any).payout_otp_val;
                        
                        if (!isOtpSent) throw new Error("Security Check Required: Please request OTP first.");
                        if (enteredOtp !== correctOtp) throw new Error("Invalid Security OTP: Verification failed.");
                        
                        const upiVal = (document.getElementById('payout_upi_id') as HTMLInputElement)?.value;
                        const accVal = (document.getElementById('payout_bank_acc') as HTMLInputElement)?.value;
                        const ifscVal = (document.getElementById('payout_bank_ifsc') as HTMLInputElement)?.value;
                        const bNameVal = (document.getElementById('payout_bank_name') as HTMLInputElement)?.value;
                        const hNameVal = (document.getElementById('payout_bank_holder') as HTMLInputElement)?.value;
                        const panVal = (document.getElementById('payout_kyc_pan') as HTMLInputElement)?.value;
                        const aadharVal = (document.getElementById('payout_kyc_aadhar') as HTMLInputElement)?.value;

                        if (!panVal || !aadharVal) throw new Error("Clinical Verification Required: Please provide valid PAN and Aadhaar identifiers to proceed.");
                        if (method === 'upi' && !upiVal) throw new Error("Input Required: UPI Identifier Node cannot be blank.");
                        if (method === 'bank' && (!accVal || !ifscVal)) throw new Error("Input Required: Bank Account or IFSC Node cannot be blank.");

                        // 1. UNIQUE NODE VALIDATION
                        const { getDocs, query, collection, where, doc, setDoc, serverTimestamp, addDoc, writeBatch } = await import('firebase/firestore');
                        const nodeKey = method === 'upi' ? 'payoutNode.details.upiId' : 'payoutNode.details.accountNumber';
                        const nodeVal = method === 'upi' ? upiVal : accVal;

                        const qConflict = query(collection(db, 'users'), where(nodeKey, '==', nodeVal));
                        const conflictSnap = await getDocs(qConflict);
                        
                        const conflictDoc = conflictSnap.docs.find(d => d.id !== user?.uid);
                        if (conflictDoc) {
                           throw new Error("Security Advisory: This payout identifier (UPI/Account) is already registered under another practitioner's identity. Please verify or contact clinical support.");
                        }

                        // 2. SAVE/UPDATE PERMANENT NODE (MERGE MODE FOR ULTIMATE SYNC)
                        const payoutNode = {
                           method,
                           details: method === 'upi' ? { upiId: upiVal } : { accountNumber: accVal, ifsc: ifscVal.toUpperCase(), bankName: bNameVal, holderName: hNameVal },
                           kyc: { pan: panVal.toUpperCase(), aadhar: aadharVal },
                           lastPayoutSync: serverTimestamp()
                        };
                        
                        await setDoc(doc(db, 'users', user?.uid as string), { payoutNode }, { merge: true });

                        // 3. CREATE REDEMPTION
                        const payload: any = {
                          doctorUid: user?.uid,
                          doctorName: userData?.name || user?.displayName || 'Doctor',
                          doctorEmail: user?.email, // Added for automated confirmation
                          amount: stats.availableRevenue,
                          points: stats.availableRevenue / 50,
                          method,
                          details: payoutNode.details,
                          kyc: payoutNode.kyc,
                          status: 'Pending',
                          requestedAt: serverTimestamp()
                        };

                        const redemptionRef = await addDoc(collection(db, 'redemptions'), payload);
                        const redemptionId = redemptionRef.id;

                        // 🔒 ULTIMATE SYNC: LOCK ALL CONTRIBUTING CASES
                        try {
                           const casesQuery = query(
                              collection(db, 'cases'), 
                              where('doctorUid', '==', user?.uid),
                              where('status', '==', 'Approved')
                           );
                           const casesSnap = await getDocs(casesQuery);
                           const batch = writeBatch(db);
                           let lockCount = 0;
                           
                           casesSnap.forEach((caseDoc) => {
                              const cd = caseDoc.data();
                              if (!cd.payout_locked) {
                                 batch.update(caseDoc.ref, { 
                                    payout_locked: true, 
                                    redemption_id: redemptionId,
                                    lockedAt: serverTimestamp()
                                 });
                                 lockCount++;
                              }
                           });
                           
                           if (lockCount > 0) await batch.commit();
                        } catch (e) { console.warn("Case Locking Deferred:", e); }

                        // ✉️ ALER'T ADMIN: New Payout Request Node Active
                        try {
                           await sendEmail({
                             to_email: 'nitinchauhan378@gmail.com',
                             to_name: 'Nitin Chauhan (Admin)',
                             subject: `🚨 NEW PAYOUT REQUEST: ₹${stats.availableRevenue.toLocaleString()}`,
                             message: `Dr. ${payload.doctorName} has just requested a clinical payout.\n\nAmount: ₹${stats.availableRevenue.toLocaleString()}\nMethod: ${method.toUpperCase()}\n\nPlease review the Admin Panel to process this request.`,
                             passcode: 'NEW_PAYOUT_NODE'
                           });
                        } catch(e) { console.warn("Admin Notification Deferred."); }

                        setIsPayoutEditing(false);
                        toast.success("Security Sync: Profile Updated & Request Sent.", { id: toastId });
                        setShowRedeemModal(false);
                     } catch (err: any) {
                        setModalError(err.message || "Cloud Sync Failed.");
                        toast.dismiss(toastId);
                     }
                   }}
                   className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-lg font-black text-[12px] uppercase tracking-[0.3em] shadow-xl shadow-slate-300 active:scale-95 transition-all relative overflow-hidden group"
                >
                   <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                   <span className="relative z-10 flex items-center justify-center gap-3">
                     <ShieldCheck size={18} /> Confirm Professional Withdrawal
                   </span>
                </Button>
                
                <div className="flex items-center justify-center gap-6 pt-2">
                   <div className="flex items-center gap-1.5 grayscale opacity-50"><Lock size={10} /> <span className="text-[8px] font-black uppercase tracking-tighter">AES-256 SYNC</span></div>
                   <div className="flex items-center gap-1.5 grayscale opacity-50"><ShieldCheck size={10} /> <span className="text-[8px] font-black uppercase tracking-tighter">FINANCIAL AUDIT</span></div>
                </div>
             </motion.div>
          </div>
        )}
        {/* Secure Withdrawal History - Auditor View */}
        <div className="space-y-6 pt-10">
           <div className="flex items-center justify-between px-2">
             <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
               <Wallet className="h-4 w-4 text-emerald-600" /> Redemption & Withdrawal History
             </h2>
             <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{redemptions.length} Secure Logs Found</span>
           </div>

               <div className="grid grid-cols-1 gap-4">
                 {redemptions.length > 0 ? (
                   redemptions
                    .sort((a,b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0))
                    .slice((redemptionPage - 1) * redemptionsPerPage, redemptionPage * redemptionsPerPage)
                    .map((red, idx) => (
                     <motion.div
                       key={red.id}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: idx * 0.05 }}
                       className="bg-white border border-slate-100 rounded-lg p-5 hover:shadow-xl transition-all group"
                     >
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                           <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                              <div className={`h-12 w-12 rounded-lg flex items-center justify-center transition-all ${red.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                 {red.method === 'upi' ? <Smartphone size={20} /> : <Landmark size={20} />}
                              </div>
                              <div>
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">#RED-{red.id.slice(-6).toUpperCase()}</p>
                                 <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{red.method === 'upi' ? 'UPI Transfer' : 'Bank Node'} Settlement</h4>
                                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    {red.requestedAt ? new Date(red.requestedAt.seconds * 1000).toLocaleString() : 'Processing...'}
                                 </p>
                              </div>
                           </div>
    
                           <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10 w-full sm:w-auto justify-between sm:justify-end">
                              <div className="text-center sm:text-right">
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Requested Amount</p>
                                 <h3 className="text-xl font-black text-slate-900 tracking-tighter italic">₹{Number(red.amount).toLocaleString()}</h3>
                              </div>
                              <div className={`px-5 py-2 rounded-lg font-black text-[9px] uppercase tracking-[0.2em] border ${
                                 red.status === 'Paid' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600 animate-pulse'
                              }`}>
                                 {red.status} Node
                              </div>
                           </div>
                        </div>
                     </motion.div>
                   ))
                 ) : (
                   <div className="py-16 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-relaxed">No financial redemption logs identified in the clinical stream node.</p>
                   </div>
                 )}
               </div>

               {/* Redemption History Pagination */}
               {redemptions.length > redemptionsPerPage && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-slate-50 mt-4">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        Showing {Math.min(redemptions.length, (redemptionPage - 1) * redemptionsPerPage + 1)}-{Math.min(redemptions.length, redemptionPage * redemptionsPerPage)} of {redemptions.length} Secure Logs
                     </p>
                     <div className="flex items-center gap-2">
                        <Button 
                          onClick={() => setRedemptionPage(p => Math.max(1, p - 1))}
                          disabled={redemptionPage === 1}
                          className="h-9 px-4 bg-white border border-slate-200 text-slate-600 font-black text-[9px] uppercase tracking-widest disabled:opacity-30 rounded-md"
                        >PREV PROTOCOL</Button>
                        <div className="h-9 w-9 bg-slate-900 text-white rounded-md flex items-center justify-center text-[10px] font-black">
                           {redemptionPage}
                        </div>
                        <Button 
                          onClick={() => setRedemptionPage(p => Math.min(Math.ceil(redemptions.length / redemptionsPerPage), p + 1))}
                          disabled={redemptionPage >= Math.ceil(redemptions.length / redemptionsPerPage)}
                          className="h-9 px-4 bg-white border border-slate-200 text-slate-600 font-black text-[9px] uppercase tracking-widest disabled:opacity-30 rounded-md"
                        >NEXT PROTOCOL</Button>
                     </div>
                  </div>
               )}
        </div>
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

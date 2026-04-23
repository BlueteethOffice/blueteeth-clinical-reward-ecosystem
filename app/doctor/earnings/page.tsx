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
  ShieldAlert,
  Users
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
  const [itemsPerPage, setItemsPerPage] = useState(3);
  
  const [redemptionPage, setRedemptionPage] = useState(1);
  const [redemptionsPerPage, setRedemptionsPerPage] = useState(3);

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

  useEffect(() => {
    const handleResize = () => {
      const val = window.innerWidth < 768 ? 2 : 3;
      setItemsPerPage(val);
      setRedemptionsPerPage(val);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [isPayoutEditing, setIsPayoutEditing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [localSearch, setLocalSearch] = useState('');
  const [panImageBase64, setPanImageBase64] = useState<string | null>(null);

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

    // [RECOVERY] Identity Sync & Storage Relief
    if (typeof window !== 'undefined') {
       const CACHE_VER = 'v2_lightweight';
       const storedVer = localStorage.getItem('blueteeth_cache_ver');
       if (storedVer !== CACHE_VER) {
          localStorage.removeItem('blueteeth_earnings_cache');
          localStorage.removeItem('blueteeth_stats_cache');
          localStorage.setItem('blueteeth_cache_ver', CACHE_VER);
          console.log(">>> [CLINICAL RECOVERY]: Storage optimized.");
       }
    }
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
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.error("Redemption Sync Err:", err);
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

      // [PERFORMANCE] Store lightweight metadata (Exclude heavy Blobs/PDFs)
      try {
        const lightweightData = sortedData.map(c => ({
          id: c.id,
          patientName: c.patientName,
          treatment: c.treatment,
          status: c.status,
          points: c.points,
          bonusPoints: c.bonusPoints,
          date: c.date,
          submittedAt: c.submittedAt
        }));
        localStorage.setItem('blueteeth_earnings_cache', JSON.stringify(lightweightData));
      } catch (e) {
        console.warn("Storage Full. Clearing earnings cache.");
        localStorage.removeItem('blueteeth_earnings_cache');
      }

      setLoading(false);
    }, (error) => {
      if (error.code === 'permission-denied') return;
      console.error("Associate Sync Failure:", error);
      setLoading(false);
    });

    return () => {
      unsubRedemptions();
      unsubCases();
    };
  }, [user, db]);

  // Ã°Å¸â€œÅ  Reactive Stats Engine (History + Redemptions change)
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
      const rate = exchangeRate || 50;

      if (!isM) {
        if (curr.status === 'Approved') {
          clP += Number(curr.points || 0);
          adP += Number(curr.bonusPoints || 0);
          if (cTime > lastT) {
             avR += (Number(curr.points || 0) + Number(curr.bonusPoints || 0)) * rate;
          }
        }
      } else {
        adP += Number(curr.points || 0);
        if (cTime > lastT) {
           avR += Number(curr.points || 0) * rate;
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
    try {
      localStorage.setItem('blueteeth_stats_cache', JSON.stringify(newStats));
    } catch (e) {
      localStorage.removeItem('blueteeth_stats_cache');
    }
  }, [history, redemptions, exchangeRate]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const isManualAdjustment = String(item.patientName || '').trim().toUpperCase() === "ADMIN MANUAL ADJUSTMENT";
      if (isManualAdjustment) return false;

      // Status Filter Logic
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;

      const q = (localSearch || searchQuery).toLowerCase();
      if (!q) return true;
      return (
        String(item.patientName || '').toLowerCase().includes(q) ||
        String(item.treatment || '').toLowerCase().includes(q)
      );
    });
  }, [history, searchQuery, localSearch, statusFilter]);

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
            <title>Blueteeth Associate Proof | ${selectedCase?.patientName || 'Archive'}</title>
            <style>
              body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; font-family: -apple-system, sans-serif; }
              img { max-width: 95%; max-height: 90%; object-fit: contain; box-shadow: 0 25px 50px rgba(0,0,0,0.5); border-radius: 12px; }
              embed { width: 100%; height: 100%; }
              .header { position: fixed; top: 0; width: 100%; background: rgba(30,41,59,0.8); backdrop-filter: blur(10px); color: white; padding: 15px 30px; display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); }
            </style>
          </head>
          <body>
            <div class="header"><span>BLUETEETH SECURE AUDIT</span><span>${new Date().toLocaleDateString()}</span></div>
            ${url.includes('application/pdf') ? '<embed src="' + url + '" type="application/pdf">' : '<img src="' + url + '">'}
          </body>
        </html>
      `);
      newTab.document.close();
    }
  };

  if (!isMounted) return null;

  return (
    <DashboardLayout>
      <div className="flex-1 w-full max-w-[1600px] mx-auto px-2 sm:px-6 lg:px-8 pb-2 space-y-4 overflow-x-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-0">
          <div className="order-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">Your Earnings Summary</h1>
            <p className="text-slate-600 font-bold text-[9px] sm:text-[11px] mt-1 uppercase tracking-[0.15em] sm:tracking-widest leading-none">History of all your reward points and payouts</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto order-2">
            <Button 
                onClick={() => {
                  if (stats.availableRevenue < 500) {
                    setShowThresholdWarning(true);
                  } else {
                    setModalError(null);
                    setShowRedeemModal(true);
                  }
                }}
                className="h-14 sm:h-12 w-full md:w-auto px-8 rounded-[4px] sm:rounded-[4px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest border border-white/20"
            >
              Request Payout
            </Button>
          </div>
        </div>

        {/* Hero Stats Section - Stable Heights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="p-6 bg-gradient-to-br from-blue-700 to-blue-950 border-none rounded-[4px] sm:rounded-[4px] relative overflow-hidden shadow-lg shadow-blue-900/20 group h-24">
            <div className="absolute right-0 top-0 w-32 h-24 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700" />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Available to Withdraw</div>
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-white tracking-tighter">₹{(stats as any).availableRevenue?.toLocaleString() || '0'}</h3>
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
                   <span className="text-[8px] font-black text-white/60 uppercase tracking-widest">Ready to be paid out</span>
                </div>
              </div>
            </div>
          </Card>
 
          <Card className="p-6 bg-white border-slate-100 rounded-[4px] sm:rounded-[4px] shadow-md shadow-slate-200/40 h-24 border-t-4 border-t-indigo-500">
            <div className="flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">Total Earnings</div>
              <div className="space-y-1">
                 <h2 className="text-2xl font-black text-slate-900 tracking-tighter">₹{Math.round(stats.totalRevenue).toLocaleString()}</h2>
                 <p className="text-[8px] font-black text-indigo-500 uppercase tracking-tighter">Across all your {history.length} cases</p>
              </div>
            </div>
          </Card>
 
          <Card className="p-6 bg-white border-slate-100 rounded-[4px] sm:rounded-[4px] shadow-md shadow-slate-200/40 h-24 border-t-4 border-t-blue-500">
            <div className="flex flex-col h-full justify-between">
              <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">Already Paid Out</div>
              <div className="space-y-1">
                 <h2 className="text-2xl font-black text-slate-900 tracking-tighter">₹{totalRedeemedAmount.toLocaleString()}</h2>
                 <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Successful bank transfers</p>
              </div>
            </div>
          </Card>
 
          <Card className="p-6 bg-white border-slate-100 rounded-[4px] sm:rounded-[4px] shadow-md shadow-slate-200/40 h-24 border-t-4 border-t-amber-500 group">
             <div className="flex flex-col h-full justify-between relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-10 transition-opacity"><Gift className="text-amber-500" size={40} /></div>
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">Total Points Earned</div>
                <div className="flex flex-col space-y-1">
                   <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
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
        <Card className="border-none rounded-[4px] sm:rounded-[4px] shadow-lg shadow-slate-200/40 bg-white overflow-visible">
          <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-600 to-blue-900 border-b border-blue-800 flex items-center justify-between relative overflow-hidden rounded-t-[4px] sm:rounded-t-lg shadow-inner">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
             <div className="flex items-center gap-4 relative z-10">
                <div className="h-10 w-10 sm:h-11 sm:w-11 bg-white/20 rounded-[4px] sm:rounded-[4px] flex items-center justify-center text-white border border-white/20 shadow-inner backdrop-blur-md">
                   <HistoryIcon size={18} className="sm:size-5" />
                </div>
                <div>
                   <h3 className="text-[11px] sm:text-sm font-black text-white uppercase tracking-widest leading-none">Payment History</h3>
                   <p className="text-[8px] sm:text-[9px] font-black text-blue-100 uppercase tracking-widest mt-1.5 opacity-80 leading-none">Official Transaction Node</p>
                </div>
             </div>
             <div className="text-[8px] sm:text-[9px] font-black text-white bg-white/20 px-3 sm:px-4 py-2 rounded-[4px] sm:rounded-[4px] uppercase tracking-widest border border-white/20 backdrop-blur-md shadow-md relative z-10 transition-all hover:bg-white/10 whitespace-nowrap">
               Registry Active
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
                  className={`p-3 active:bg-blue-50/50 transition-colors border-l-4 ${
                     item.status === 'Approved' ? 'border-l-emerald-500 bg-emerald-50/10' :
                     item.status === 'Pending' ? 'border-l-amber-500 bg-amber-50/10' : 'border-l-rose-500 bg-rose-50/10'
                  } mb-2 bg-white shadow-sm rounded-r-[4px] border border-slate-100`}
                >
                  <div className="flex justify-between items-start mb-2">
                     <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">{item.patientName}</p>
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1 flex items-center gap-1.5 leading-none"><Calendar size={10} className="text-slate-400" /> {item.date}</p>
                     </div>
                     <span className={`inline-flex px-2.5 py-1 rounded-[4px] text-[8px] font-black uppercase tracking-widest border items-center gap-1 ${
                        item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                        item.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                     }`}>
                        {item.status === 'Approved' && <CheckCircle2 size={10} className="text-emerald-500" />}
                        {item.status}
                     </span>
                  </div>
                  <div className="flex justify-between items-end">
                     <div>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 leading-none">Net Cash Value</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">₹{Math.round((Number(item.points || 0) + Number(item.bonusPoints || 0)) * exchangeRate).toLocaleString()}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[16px] font-black text-blue-600 leading-none">
                           +{(Number(item.points || 0) + Number(item.bonusPoints || 0)).toFixed(1)} 
                           <span className="text-[8px] ml-1 uppercase tracking-tighter">Pts</span>
                        </p>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1.5 leading-none">Points Earned</p>
                     </div>
                  </div>
                </div>
              ))
            ) : (
                <div className="p-12 text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-loose">
                  No earnings found yet
                </div>
            )}
          </div>

          {/* Desktop View - Full Professional Table */}
          <div className="hidden lg:block w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-blue-900 text-white border-b border-blue-800">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Patient Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Points Earned</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider">Cash Value</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-[4px] w-32"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-[4px] w-20"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-[4px] w-16"></div></td>
                      <td className="px-10 py-8"><div className="h-4 bg-slate-50 rounded-[4px] w-24 mx-auto"></div></td>
                      <td className="px-10 py-8"></td>
                    </tr>
                   ))
                ) : currentItems.length > 0 ? (
                  currentItems.map((item, idx) => (
                    <motion.tr 
                      key={item.id}
                      className={`group transition-all hover:bg-slate-50/70 border-b border-slate-50 last:border-0 border-l-4 ${
                        item.status === 'Approved' ? 'border-l-emerald-500 bg-emerald-50/10' :
                        item.status === 'Pending' ? 'border-l-amber-500 bg-amber-50/10' : 'border-l-rose-500 bg-rose-50/10'
                      }`}
                    >
                      <td className="px-6 py-1.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-[14px] group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none">{item.patientName}</span>
                          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-2 flex items-center gap-2">
                             <Calendar size={10} className="text-slate-500" /> {item.date}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-1.5">
                        <div className="flex flex-col">
                           <span className="font-bold text-blue-600 text-sm">
                             +{(Number(item.points || 0)).toFixed(1)}
                             {item.bonusPoints > 0 && <span className="text-emerald-500 ml-1"> (+{Number(item.bonusPoints).toFixed(1)})</span>}
                           </span>
                           <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">Reward Points</span>
                        </div>
                      </td>
                      <td className="px-6 py-1.5">
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-800 text-[16px] tracking-tighter">₹{Math.round((Number(item.points || 0) + Number(item.bonusPoints || 0)) * exchangeRate).toLocaleString()}</span>
                           <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cash Value</span>
                        </div>
                      </td>
                      <td className="px-6 py-1.5 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-[4px] border mx-auto ${
                           item.status === 'Approved' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 
                           item.status === 'Pending' ? 'bg-amber-50/50 border-amber-100 text-amber-600' : 'bg-rose-50 border-rose-100 text-rose-500'
                        }`}>
                           <div className={`h-1.5 w-1.5 rounded-full ${item.status === 'Approved' ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20' : item.status === 'Pending' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                           <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                              {item.status === 'Approved' && <CheckCircle2 size={11} className="text-emerald-500" />}
                              {item.status}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 pr-12 py-3 text-right">
                        <button 
                           onClick={() => setSelectedCase(item)}
                           className="h-11 w-10 rounded-[4px] bg-white border border-slate-100 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:shadow-md transition-all flex items-center justify-center active:scale-90 ml-auto"
                        >
                           <Eye className="h-5 w-5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                   <tr>
                    <td colSpan={5} className="px-10 py-32 text-center text-slate-600 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest leading-loose">
                        No earnings found yet
                      </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-4 sm:p-8 bg-slate-50/20 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6">
               <p className="hidden sm:block text-[10px] font-black text-slate-600 uppercase tracking-widest flex-1 text-center sm:text-left leading-none">
                  Archive Node {currentPage} OF {totalPages} <span className="mx-2 opacity-20">|</span> Total {filteredHistory.length}
               </p>
               <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                  <Button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-12 px-6 rounded-[4px] sm:rounded-[4px] bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase transition-all active:scale-95 disabled:opacity-30"
                  >
                    Prev
                  </Button>
                  <div className="flex gap-1.5 sm:gap-2">
                      {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`h-12 w-10 rounded-[4px] sm:rounded-[4px] font-black text-[11px] sm:text-[10px] transition-all ${
                            currentPage === i + 1 
                            ? 'bg-blue-600 text-white shadow-md shadow-sm translate-y-[-2px]' 
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
                    className="h-12 px-6 rounded-[4px] sm:rounded-[4px] bg-blue-600 border-none text-white font-black text-[10px] uppercase transition-all active:scale-95 disabled:opacity-30 shadow-md shadow-blue-500/20"
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
                className="relative bg-white/80 backdrop-blur-3xl w-full max-w-md rounded-[4px] shadow-lg overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[96vh] p-2 sm:p-0 border border-white"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/20 to-transparent pointer-events-none" />
                 {/* Modal Header - Full-Vibrancy Water-Glass Strip (Pati) */}
                 <div className="p-3 sm:p-4 bg-[#020617] border-b border-blue-900/10 flex items-center justify-between relative overflow-hidden shrink-0 rounded-t-lg sm:rounded-none">
                    {/* Water shine overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                     <div className="flex items-center gap-4 relative z-10">
                        <div className="h-9 w-9 sm:h-10 sm:w-10 bg-blue-600/10 rounded-[4px] flex items-center justify-center text-blue-400 border border-white/20 shadow-lg">
                           <FileText size={20} />
                        </div>
                        <div>
                           <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-none mb-1">Case Details Summary</h3>
                           <div className="flex items-center gap-2">
                             <ShieldCheck size={11} className="text-blue-400" />
                             <p className="text-[12px] font-bold text-white uppercase tracking-tight">Case ID: <span className="text-blue-400">#{(selectedCase.id || '').toUpperCase().slice(0, 10)}</span></p>
                           </div>
                        </div>
                     </div>

                    <div className="flex items-center gap-3 relative z-10">
                       <div className="hidden sm:flex px-3 py-1.5 rounded-full border border-blue-600/50 bg-blue-600/10 items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Active Sink</span>
                       </div>
                       <button 
                         onClick={() => setSelectedCase(null)} 
                         className="h-10 w-10 rounded-[4px] bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95 border border-white/20 cursor-pointer"
                       >
                          <X size={18} />
                       </button>
                    </div>
                 </div>

                 {/* Modal Body - High-Contrast Vibrant List */}
                    {/* Modal Body - Grid Architecture */}
                    <div className="p-3 sm:p-6 space-y-3 bg-white/50 overflow-y-auto flex-1 no-scrollbar backdrop-blur-xl">
                      {[
                        { label: 'Patient Name', value: selectedCase.patientName, icon: User, color: 'text-white', bg: 'bg-blue-600 shadow-sm' },
                        { label: 'Mobile Number', value: selectedCase.patientMobile || '9876500000', icon: Phone, color: 'text-white', bg: 'bg-emerald-600 shadow-sm' },
                        { label: 'Treatment Type', value: selectedCase.treatment || 'Orthodontics', icon: Stethoscope, color: 'text-white', bg: 'bg-violet-600 shadow-sm' },
                        { label: 'Submission Date', value: selectedCase.date, icon: Calendar, color: 'text-white', bg: 'bg-orange-600 shadow-sm' },
                      ].map((item, idx) => (
                         <div key={idx} className="flex items-center gap-4 p-1.5 bg-white border border-slate-100 rounded-[4px] shadow-sm group hover:border-blue-200 transition-all">
                            <div className={`h-10 w-10 ${item.bg} ${item.color} rounded-[4px] flex items-center justify-center border border-white/40 shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                               <item.icon size={18} />
                            </div>
                            <div className="flex-1">
                               <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest leading-none mb-1">{item.label}</p>
                               <p className="text-[13px] font-bold text-slate-900 uppercase tracking-tight">{item.value}</p>
                            </div>
                         </div>
                      ))}

                      {selectedCase.status === 'Approved' && (
                        <div className="space-y-3">
                           <div className="flex items-center gap-4 p-2 bg-emerald-50/50 border border-emerald-100 rounded-[4px] shadow-sm border-dashed">
                              <div className="h-10 w-10 bg-emerald-600 text-white rounded-[4px] flex items-center justify-center border border-white/40 shadow-lg shadow-sm">
                                 <ShieldCheck size={20} />
                              </div>
                              <div className="flex-1">
                                 <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest leading-none mb-1.5">Verified Specialist Identity</p>
                                 <p className="text-[14px] font-black text-slate-900 uppercase leading-none">{selectedCase.solvedByName || 'Dr. Specialist'}</p>
                                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">Reg No: {selectedCase.solvedByRegNo || 'REG-Verified'}</p>
                              </div>
                           </div>

                           <div className="p-2 bg-slate-50 border border-slate-100 rounded-[4px]">
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 leading-none">Clinical Conclusion</p>
                              <p className="text-[11px] font-medium text-slate-700 italic leading-relaxed">"{selectedCase.clinicianNotes || 'Case resolution manifest finalized by medical node.'}"</p>
                           </div>
                        </div>
                      )}

                      {/* Vibrant Points Card */}
                      <div className="p-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-[4px] shadow-lg shadow-blue-600/10 relative overflow-hidden group border border-white/20">
                         <div className="absolute right-0 top-0 w-24 h-24 bg-white/20 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                         <div className="flex items-center justify-between relative z-20">
                            <div>
                               <p className="text-[9px] font-bold text-blue-100 uppercase tracking-widest leading-none mb-1">Total Case Points</p>
                               <h4 className="text-2xl font-bold text-white tracking-tighter">+{selectedCase.points} <span className="text-[10px] text-blue-200">B-PTS</span></h4>
                            </div>
                            <div className="text-right">
                               <p className="text-[9px] font-bold text-blue-100 uppercase tracking-widest leading-none mb-1">Cash Value</p>
                               <h4 className="text-2xl font-bold text-white tracking-tighter">₹{Math.round((Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)) * exchangeRate).toLocaleString()}</h4>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-3">
                         <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest opacity-80">Evidence Proof</p>
                            <span className="text-[8px] font-black text-blue-600 uppercase px-2 py-0.5 bg-blue-50 rounded border border-blue-100">Official Node</span>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div 
                               onClick={() => selectedCase.evidenceUrl && handleViewAttachment(selectedCase.evidenceUrl)}
                               className="h-12 bg-gradient-to-r from-slate-800 to-black rounded-[4px] flex items-center justify-center gap-3 hover:from-black hover:to-slate-900 cursor-pointer group transition-all shadow-md shadow-slate-200 border border-white/10"
                            >
                               <div className="h-8 w-8 bg-white/10 text-white rounded-[4px] flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg backdrop-blur-md border border-white/20">
                                  <FileImage size={14} />
                               </div>
                               <p className="text-[9px] font-bold text-white uppercase tracking-tighter">Source Proof</p>
                            </div>
                            {selectedCase.finalProof && (
                               <div 
                                  onClick={() => handleViewAttachment(selectedCase.finalProof)}
                                  className="h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[4px] flex items-center justify-center gap-3 hover:from-emerald-600 hover:to-teal-700 cursor-pointer group transition-all shadow-md shadow-emerald-500/10 border border-white/20"
                               >
                                  <div className="h-8 w-8 bg-white/20 text-white rounded-[4px] flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg backdrop-blur-md border border-white/10">
                                     <BadgeCheck size={14} />
                                  </div>
                                  <p className="text-[9px] font-bold text-white uppercase tracking-tighter">Clinical Proof</p>
                               </div>
                            )}
                         </div>
                      </div>
                    </div>

                  {/* Modal Footer */}
                  <div className="p-3 sm:p-4 shrink-0 bg-white border-t border-slate-100">
                     <Button onClick={() => setSelectedCase(null)} className="w-full bg-[#020617] hover:bg-black text-white h-12 rounded-[4px] font-bold text-[12px] uppercase tracking-[0.3em] active:scale-95 transition-all shadow-lg relative overflow-hidden group">Close Details Summary</Button>
                  </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        {/* Withdrawal Threshold Warning Modal */}
        <AnimatePresence>
          {showThresholdWarning && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setShowThresholdWarning(false)} 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-sm rounded-[4px] p-8 shadow-lg border border-slate-100 text-center space-y-6"
              >
                <div className="h-20 w-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <ShieldAlert size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Minimum Threshold Required</h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                    A minimum balance of <span className="text-blue-600">₹500</span> is required to initiate a clinical payout.
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-[4px] border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Your Current Node</p>
                  <p className="text-2xl font-bold text-slate-900">₹{stats.availableRevenue.toLocaleString()}</p>
                </div>
                <Button 
                  onClick={() => setShowThresholdWarning(false)}
                  className="w-full h-12 bg-slate-900 hover:bg-black text-white rounded-[4px] font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95"
                >
                  Acknowledged & Sync
                </Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Withdrawal Modal & Logic Placeholder */}
        {showRedeemModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowRedeemModal(false)} />
             <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                className="relative bg-white/95 backdrop-blur-3xl w-[95%] sm:w-full max-w-md rounded-[4px] p-5 sm:p-8 space-y-6 shadow-lg border border-white overflow-y-auto no-scrollbar max-h-[92vh] mx-auto"
                onClick={(e) => e.stopPropagation()}
             >
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/10 to-transparent pointer-events-none" />
                <button 
                  onClick={() => setShowRedeemModal(false)}
                  className="absolute top-2 right-2 h-10 w-10 flex items-center justify-center rounded-[4px] bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all active:scale-95 z-[310] border border-slate-100"
                 >
                    <X size={18} />
                </button>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />

                <div className="text-center space-y-2 relative z-10">
                   <div className="h-14 w-14 bg-blue-600 rounded-[4px] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/10 text-white border border-blue-500">
                      <Wallet size={26} />
                   </div>
                   <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">Associate Payout Hub</h2>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Safe Financial Identity Stream</p>
                </div>

                {modalError && (
                    <motion.div initial={{ opacity: 1 }} className="p-4 bg-rose-50 border border-rose-200 rounded-[4px] flex items-start gap-4 shadow-md shadow-rose-100 relative z-20">
                       <ShieldAlert className="text-rose-600 shrink-0 mt-0.5" size={16} />
                       <div className="flex-1">
                          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-widest mb-1 leading-none">Security Alert</p>
                          <p className="text-[11px] font-bold text-rose-600/90 leading-tight">{modalError}</p>
                       </div>
                       <button onClick={() => setModalError(null)} className="text-rose-400 hover:text-rose-700 transition-colors"><X size={14} /></button>
                    </motion.div>
                 )}

                <div className="bg-blue-600 py-4 px-6 rounded-[4px] text-center shadow-md shadow-blue-600/20 relative overflow-hidden group text-white border border-blue-500">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
                   <div className="flex flex-col items-center relative z-10">
                      <p className="text-[9px] font-bold text-blue-100 uppercase tracking-widest mb-1 opacity-80">Available Liquidity</p>
                      <h1 className="text-4xl font-bold text-white tracking-tighter">₹{stats.availableRevenue.toLocaleString()}</h1>
                   </div>
                </div>

                <div className="space-y-4 relative z-10">
                   <div className="space-y-4 px-1 sm:px-2">
                     <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest border-l-4 border-blue-600 pl-4">Step 1: Select Transfer Node</p>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-[4px]">
                      {['upi', 'bank'].map((method) => (
                        <button
                          key={method}
                          onClick={() => setPayoutMethod(method as 'upi' | 'bank')}
                          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-[4px] transition-all ${payoutMethod === method ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          {method === 'upi' ? `Saved UPI ${userData?.payoutNode?.method === 'upi' ? '✓' : ''}` : `Bank Node ${userData?.payoutNode?.method === 'bank' ? '✓' : ''}`}
                        </button>
                      ))}
                    </div>
                  </div>

                   <div className="space-y-4 px-1 sm:px-2">
                     <div className="flex items-center justify-between">
                       <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest border-l-4 border-emerald-500 pl-4">
                         Step 2: Financial Credentials {userData?.payoutNode && !isPayoutEditing && <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] rounded font-bold tracking-tighter">SYSTEM LOCKED</span>}
                      </p>
                      <button 
                        onClick={() => {
                          setIsPayoutEditing(!isPayoutEditing);
                          if (!isPayoutEditing) toast.success("Security Node: Edit Mode Active");
                        }}
                        className={`text-[8px] font-bold uppercase tracking-widest hover:underline ${isPayoutEditing ? 'text-amber-600' : 'text-blue-600'}`}
                      >
                         {isPayoutEditing ? '[ LOCK & SAVE VIEW ]' : '[ EDIT / UPDATE NODE ]'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {payoutMethod === 'bank' ? (
                        <>
                          <input id="payout_bank_acc" key={`acc_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.accountNumber} placeholder="Account Number" className="payout-input w-full h-11 bg-white border-2 border-blue-300 rounded-[4px] px-4 text-[12px] font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all disabled:opacity-60" disabled={!isPayoutEditing} />
                          <input id="payout_bank_ifsc" key={`ifsc_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.ifsc} placeholder="IFSC Code" className="payout-input w-full h-11 bg-white border-2 border-blue-300 rounded-[4px] px-4 text-[12px] font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all uppercase disabled:opacity-60" disabled={!isPayoutEditing} />
                          <input id="payout_bank_name" key={`bank_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.bankName} placeholder="Bank Name" className="payout-input w-full h-11 bg-white border-2 border-blue-300 rounded-[4px] px-4 text-[12px] font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all disabled:opacity-60" disabled={!isPayoutEditing} />
                          <input id="payout_bank_holder" key={`hold_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.holderName} placeholder="Account Holder Name" className="payout-input w-full h-11 bg-white border-2 border-blue-300 rounded-[4px] px-4 text-[12px] font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all disabled:opacity-60" disabled={!isPayoutEditing} />
                        </>
                      ) : (
                        <input id="payout_upi_id" key={`upi_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.details?.upiId} placeholder="Enter UPI ID (e.g. name@upi)" className="payout-input w-full h-11 bg-white border-2 border-blue-300 rounded-[4px] px-4 text-[12px] font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all md:col-span-2 disabled:opacity-60" disabled={!isPayoutEditing} />
                      )}
                    </div>
                  </div>

                   <div className="space-y-4 px-1 sm:px-2">
                     <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest border-l-4 border-rose-500 pl-4">Step 3: Identity Verification (KYC)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                       <input id="payout_kyc_pan" key={`pan_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.kyc?.pan} disabled={!isPayoutEditing} placeholder="PAN Number (10 Digits)" maxLength={10} className="payout-input w-full h-11 bg-white border-2 border-rose-300 rounded-[4px] px-4 text-[12px] font-bold outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-600 transition-all uppercase disabled:opacity-60" />
                       <input id="payout_kyc_aadhar" key={`aad_${userData?.updatedAt}`} defaultValue={userData?.payoutNode?.kyc?.aadhar} disabled={!isPayoutEditing} placeholder="Aadhaar Number (12 Digits)" maxLength={12} className="payout-input w-full h-11 bg-white border-2 border-rose-300 rounded-[4px] px-4 text-[12px] font-bold outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-600 transition-all disabled:opacity-60" />
                    </div>

                    <div className="relative h-12 w-full mt-2 group">
                       <input 
                         type="file" 
                         id="payout_pan_image" 
                         accept="image/*"
                         disabled={!isPayoutEditing}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed" 
                         onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                               const label = document.getElementById('pan_label');
                               if (label) {
                                  const truncated = file.name.length > 25 ? file.name.slice(0, 10) + '...' + file.name.slice(-10) : file.name;
                                  label.innerText = `PAN: ${truncated}`;
                               }
                               const reader = new FileReader();
                               reader.onloadend = () => {
                                  setPanImageBase64(reader.result as string);
                               };
                               reader.readAsDataURL(file);
                            }
                         }}
                       />
                       <div className="w-full h-12 bg-rose-50 border-2 border-dashed border-rose-200 rounded-[4px] flex items-center justify-center gap-3 group-hover:bg-rose-100 transition-all group-hover:border-rose-300">
                          <FileImage className="text-rose-500" size={16} />
                          <span id="pan_label" className="text-[8px] font-bold text-rose-700 uppercase tracking-widest">Upload PAN Image Proof</span>
                       </div>
                    </div>
                  </div>

                   <div className="space-y-4 px-1 sm:px-2 pt-1">
                     <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest border-l-4 border-indigo-600 pl-4">Step 4: Security Verification (OTP)</p>
                    {isOtpSent ? (
                      <div className="grid grid-cols-1 gap-2.5">
                         <input id="payout_otp" placeholder="Enter 6-Digit OTP from Email" maxLength={6} className="w-full h-11 bg-indigo-50 border-2 border-indigo-400 rounded-[4px] px-4 text-[12px] font-bold outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 text-center tracking-[0.5em] transition-all" />
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
                              passcode: otp, 
                              message: `Your Blueteeth Security OTP for Payout Verification is: ${otp}. This code is required to secure your financial identity node.`,
                              subject: "SECURITY: Payout Node Verification",
                              to_name: userData?.name || "Doctor"
                            });
                            setIsOtpSent(true);
                            toast.success("Security OTP Dispatched!", { id: tid });
                          } catch (err) { toast.error("Mail Sync Failure", { id: tid }); }
                        }}
                        className="w-full h-11 bg-slate-900 text-white rounded-[4px] font-bold text-[9px] uppercase tracking-widest active:scale-95"
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
                           throw new Error("Security Advisory: This payout identifier is already registered. Please verify or contact clinical support.");
                        }

                        // 2. SAVE/UPDATE PERMANENT NODE
                        const payoutNode = {
                           method,
                           details: method === 'upi' ? { upiId: upiVal } : { accountNumber: accVal, ifsc: ifscVal.toUpperCase(), bankName: bNameVal, holderName: hNameVal },
                           kyc: { pan: panVal.toUpperCase(), aadhar: aadharVal, panImage: panImageBase64 || userData?.payoutNode?.kyc?.panImage || '' },
                           lastPayoutSync: serverTimestamp()
                        };

                        await setDoc(doc(db, 'users', user?.uid as string), { payoutNode }, { merge: true });

                        // 3. CREATE REDEMPTION
                        const payload: any = {
                          doctorUid: user?.uid,
                          doctorName: userData?.name || user?.displayName || 'Doctor',
                          doctorEmail: user?.email,
                          role: userData?.role || 'associate', // Financial category node
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

                        const finishSync = async () => {
                           try {
                              const syncTasks = [];
                              const casesQuery = query(
                                 collection(db, 'cases'), 
                                 where('doctorUid', '==', user?.uid),
                                 where('status', '==', 'Approved')
                              );
                              const casesSnap = await getDocs(casesQuery);
                              const batch = writeBatch(db);
                              let lockCount = 0;
                              casesSnap.forEach((caseDoc) => {
                                 if (!caseDoc.data().payout_locked) {
                                    batch.update(caseDoc.ref, { payout_locked: true, redemption_id: redemptionId, lockedAt: serverTimestamp() });
                                    lockCount++;
                                 }
                              });
                              if (lockCount > 0) syncTasks.push(batch.commit());

                              syncTasks.push(sendEmail({
                                to_email: user?.email,
                                to_name: payload.doctorName,
                                subject: "Identity Verified: Payout Profile Active",
                                message: `Hello Dr. ${payload.doctorName},\n\nYour payout profile has been successfully verified. Your withdrawal request for Rs.${stats.availableRevenue.toLocaleString()} is currently being processed.`,
                                passcode: 'PAYOUT_SYNC_COMPLETE'
                              }));

                              syncTasks.push(sendEmail({
                                to_email: 'nitinchauhan378@gmail.com',
                                to_name: 'Nitin Chauhan (Admin)',
                                subject: `NEW PAYOUT REQUEST: Rs.${stats.availableRevenue.toLocaleString()}`,
                                message: `Dr. ${payload.doctorName} has just requested a clinical payout.\n\nAmount: Rs.${stats.availableRevenue.toLocaleString()}\nMethod: ${method.toUpperCase()}\n\nPlease review the Admin Panel.`,
                                passcode: 'NEW_PAYOUT_NODE'
                              }));

                              await Promise.allSettled(syncTasks);
                           } catch (e) { console.warn("Background Sync Soft Failure:", e); }
                        };

                        finishSync();

                        setIsPayoutEditing(false);
                        toast.success("Security Sync: Profile Updated & Request Sent.", { id: toastId });
                        setShowRedeemModal(false);
                     } catch (err: any) {
                        setModalError(err.message || "Cloud Sync Failed.");
                        toast.dismiss(toastId);
                     }
                   }}
                   className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-[4px] font-bold text-[12px] uppercase tracking-[0.3em] shadow-md shadow-slate-300 active:scale-95 transition-all relative overflow-hidden group"
                >
                   <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                   <span className="relative z-10 flex items-center justify-center gap-3">
                     <ShieldCheck size={18} /> Confirm Professional Withdrawal
                   </span>
                </Button>

                <div className="flex items-center justify-center gap-6 pt-2">
                   <div className="flex items-center gap-1.5 grayscale opacity-50"><Lock size={10} /> <span className="text-[8px] font-bold uppercase tracking-tighter">AES-256 SYNC</span></div>
                   <div className="flex items-center gap-1.5 grayscale opacity-50"><ShieldCheck size={10} /> <span className="text-[8px] font-bold uppercase tracking-tighter">FINANCIAL AUDIT</span></div>
                </div>
             </motion.div>
          </div>
        )}

        {/* Secure Withdrawal History - Auditor View */}
        <div className="space-y-6 pt-10">
           <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-2">
             <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
               <Wallet className="h-4 w-4 text-blue-600" /> Redemption & Withdrawal History
             </h2>
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">{redemptions.length} Secure Logs Found</span>
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
                   className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-[4px] sm:rounded-[4px] p-5 hover:shadow-lg hover:shadow-blue-500/10 transition-all group relative overflow-hidden"
                 >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-12 -mt-12" />
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                       <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                          <div className={`h-12 w-12 rounded-[4px] flex items-center justify-center transition-all ${red.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                             {red.method === 'upi' ? <Smartphone size={20} /> : <Landmark size={20} />}
                          </div>
                          <div>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">#RED-{red.id.slice(-6).toUpperCase()}</p>
                             <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{red.method === 'upi' ? 'UPI Transfer' : 'Bank Node'} Settlement</h4>
                             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                {red.requestedAt ? new Date(red.requestedAt.seconds * 1000).toLocaleString() : 'Processing...'}
                             </p>
                          </div>
                       </div>

                       <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-center sm:text-right">
                             <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Requested Amount</p>
                             <h3 className="text-xl font-bold text-slate-900 tracking-tighter">₹{Number(red.amount).toLocaleString()}</h3>
                          </div>
                          <div className={`px-5 py-2 rounded-[4px] font-bold text-[9px] uppercase tracking-widest border ${
                             red.status === 'Paid' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600 animate-pulse'
                          }`}>
                             {red.status} Node
                          </div>
                       </div>
                    </div>
                 </motion.div>
               ))
             ) : (
                <div className="py-4 px-8 bg-white border border-slate-200 shadow-md shadow-slate-200/60 rounded-[4px] flex flex-col sm:flex-row items-center justify-center gap-4 relative overflow-hidden group my-4 text-center sm:text-left">
                   <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent pointer-events-none" />
                   <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-600/10 shrink-0">
                      <Wallet size={14} />
                   </div>
                   <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest whitespace-normal leading-relaxed relative z-10">No financial redemption logs identified in the clinical stream node.</p>
                </div>
             )}
           </div>

           {/* Redemption History Pagination */}
           {redemptions.length > redemptionsPerPage && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-slate-50 mt-4">
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Showing {Math.min(redemptions.length, (redemptionPage - 1) * redemptionsPerPage + 1)}-{Math.min(redemptions.length, redemptionPage * redemptionsPerPage)} of {redemptions.length} Secure Logs
                 </p>
                 <div className="flex items-center gap-2">
                    <Button 
                      onClick={() => setRedemptionPage(p => Math.max(1, p - 1))}
                      disabled={redemptionPage === 1}
                      className="h-10 px-5 bg-white border border-slate-200 text-slate-600 font-black text-[9px] uppercase tracking-widest rounded-[4px] sm:rounded-[4px] active:scale-95 transition-all"
                    >PREV NODE</Button>
                    <div className="h-10 w-9 bg-blue-600 text-white rounded-[4px] sm:rounded-[4px] flex items-center justify-center text-[11px] font-black shadow-lg shadow-sm">
                       {redemptionPage}
                    </div>
                    <Button 
                      onClick={() => setRedemptionPage(p => Math.min(Math.ceil(redemptions.length / redemptionsPerPage), p + 1))}
                      disabled={redemptionPage >= Math.ceil(redemptions.length / redemptionsPerPage)}
                      className="h-10 px-5 bg-white border border-slate-200 text-slate-600 font-black text-[9px] uppercase tracking-widest rounded-[4px] sm:rounded-[4px] active:scale-95 transition-all"
                    >NEXT NODE</Button>
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

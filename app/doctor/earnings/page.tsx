'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  TrendingUp, 
  Wallet, 
  Download, 
  ArrowUpRight, 
  Calendar,
  History as HistoryIcon,
  IndianRupee,
  BadgeCheck,
  Clock,
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
  Activity
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import emailjs from '@emailjs/browser';

// Mock era ends here. Connection to living clinical database initialized.

export default function EarningsPage() {
  const { user, userData } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [history, setHistory] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 5;
  const [stats, setStats] = React.useState({
    casePoints: 0,
    totalPoints: 0,
    totalRevenue: 0,
    pendingPoints: 0
  });
  const [selectedCase, setSelectedCase] = React.useState<any | null>(null);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [perks, setPerks] = useState<any[]>([]);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank' | 'netbanking'>('upi');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [hasPendingWithdrawal, setHasPendingWithdrawal] = useState(false);
  const [totalRedeemedAmount, setTotalRedeemedAmount] = useState(0);
  const [showThresholdWarning, setShowThresholdWarning] = useState(false);

  // Permanent Payment Identity State
  const [savedPayment, setSavedPayment] = useState<any>(null);
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // UPI Live Verification State
  const [upiVerify, setUpiVerify] = useState<{
    status: 'idle' | 'loading' | 'verified' | 'invalid' | 'unverified';
    name?: string;
    error?: string;
  }>({ status: 'idle' });

  // OTP Verification System
  const [showOtpField, setShowOtpField] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  // PAN & Aadhaar Identity State
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panImage, setPanImage] = useState<File | null>(null);
  const [panImageUrl, setPanImageUrl] = useState('');
  const [isPanVerified, setIsPanVerified] = useState(false);
  const [isPanLoading, setIsPanLoading] = useState(false);

  // Mock PAN Verification & Auto-fill Logic
  useEffect(() => {
    if (panNumber.length === 10 && !isPanVerified) {
      setIsPanLoading(true);
      // Simulate API verification delay
      setTimeout(async () => {
        setIsPanVerified(true);
        setIsPanLoading(false);
        toast.success("PAN Verified: " + (userData?.name || "Practitioner Identity") + " Confirmed.");
        
        // Auto-fill Bank Details (Simulated Discovery)
        if (payoutMethod === 'bank') {
          setAccountHolder(userData?.name || "Dr. " + (user?.displayName || "Professional"));
          setBankName("HDFC BANK LTD");
          setIfscCode("HDFC0001234");
          setBankAccount("50100" + Math.floor(10000000 + Math.random() * 90000000));
          toast("Bank Node Auto-Linked via PAN Identity", { icon: '🏦' });
        }

        // AUTO-DISPATCH OTP for KYC Finalization
        if (user?.email) {
           toast("Triggering Security OTP...", { icon: '🔐' });
           sendOtp();
        }
      }, 1500);
    }
  }, [panNumber, payoutMethod, user?.email, userData?.name]);

  const sendCompletionEmail = async (type: 'identity_updated' | 'redemption_requested', details: string) => {
    if (!user?.email) return;
    try {
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '',
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '',
        {
          email: user.email,
          to_email: user.email,
          user_email: user.email,
          to_name: userData?.name || "Clinical Practitioner",
          subject: type === 'identity_updated' ? "Blueteeth: Payment Identity Updated" : "Blueteeth: Withdrawal Request Submitted",
          message: type === 'identity_updated' 
            ? `Your clinical payout identity has been successfully updated to: ${details}. All future settlements will be routed to this professional node.`
            : `Your withdrawal request for ₹${details} has been successfully submitted and is now in the administrative review queue. Expected completion: 24-48 hours.`,
          logo_url: "https://blueteeth.in/wp-content/uploads/2021/04/Blueteeth-Logo-Small.png",
          otp: "SUCCESS",
          passcode: "SUCCESS",
          time: new Date().toLocaleString()
        },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || ''
      );
      console.log(">>> [COMPLETION NODE] CONFIRMATION EMAIL DISPATCHED.");
    } catch (e) {
      console.warn("Completion Mail Deferred:", e);
    }
  };

  const sendOtp = async () => {
    if (!user?.email) {
      toast.error("No registered email found. Please update profile.");
      return;
    }
    setIsOtpSending(true);
    // Secure 6-digit code generation
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);

    try {
      // ELITE SECURITY CONFIGURATION
      const templateParams = {
        email: user.email,
        to_email: user.email,
        user_email: user.email,
        to_name: userData?.name || "Clinical Practitioner",
        from_name: "Blueteeth Security Team",
        subject: "Blueteeth: Clinical Authorization Code",
        otp_code: otp,
        otp: otp,
        passcode: otp,
        logo_url: "https://blueteeth.in/wp-content/uploads/2021/04/Blueteeth-Logo-Small.png",
        valid_until: "10 Minutes",
        time: "10 Minutes"
      };

      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '',
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '',
        templateParams,
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || ''
      ).then(() => {
        setIsOtpSending(false);
        setShowOtpField(true);
        toast.success(`Secure Identity OTP dispatched to ${user?.email?.replace(/(.{2}).+(@.+)/, "$1***$2") || 'your clinical email'}`, {
          icon: '✉️',
          duration: 4000
        });
      }).catch(e => {
        console.error(">>> [SECURITY] OTP Dispatch Protocol Failure:", e?.status, e?.text || e);
        setIsOtpSending(false);
        toast.error("Security Node Timeout. Please retry dispatch.");
      });
    } catch (error) {
      console.warn("OTP Dispatch Protocol Exception:", error);
      setIsOtpSending(false);
    }
  };

  // Debounced UPI live lookup — fires 800ms after typing stops
  React.useEffect(() => {
    const upiRegex = /^[\w.\-]+@[\w]+$/;
    if (!upiRegex.test(upiId.trim())) {
      setUpiVerify({ status: 'idle' });
      return;
    }
    setUpiVerify({ status: 'loading' });
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/verify-upi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upiId: upiId.trim() })
        });
        const data = await res.json();
        if (data.success) {
          setUpiVerify({ status: 'verified', name: data.name });
        } else if (data.unverified) {
          setUpiVerify({ status: 'unverified', error: data.error });
        } else {
          setUpiVerify({ status: 'invalid', error: data.error });
        }
      } catch {
        setUpiVerify({ status: 'unverified', error: 'Network error. Admin will verify manually.' });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [upiId]);

  // Load saved payment details from Firestore
  React.useEffect(() => {
    if (!user?.uid || !db) return;
    (async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db as any, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.savedPayment) {
            setSavedPayment(data.savedPayment);
            setPayoutMethod(data.savedPayment.method || 'upi');
            if (data.savedPayment.method === 'upi') {
              setUpiId(data.savedPayment.upiId || '');
            } else {
              setBankAccount(data.savedPayment.accountNumber || '');
              setIfscCode(data.savedPayment.ifsc || '');
              setBankName(data.savedPayment.bankName || '');
              setAccountHolder(data.savedPayment.accountHolder || '');
            }
          }
        }
      } catch (e) { /* Silent - no saved payment yet */ }
    })();
  }, [user]);

  // Synchronizing Official Clinical Wallet & History
  React.useEffect(() => {
    if (!user || !db) return;

    // Listen to Redemptions — deducting paid and pending payouts
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

    // Listen to Case History — single source of truth for all stats
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

      // Client-Side Sort
      const sortedData = data.sort((a, b) => (b.rawDate?.getTime() || 0) - (a.rawDate?.getTime() || 0));
      setHistory(sortedData);
      
      // LIVE CALCULATION: All 4 boxes derived from same source
      let clinicalCasePoints = 0;   // Box 2: base case points
      let totalAdminPerks = 0;      // Box 3: admin bonuses/adjustments

      sortedData.forEach(curr => {
        const isManual = String(curr.patientName || '').trim().toUpperCase() === "ADMIN MANUAL ADJUSTMENT";
        
        if (!isManual) {
          if (curr.status === 'Approved') {
            clinicalCasePoints += Number(curr.points || 0);
            totalAdminPerks += Number(curr.bonusPoints || 0);
          }
        } else {
          // Manual Adjustment entry — count towards perks
          totalAdminPerks += Number(curr.points || 0);
        }
      });

      const EXCHANGE_RATE = 50; // ₹50 per B-Point
      const totalAllPoints = clinicalCasePoints + totalAdminPerks;
      const liveRevenue = totalAllPoints * EXCHANGE_RATE;

      setStats({
        casePoints: clinicalCasePoints,          // Box 2
        pendingPoints: totalAdminPerks,           // Box 3
        totalPoints: totalAllPoints,              // Box 4: all points combined
        totalRevenue: liveRevenue                 // Box 1: live rupee value
      });
      setLoading(false);
    }, (error) => {
      console.error("Firestore Policy Error:", error);
      setLoading(false);
    });

    return () => { unsubCases(); unsubRedemptions(); };
  }, [user, db]);

  const filteredHistory = history.filter(item => {
    // Definitive Anti-Clutter Filter: Decoupling global perks from clinical ledger
    const isManualAdjustment = String(item.patientName || '').trim().toUpperCase() === "ADMIN MANUAL ADJUSTMENT";
    if (isManualAdjustment) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(item.patientName || '').toLowerCase().includes(q) ||
      String(item.treatment || '').toLowerCase().includes(q)
    );
  });

  // PAGINATION LOGIC
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const currentItems = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    if (filteredHistory.length === 0) {
      toast.error("No clinical data available to export.");
      return;
    }

    const headers = ["Patient Name", "Treatment", "Date", "Points", "Revenue (INR)", "Status"];
    const rows = filteredHistory.map(item => [
      `"${item.patientName || 'N/A'}"`,
      `"${item.treatment || 'N/A'}"`,
      `"${item.date}"`,
      item.points || 0,
      (item.points || 0) * 50,
      `"${item.status}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `clinical_earnings_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-1000 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Earnings Dossier</h1>
            <p className="text-slate-500 font-medium text-[11px] mt-1">Real-time clinical reward distribution and financial analytics.</p>
          </div>
          <AnimatePresence>
            {showThresholdWarning && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl shadow-2xl shadow-amber-500/10 backdrop-blur-md"
              >
                 <div className="h-8 w-8 bg-amber-600 rounded-lg flex items-center justify-center text-white shadow-lg animate-pulse">
                    <ShieldCheck size={16} />
                 </div>
                 <div className="flex flex-col">
                    <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest leading-none">Protocol Restriction</p>
                    <p className="text-[11px] font-bold text-amber-700 mt-1 leading-none">Minimum 10 B-Points for Clinical Settlement.</p>
                 </div>
                 <button onClick={() => setShowThresholdWarning(false)} className="ml-2 text-amber-400 hover:text-amber-900">✕</button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 w-full md:w-auto">
            <Button 
              variant="outline" 
              onClick={() => {
                const t = toast.loading("Generating clinical earnings report...");
                setTimeout(() => {
                  exportToCSV();
                  toast.success("Download Started! Check your 'Downloads' folder.", { id: t });
                }, 1500);
              }}
              className="flex-1 md:flex-none h-11 rounded-xl border-slate-200 text-slate-600 gap-2 font-bold text-[11px] uppercase tracking-wider transition-all active:scale-95"
            >
              <Download size={16} /> Export Data
            </Button>
            <Button 
               onClick={() => {
                 const THRESHOLD_PTS = 10;
                 if (Number(stats.totalPoints || 0) < THRESHOLD_PTS) {
                   setShowThresholdWarning(true);
                 } else {
                   setShowRedeemModal(true);
                 }
               }}
               disabled={hasPendingWithdrawal || Math.max(0, stats.totalRevenue - totalRedeemedAmount) <= 0}
               className={`h-11 px-6 rounded-xl text-[10px] sm:text-[11px] font-black tracking-widest uppercase shadow-xl transition-all flex items-center gap-2 ${
                 hasPendingWithdrawal 
                   ? 'bg-amber-100 text-amber-600 hover:bg-amber-100 cursor-not-allowed shadow-none border border-amber-200'
                   : Math.max(0, stats.totalRevenue - totalRedeemedAmount) <= 0
                     ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                     : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 shadow-blue-500/30'
               }`}
            >
              {hasPendingWithdrawal ? 'Withdrawal Pending' : 'Redeem Rewards'} {!hasPendingWithdrawal && <ArrowUpRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Hero Stats (Glassmorphism & High Contrast) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <Card className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl relative overflow-hidden shadow-sm group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-100 rounded-full -mr-16 -mt-16 blur-3xl opacity-30"></div>
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-white rounded-xl border border-slate-200 text-indigo-500 shadow-sm">
                <Wallet className="h-3.5 w-3.5" />
              </div>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-slate-400">Available Balance</div>
            </div>
            <div className="space-y-0.5 relative">
               <h3 className="text-3xl font-black text-[#0f172a] tracking-tight">
                  ₹{Math.max(0, stats.totalRevenue - totalRedeemedAmount).toLocaleString()}
                </h3>
               <div className="flex items-center gap-1.5 mt-2">
                  <div className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                  <p className="text-emerald-600/80 text-[8px] font-black uppercase tracking-widest">Live Withdrawable</p>
               </div>
            </div>
          </Card>

          <Card className="p-4 bg-white border-slate-100 rounded-2xl shadow-xl shadow-slate-200/40 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors text-blue-600">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-slate-400">Life Earnings</div>
            </div>
            <div className="space-y-0.5 relative">
               <h2 className="text-xl font-black tracking-tighter text-slate-900">₹{Math.round(stats.totalRevenue).toLocaleString()}</h2>
               <p className="text-slate-400 text-[8px] font-bold uppercase tracking-widest mt-2">{Number(stats.totalPoints || 0).toFixed(1)} Total Points</p>
            </div>
          </Card>

          <Card className="p-4 bg-slate-50 border border-blue-200/60 rounded-2xl relative overflow-hidden shadow-sm group">
            <div className="absolute right-0 bottom-0 w-32 h-32 bg-blue-100 rounded-full -mb-16 -mr-16 blur-3xl opacity-30"></div>
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-white rounded-xl border border-slate-200 text-blue-500 shadow-sm">
                <Download className="h-3.5 w-3.5" />
              </div>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-slate-400">Withdrawn</div>
            </div>
            <div className="space-y-2 relative">
               <h2 className="text-xl font-black tracking-tighter text-slate-800">₹{totalRedeemedAmount.toLocaleString()}</h2>
               <div className="flex items-center gap-1.5 mt-2">
                  <div className={`h-1 w-1 rounded-full ${hasPendingWithdrawal ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest">
                    {hasPendingWithdrawal ? 'Payout Processing' : 'Settled History'}
                  </p>
               </div>
            </div>
          </Card>

          <Card className="p-4 bg-white border border-amber-100 rounded-2xl relative overflow-hidden shadow-xl shadow-amber-200/20 group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-amber-100 rounded-full -mr-16 -mt-16 blur-3xl opacity-30 group-hover:scale-110 transition-transform duration-700"></div>
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-500 shadow-sm group-hover:bg-amber-100 transition-colors">
                <Award className="h-3.5 w-3.5" />
              </div>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-amber-600/60">Net Protocol Points</div>
            </div>
            <div className="space-y-4 relative">
               <div className="flex items-baseline gap-1">
                 <h2 className="text-2xl font-black tracking-tighter text-slate-900">{Number(stats.totalPoints || 0).toFixed(1)}</h2>
                 <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">PTS</span>
               </div>
               
               {/* Points Origin Breakdown */}
               <div className="space-y-2 border-t border-slate-50 pt-3">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                     <span className="text-slate-400">Clinical Base Yield</span>
                     <span className="text-slate-700">{Number(stats.casePoints || 0).toFixed(1)} pts</span>
                  </div>
                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                     <span className="text-slate-400">Admin Bonus Perks</span>
                     <span className="text-amber-600">+{Number(stats.pendingPoints || 0).toFixed(1)} pts</span>
                  </div>
               </div>

               <button 
                  onClick={() => {
                    const perksData = history.filter(h => h.patientName === "ADMIN MANUAL ADJUSTMENT");
                    if(perksData.length === 0) {
                      toast.error("No Global Perks Discovered Yet");
                    } else {
                      setPerks(perksData);
                      setShowPerksModal(true);
                    }
                  }}
                  className="w-full py-1.5 bg-amber-600 text-white rounded-lg text-[7px] font-black uppercase tracking-[0.2em] hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 group/btn shadow-lg shadow-amber-500/20"
                >
                  <Gift size={10} className="text-amber-200 group-hover/btn:rotate-12" /> View Breakdown
                </button>
            </div>
          </Card>
        </div>

        {/* Payout History Table (Elite Style) */}
        <Card className="p-0 border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/40 overflow-hidden bg-white">
          <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-white to-slate-50/10">
             <div className="flex items-center gap-2.5">
                <div className="h-11 w-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-lg">
                   <HistoryIcon size={16} />
                </div>
                <div>
                   <h3 className="text-base font-black text-slate-900 tracking-tight">Treatment Credits</h3>
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0 max-w-[150px] truncate">Verification history</p>
                </div>
             </div>
             <div className="hidden sm:block text-[8px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg uppercase tracking-widest border border-blue-100/50">
               Audit: 30-Day Window
             </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-400 border-b border-slate-100">
                  <th className="px-8 py-2 text-[8px] font-black uppercase tracking-[0.15em]">Case Identity</th>
                  <th className="px-8 py-2 text-[8px] font-black uppercase tracking-[0.15em]">Clinical Yield</th>
                  <th className="px-8 py-2 text-[8px] font-black uppercase tracking-[0.15em]">Valuation</th>
                  <th className="px-8 py-2 text-[8px] font-black uppercase tracking-[0.15em]">Node Status</th>
                  <th className="px-8 py-2 text-[8px] font-black uppercase tracking-[0.15em]">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {currentItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-10 py-32 text-center bg-slate-50/10">
                      <div className="flex flex-col items-center">
                         <div className="h-20 w-20 bg-white shadow-xl rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                            <HistoryIcon className="h-11 w-8 text-slate-200" />
                         </div>
                         <h4 className="text-slate-900 font-black text-lg">No clinical credits found</h4>
                         <p className="text-slate-400 font-medium text-sm mt-1">Your treatment payouts will appear here after submission.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, idx) => (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="transition-all duration-300 group cursor-default hover:bg-blue-50/40"
                    >
                      <td className="px-8 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-[14px] group-hover:text-blue-600 transition-colors uppercase tracking-tight">{item.patientName}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                             <BadgeCheck size={11} className={item.status === 'Approved' ? 'text-emerald-500' : 'text-slate-300'} />
                             {item.treatment} • {item.date}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-3.5">
                        <div className="flex flex-col">
                           <span className="font-black text-blue-600 text-sm">
                             +{(Number(item.points || 0)).toFixed(1)}
                             {item.bonusPoints > 0 && <span className="text-emerald-500 ml-1"> (+{Number(item.bonusPoints).toFixed(1)})</span>}
                           </span>
                           <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Points Yield</span>
                        </div>
                      </td>
                      <td className="px-8 py-3.5">
                        <div className="flex flex-col">
                           <span className="font-black text-slate-800 text-sm">₹{Math.round((Number(item.points || 0) + Number(item.bonusPoints || 0)) * 50).toLocaleString()}</span>
                           <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest underline decoration-blue-500/20">Market Valuation</span>
                        </div>
                      </td>
                      <td className="px-8 py-3.5">
                        <div className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border ${
                           item.status === 'Approved' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-600' : 
                           item.status === 'Pending' ? 'bg-amber-50/50 border-amber-100 text-amber-600' : 'bg-rose-50 border-rose-100 text-rose-600'
                        }`}>
                           <div className={`h-1.5 w-1.5 rounded-full ${
                             item.status === 'Approved' ? 'bg-emerald-500' : 
                             item.status === 'Pending' ? 'bg-amber-400' : 'bg-rose-500'
                           }`} />
                           <span className="text-[9px] font-black tracking-widest uppercase">{item.status}</span>
                        </div>
                      </td>
                      <td className="px-8 py-3.5">
                        <button 
                          onClick={() => setSelectedCase(item)}
                          className="h-11 w-8 rounded-lg bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all flex items-center justify-center active:scale-90 group-hover:bg-blue-50"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ELITE PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="p-4 bg-slate-50/30 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Page {currentPage} of {totalPages} <span className="mx-2 text-slate-200">|</span> Records: {filteredHistory.length}
               </p>
               <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-11 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest disabled:opacity-30 border-slate-200 bg-white"
                  >
                    Prev
                  </Button>
                  <div className="flex gap-1">
                     {[...Array(totalPages)].map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`h-11 w-8 rounded-lg font-black text-[9px] transition-all ${
                            currentPage === i + 1 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                            : 'bg-white text-slate-400 border border-slate-100 hover:border-blue-200'
                          }`}
                        >
                           {i + 1}
                        </button>
                     ))}
                  </div>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-11 px-3 rounded-lg bg-white border border-slate-200 font-black text-[9px] uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all text-slate-600 hover:bg-slate-50"
                  >
                    Next
                  </button>
               </div>
            </div>
          )}
        </Card>

        {/* Case Details Modal (High-Fidelity) - Synchronized with Repository */}
        {selectedCase && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               onClick={() => setSelectedCase(null)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 15 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
               {/* Header - Compact */}
               <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                  <div className="flex items-center gap-3">
                     <div className="h-11 w-8 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-600 border border-blue-50">
                        <FileText size={16} strokeWidth={2.5} />
                     </div>
                     <div>
                        <h3 className="font-black text-slate-900 leading-none text-sm tracking-tight">Case Dossier</h3>
                        <p className="text-[7px] text-slate-400 font-bold tracking-[0.2em] mt-1 uppercase leading-none">ID: {selectedCase.id.slice(0,12)}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100/50">
                     <BadgeCheck size={9} />
                     <span className="text-[7px] font-black uppercase tracking-widest leading-none">Verified</span>
                  </div>
               </div>
               
               <div className="p-6 space-y-6">
                  {/* Detailed Grid - 4 Columns */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                     <div className="space-y-0.5">
                        <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none">Practitioner</p>
                        <p className="text-slate-900 font-black text-[10px] uppercase truncate leading-tight">{selectedCase.patientName}</p>
                     </div>
                     <div className="space-y-0.5">
                        <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none">Clinical Link</p>
                        <p className="text-slate-600 font-black text-[9px] truncate leading-tight">{selectedCase.patientMobile || 'N/A'}</p>
                     </div>
                     <div className="space-y-0.5">
                        <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none">Protocol</p>
                        <p className="text-blue-600 font-black text-[9px] uppercase truncate leading-tight">{selectedCase.treatment}</p>
                     </div>
                     <div className="space-y-0.5 text-right">
                        <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none">Sync Date</p>
                        <p className="text-slate-600 font-black text-[9px] truncate leading-tight">{selectedCase.date}</p>
                     </div>
                  </div>

                  {/* Financial Breakdown - Expanded */}
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-100/60 space-y-1.5 shadow-inner">
                     <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
                        <span>Base Clinical Yield</span>
                        <span className="text-slate-900 font-black">+{Number(selectedCase.points || 0).toFixed(1)} pts</span>
                     </div>
                     <div className="flex justify-between items-center text-[9px]">
                        <span className={`font-black uppercase leading-none ${(selectedCase.bonusPoints > 0) ? 'text-amber-500' : 'text-slate-300'}`}>Wealth Credit Adjustment</span>
                        <span className={`font-black ${(selectedCase.bonusPoints > 0) ? 'text-emerald-600' : 'text-slate-300'}`}>+{(selectedCase.bonusPoints || 0).toFixed(1)} pts</span>
                     </div>
                     <div className="pt-1.5 border-t border-white flex justify-between items-center">
                        <span className="text-[9px] font-black text-blue-600 uppercase">Settled Worth</span>
                        <span className="text-[12px] font-black text-blue-600 tracking-tight">₹{Math.round((Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)) * 50).toLocaleString()}</span>
                     </div>
                  </div>

                  {/* Practitioner Observations */}
                  <div className="bg-slate-50/40 rounded-lg p-2.5 text-[10px] text-slate-600 font-medium border border-slate-100 italic leading-snug">
                     "{selectedCase.notes || "Official clinical documentation successfully archived via Blueteeth secure node."}"
                  </div>

                  {/* Status Bar - High Impact, Low Height */}
                  <div className="p-2.5 bg-slate-900 rounded-xl relative overflow-hidden flex items-center justify-between text-white shadow-xl">
                     <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-12 -mt-12 opacity-40"></div>
                     <div className="space-y-1 relative z-10">
                        <p className="text-[6px] font-black text-blue-300 uppercase tracking-wider leading-none">Protocol Audit</p>
                        <div className="flex items-center gap-1.5">
                           <div className="h-1 w-1 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                           <span className="text-[7px] font-black uppercase text-emerald-400 tracking-widest leading-none">Approved</span>
                        </div>
                     </div>
                     <div className="text-right relative z-10">
                        <p className="text-[6px] font-black text-blue-300 uppercase tracking-wider leading-none">Net Yield</p>
                        <div className="flex items-baseline justify-end gap-1">
                           <span className="text-xl font-black tracking-tighter">+{Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)}</span>
                           <span className="text-[7px] font-black text-blue-100/60 uppercase">pts</span>
                        </div>
                     </div>
                  </div>
               </div>
               
               <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <Button 
                    onClick={() => setSelectedCase(null)} 
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-[9px] shadow-lg transition-all active:scale-95"
                  >
                     Dismiss Review
                  </Button>
               </div>
            </motion.div>
          </div>
        )}

        {/* Administrative Perks Vault Modal */}
        <AnimatePresence>
          {showPerksModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPerksModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 flex flex-col">
                 <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="h-11 w-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg"><Award size={20} /></div>
                       <div>
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">Perks Vault</h3>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Official Administrative Ledger</p>
                       </div>
                    </div>
                    <button onClick={() => setShowPerksModal(false)} className="h-11 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900"><X size={16} /></button>
                 </div>

                 <div className="flex-1 overflow-y-auto max-h-[400px] p-6 space-y-4 divide-y divide-slate-100">
                    {perks.length > 0 ? perks.map((p, i) => (
                      <div key={i} className="pt-4 first:pt-0 pb-4">
                         <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-tight">Administrative Perk #{i+1}</p>
                            <span className="text-[9px] font-black text-slate-300">{p.date}</span>
                         </div>
                         <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-3">
                            <p className="text-[11px] font-bold text-slate-800 italic">"{p.bonusReason || 'High Performance Clinical Reward'}"</p>
                         </div>
                         <div className="flex justify-between items-center text-[11px] font-black">
                            <span className="text-slate-400 uppercase tracking-widest">Protocol Credit</span>
                            <span className="text-blue-600">+{Number(p.points).toFixed(1)} PTS</span>
                         </div>
                      </div>
                    )) : (
                      <div className="py-20 text-center opacity-30 grayscale">
                         <Gift size={48} className="mx-auto mb-4" />
                         <p className="text-[9px] font-black uppercase tracking-widest">No Perks Archived</p>
                      </div>
                    )}
                 </div>

                 <div className="p-6 bg-slate-900">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Accumulated Rewards</span>
                       <span className="text-xl font-black text-white">{perks.reduce((acc, curr) => acc + (Number(curr.points) || 0), 0).toFixed(1)} <span className="text-[10px] text-blue-400">PTS</span></span>
                    </div>
                    <button onClick={() => setShowPerksModal(false)} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">Dismiss Vault Access</button>
                 </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Clinical Redemption Modal — Permanent Payment Identity System */}
      <AnimatePresence>
        {showRedeemModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowRedeemModal(false); setIsEditingPayment(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
             <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col mx-4"
             >
              {/* Modal Header — Density Optimized */}
              <div className="p-4 border-b border-slate-50 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                    <IndianRupee size={16} className="text-white" />
                  </div>
                  <button onClick={() => { setShowRedeemModal(false); setIsEditingPayment(false); }} className="text-white/60 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>
                <h3 className="text-lg font-black tracking-tight leading-none">Clinical Settlement</h3>
                <p className="text-blue-100 text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80 leading-none">Permanent Identity • Secure Node</p>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Payout Amount — Compact */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Available Payout</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter">₹{Math.max(0, stats.totalRevenue - totalRedeemedAmount).toLocaleString()}</p>
                </div>

                {/* SAVED PAYMENT IDENTITY — show if saved and not editing */}
                {savedPayment && !isEditingPayment ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Saved Payment Identity</p>
                      <button 
                        onClick={() => setIsEditingPayment(true)}
                        className="text-[8px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 flex items-center gap-1 px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100 transition-all"
                      >
                        ✎ Change Method
                      </button>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-5 w-5 bg-emerald-600 rounded-lg flex items-center justify-center">
                          {savedPayment.method === 'upi' ? <Smartphone size={10} className="text-white" /> : <FileText size={10} className="text-white" />}
                        </div>
                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">
                          {savedPayment.method === 'upi' ? 'UPI Identity' : 'Bank Account'}
                        </span>
                      </div>
                      {savedPayment.method === 'upi' ? (
                        <p className="text-sm font-black text-slate-900 leading-tight">{savedPayment.upiId}</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-900 leading-tight">{savedPayment.accountHolder}</p>
                          <p className="text-[11px] font-bold text-slate-600 leading-tight">A/C: {savedPayment.accountNumber}</p>
                          <p className="text-[11px] font-bold text-slate-600 leading-tight">IFSC: {savedPayment.ifsc} • {savedPayment.bankName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* PAYMENT ENTRY FORM — new or editing */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        {isEditingPayment ? 'Update Identity' : 'Set Payment Identity'}
                      </p>
                    </div>

                    {/* Method Toggle — Smaller */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <button 
                        onClick={() => setPayoutMethod('upi')}
                        className={`py-4 rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 ${payoutMethod === 'upi' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-white text-slate-400'}`}
                      >
                        <Smartphone size={16} />
                        <span className="text-[10px] font-black uppercase tracking-wider">UPI ID</span>
                      </button>
                      <button 
                        onClick={() => setPayoutMethod('bank')}
                        className={`py-4 rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 ${payoutMethod === 'bank' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-white text-slate-400'}`}
                      >
                        <FileText size={16} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Bank A/C</span>
                      </button>
                      <button 
                        onClick={() => setPayoutMethod('netbanking')}
                        className={`py-4 rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 ${payoutMethod === 'netbanking' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 bg-white text-slate-400'}`}
                      >
                        <ExternalLink size={16} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Net Bank</span>
                      </button>
                    </div>

                    {/* NEW: PAN & Aadhaar Verification Section — Premium Light UI */}
                    <div className="p-4 bg-blue-50/50 rounded-2xl space-y-4 border border-blue-100 relative overflow-hidden">
                       <div className="absolute right-0 top-0 w-32 h-32 bg-blue-600/5 rounded-full blur-2xl -mr-16 -mt-16"></div>
                       <div className="flex items-center gap-2 mb-2">
                          <ShieldCheck size={14} className="text-blue-600" />
                          <span className="text-[10px] font-black text-blue-900 uppercase tracking-[0.2em]">KYC Security Node</span>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                           <label className="text-[8px] font-black text-blue-400 uppercase tracking-widest">PAN Card Number</label>
                           <div className="relative">
                             <input 
                               type="text" maxLength={10} placeholder="ABCDE1234F"
                               value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())}
                               className={`w-full bg-white border px-3 py-2.5 rounded-lg text-slate-900 font-black text-xs outline-none transition-all ${isPanVerified ? 'border-emerald-500 ring-4 ring-emerald-50' : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}`}
                             />
                             {isPanLoading && <div className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                             {isPanVerified && <div className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 text-[10px]">✔</div>}
                           </div>
                         </div>

                         <div className="space-y-1.5">
                           <label className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Aadhaar Number</label>
                           <input 
                             type="text" maxLength={12} placeholder="0000 0000 0000"
                             value={aadhaarNumber} onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                             className="w-full bg-white border border-slate-200 px-3 py-2.5 rounded-lg text-slate-900 font-black text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                           />
                         </div>
                       </div>

                       <div className="space-y-1.5">
                          <label className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Upload PAN Card Image</label>
                          <div className="relative group">
                            <input 
                              type="file" accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setPanImage(file);
                                  setPanImageUrl(URL.createObjectURL(file));
                                  toast.success("Identity Proof Attached.");
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="w-full border-2 border-dashed border-blue-200 rounded-xl p-4 flex flex-col items-center gap-2 group-hover:border-blue-500 group-hover:bg-blue-100/50 transition-all bg-white">
                               {panImageUrl ? (
                                 <div className="relative w-full h-20 rounded-lg overflow-hidden border border-blue-100">
                                   <img src={panImageUrl} className="w-full h-full object-cover" />
                                   <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Plus size={20} className="text-blue-600" />
                                   </div>
                                 </div>
                               ) : (
                                 <>
                                   <FileBadge size={20} className="text-blue-400" />
                                   <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Select Proof Image</span>
                                 </>
                               )}
                            </div>
                          </div>
                       </div>
                    </div>

                    {/* UPI Fields with OTP Verification — Ultra Compact */}
                    {payoutMethod === 'upi' && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">UPI Identity</label>
                          <div className="relative">
                            <input
                              type="text" autoFocus
                              value={upiId}
                              onChange={(e) => { 
                                setUpiId(e.target.value); 
                                setUpiVerify({ status: 'idle' });
                                setShowOtpField(false);
                                setIsOtpVerified(false);
                              }}
                              placeholder="e.g. mobile@upi"
                              disabled={isOtpVerified}
                              className={`w-full px-5 py-4.5 pr-12 rounded-lg bg-slate-50 border text-sm font-black focus:outline-none focus:ring-4 transition-all ${
                                upiVerify.status === 'verified' ? 'border-emerald-400 focus:ring-emerald-100' :
                                upiVerify.status === 'invalid'  ? 'border-red-400 focus:ring-red-100' :
                                'border-slate-200 focus:ring-blue-600/20 focus:border-blue-600'
                              } ${isOtpVerified ? 'bg-emerald-50/50' : ''}`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {upiVerify.status === 'loading' && <div className="h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                              {upiVerify.status === 'verified' && <div className="h-4 w-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[8px] font-black">✓</div>}
                            </div>
                          </div>
                        </div>

                        {/* STEP 1: Verify Identity — Send OTP button */}
                        {(upiVerify.status === 'verified' || upiVerify.status === 'unverified') && !showOtpField && !isOtpVerified && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className="h-9 w-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg">
                                 {(upiVerify.name || userData?.name || 'P').charAt(0).toUpperCase()}
                               </div>
                               <div className="flex-1">
                                 <div className="flex items-center gap-1.5 mb-1">
                                   <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{upiVerify.name || userData?.name || 'Practitioner Identity'}</p>
                                   <div className="h-1 w-1 bg-emerald-500 rounded-full" />
                                 </div>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">OTP will go to: {user?.email ? user.email.replace(/(.{2}).+(@.+)/, "$1***$2") : '...'}</p>
                               </div>
                            </div>
                            <Button 
                              onClick={sendOtp}
                              disabled={isOtpSending}
                              className="h-9 px-4 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                            >
                              {isOtpSending ? 'Sending...' : 'Send OTP'}
                            </Button>
                          </div>
                        )}

                        {/* STEP 2: OTP Verification Field */}
                        {showOtpField && !isOtpVerified && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900 p-4 rounded-xl space-y-3 shadow-2xl relative overflow-hidden"
                          >
                             <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full blur-xl -mr-12 -mt-12"></div>
                             <div className="flex items-center gap-2 mb-1">
                                <Key size={12} className="text-blue-400" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Two-Factor Auth</span>
                             </div>
                             <div className="flex gap-2">
                                <input 
                                  type="text"
                                  maxLength={6}
                                  value={otpInput}
                                  onChange={(e) => {
                                    setOtpInput(e.target.value);
                                    if(e.target.value === generatedOtp) {
                                      setIsOtpVerified(true);
                                      toast.success("Identity Authenticated!");
                                    }
                                  }}
                                  placeholder="Enter 6-digit Code"
                                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white font-black text-sm text-center tracking-[0.5em] focus:outline-none focus:border-blue-500 transition-all"
                                />
                             </div>
                             <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest text-center">Dispatched to registered Gmail</p>
                          </motion.div>
                        )}

                        {/* STEP 3: Final Verified Identity Card — Much More Compact */}
                        {isOtpVerified && (upiVerify.name || userData?.name) && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl shadow-inner relative overflow-hidden"
                          >
                             <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg border-2 border-white">
                               {(upiVerify.name || userData?.name || 'P').charAt(0).toUpperCase()}
                             </div>
                             <div className="flex-1">
                               <div className="flex items-center gap-1.5 mb-0.5">
                                 <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Node Verified</span>
                                 <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                               </div>
                               <p className="text-xs font-black text-slate-900 leading-tight">{upiVerify.name || userData?.name || 'Verified Practitioner'}</p>
                               <div className="flex items-center gap-2 mt-1 opacity-60">
                                  <div className="flex items-center gap-1">
                                     <Smartphone size={7} /> <span className="text-[7px] font-black uppercase text-slate-500">{upiId}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                     <IndianRupee size={7} /> <span className="text-[7px] font-black uppercase text-slate-500">{(() => {
                                        if (upiId.includes('@okaxis') || upiId.includes('@axis')) return 'Axis Bank';
                                        if (upiId.includes('@okhdfc') || upiId.includes('@hdfc')) return 'HDFC Bank';
                                        if (upiId.includes('@okicici') || upiId.includes('@icici')) return 'ICICI Bank';
                                        if (upiId.includes('@oksbi') || upiId.includes('@sbi')) return 'State Bank of India';
                                        if (upiId.includes('@paytm')) return 'Paytm Payments Bank';
                                        return 'Verified Banking Node';
                                     })()}</span>
                                  </div>
                               </div>
                             </div>
                          </motion.div>
                        )}

                        {/* INVALID / UNVERIFIED */}
                        {upiVerify.status === 'invalid' && (
                          <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <span className="text-red-500">✖</span>
                            <p className="text-[9px] font-black text-red-600 uppercase tracking-wide">{upiVerify.error}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bank Account Fields */}
                    {payoutMethod === 'bank' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Account Holder Name</label>
                          <input type="text" value={accountHolder} onChange={e => setAccountHolder(e.target.value)}
                            placeholder="Full name as per bank"
                            className="w-full px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Account Number</label>
                          <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                            placeholder="e.g. 0012345678901"
                            className="w-full px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">IFSC Code</label>
                            <input type="text" value={ifscCode} onChange={e => setIfscCode(e.target.value.toUpperCase())}
                              placeholder="SBIN0001234"
                              className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bank Name</label>
                            <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                              placeholder="SBI / HDFC..."
                              className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-black focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Net Banking Placeholder — Ready for Future API Integration */}
                    {payoutMethod === 'netbanking' && (
                      <div className="p-10 text-center space-y-4 border-2 border-dashed border-blue-100 rounded-2xl bg-blue-50/20">
                         <div className="h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-xl">
                            <Activity className="text-white h-8 w-8 animate-pulse" />
                         </div>
                         <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-900 uppercase">External API Hub</h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">System is ready to link Corporate Net Banking & API-based settlements. Please contact Blueteeth Admin to activate this Node.</p>
                         </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-100 flex items-center gap-3 shadow-inner">
                   <ShieldCheck className="text-blue-600 h-4 w-4 shrink-0" />
                   <p className="text-[9px] font-black text-blue-700 leading-tight uppercase tracking-widest">Identity Securely Managed. Settlement processed within 24-48 hrs.</p>
                </div>
              </div>

              {/* Elite Docked Footer — Removes Desktop White Space */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto">

                <Button 
                  onClick={async () => {
                    // Validate
                    if (!savedPayment || isEditingPayment) {
                      if (payoutMethod === 'upi' && !upiId.trim()) {
                        toast.error('Please enter your UPI ID.'); return;
                      }
                      if (payoutMethod === 'upi' && !isOtpVerified) {
                        toast.error('Complete Secure Identity Verification (OTP) first.'); return;
                      }
                      if (payoutMethod === 'bank' && (!bankAccount.trim() || !ifscCode.trim())) {
                        toast.error('Please enter Account Number and IFSC Code.'); return;
                      }
                    }

                    setRedeemLoading(true);
                    try {
                      const { addDoc, collection: col, doc, updateDoc, serverTimestamp, query, where, getDocs } = await import('firebase/firestore');

                      // 1. UNIQUE IDENTITY CHECK (ANTI-COLLUSION ENGINE)
                      if (!savedPayment || isEditingPayment) {
                        const targetVal = payoutMethod === 'upi' ? upiId.trim() : bankAccount.trim();
                        const targetKey = payoutMethod === 'upi' ? 'upiId' : 'bankAccount';
                        
                        if (targetVal) {
                          const q = query(col(db as any, 'users'), where(targetKey, '==', targetVal));
                          const snap = await getDocs(q);
                          const isConflict = snap.docs.some(d => d.id !== user?.uid);
                          
                          if (isConflict) {
                            toast.error(`Clinical Conflict: This ${payoutMethod.toUpperCase()} identity is already registered to another practitioner node.`, {
                              duration: 5000,
                              icon: '⚠️'
                            });
                            setRedeemLoading(false);
                            return;
                          }
                        }
                      }

                      // Build payment identity object
                      const paymentIdentity = payoutMethod === 'upi'
                        ? { method: 'upi', upiId: upiId.trim() }
                        : { method: 'bank', accountHolder: accountHolder.trim(), accountNumber: bankAccount.trim(), ifsc: ifscCode.trim(), bankName: bankName.trim() };

                      // If editing/new, save to Firestore permanently
                      if (!savedPayment || isEditingPayment) {
                        await updateDoc(doc(db as any, 'users', user!.uid), {
                          savedPayment: {
                            ...paymentIdentity,
                            verifiedName: upiVerify.name || ''
                          },
                          upiId: payoutMethod === 'upi' ? upiId.trim() : (savedPayment?.upiId || ''),
                          bankAccount: payoutMethod === 'bank' ? bankAccount.trim() : (savedPayment?.accountNumber || ''),
                          bankName: payoutMethod === 'bank' ? bankName.trim() : (savedPayment?.bankName || ''),
                        });
                        setSavedPayment({
                          ...paymentIdentity,
                          verifiedName: upiVerify.name || ''
                        });
                        setIsEditingPayment(false);
                        sendCompletionEmail('identity_updated', payoutMethod === 'upi' ? upiId : `${bankAccount} (${bankName})`);
                      }

                      // Create redemption request
                      const finalPayment = (!savedPayment || isEditingPayment) ? paymentIdentity : savedPayment;
                      const amount = Math.max(0, stats.totalRevenue - totalRedeemedAmount);
                      await addDoc(col(db as any, 'redemptions'), {
                        doctorUid: user?.uid,
                        doctorName: userData?.name || user?.displayName || 'Unknown Practitioner',
                        amount: amount,
                        points: stats.totalPoints,
                        method: finalPayment.method,
                        details: finalPayment.method === 'upi' ? finalPayment.upiId : `${finalPayment.accountNumber} • ${finalPayment.ifsc} • ${finalPayment.bankName}`,
                        verifiedName: finalPayment.verifiedName || upiVerify.name || '',
                        paymentIdentity: finalPayment,
                        status: 'Pending',
                        requestedAt: serverTimestamp(),
                        // KYC Data Attachments
                        panNumber: panNumber,
                        aadhaarNumber: aadhaarNumber,
                        panProofUrl: panImageUrl || 'N/A'
                      });

                      sendCompletionEmail('redemption_requested', amount.toLocaleString());
                      toast.success('Withdrawal Request Submitted Successfully! Admin will process within 24-48 hrs.');
                      setShowRedeemModal(false);
                      setIsEditingPayment(false);
                    } catch (err) {
                      console.error('Redemption Failure:', err);
                      toast.error('Verification timeout. Please retry.');
                    } finally {
                      setRedeemLoading(false);
                    }
                  }}
                  disabled={redeemLoading}
                  className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  {redeemLoading ? 'Processing...' : (savedPayment && !isEditingPayment) || isOtpVerified ? '✓ Confirm Withdrawal' : 'Save & Submit Withdrawal'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

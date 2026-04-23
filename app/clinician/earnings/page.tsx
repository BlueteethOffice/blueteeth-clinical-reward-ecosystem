'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Wallet, History, TrendingUp, 
  ArrowUpRight, CheckCircle2, ShieldCheck, BadgeCheck, ArrowRight,
  Landmark, AlertCircle, Lock, Mail, X,
  QrCode, Fingerprint, CreditCard, ChevronLeft, ChevronRight, Eye, Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { requestWithdrawal } from '@/lib/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function ClinicianEarningsPage() {
  const { user, userData } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);
  
  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(window.innerWidth < 768 ? 50 : 8);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('');
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // KYC States
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [kycData, setKycData] = useState({
    bankAccount: '',
    ifsc: '',
    upiId: '',
    aadhaarNo: '',
    panNo: '',
    panPhotoURL: ''
  });
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [userOtp, setUserOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [panFile, setPanFile] = useState<File | null>(null);
  const [isEditingKyc, setIsEditingKyc] = useState(false);

  const [minPayout, setMinPayout] = useState(500);

  useEffect(() => {
    if (userData) {
      setKycData({
        bankAccount: (userData as any).bankAccount || '',
        ifsc: (userData as any).ifsc || '',
        upiId: (userData as any).upiId || '',
        aadhaarNo: (userData as any).aadhaarNo || '',
        panNo: (userData as any).panNo || '',
        panPhotoURL: (userData as any).panPhotoURL || ''
      });

      // Fetch dynamic min payout policy
      const fetchPolicy = async () => {
        const { getDoc, doc } = await import('firebase/firestore');
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          const role = (userData as any).role || 'clinician';
          const threshold = (role === 'clinician' || role === 'specialist')
            ? (data.clinicianMinPayout || 1000)
            : (data.settlementMinimum || 500);
          setMinPayout(threshold);
        }
      };
      fetchPolicy();
    }
  }, [userData]);
  
  const [stats, setStats] = useState({
    totalEarned: 0,
    pendingWork: 0,
    totalPaid: 0,
    totalPending: 0
  });

  const [cases, setCases] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    // MASTER LEDGER STREAM: Listen to both cases and redemptions
    const casesQuery = query(collection(db, 'cases'), where('clinicianId', '==', user.uid));
    const redQuery = query(collection(db, 'redemptions'), where('doctorUid', '==', user.uid));

    let casesData: any[] = [];
    let redData: any[] = [];

    const updateMasterStats = () => {
      let earned = 0;
      let pWork = 0;
      let pPaid = 0;
      let pPending = 0;

      casesData.forEach((c: any) => {
        const fee = Number(c.clinicianFee || 0);
        if (c.status === 'Approved') earned += fee;
        else if (c.status === 'Submitted') pWork += fee;
      });

      redData.forEach((r: any) => {
        const amt = Number(r.amount || 0);
        if (r.status === 'Paid') pPaid += amt;
        else if (r.status === 'Pending' || r.status === 'Processing') pPending += amt;
      });

      setStats({
        totalEarned: earned,
        pendingWork: pWork,
        totalPaid: pPaid,
        totalPending: pPending
      });

      // MERGE FOR TRANSACTION LEDGER
      const combinedHistory = [
        ...casesData.map(c => ({ ...c, type: 'EARNING', dateObj: c.submittedAt?.toDate() || new Date() })),
        ...redData.map(r => ({ ...r, type: 'WITHDRAWAL', dateObj: r.requestedAt?.toDate() || new Date() }))
      ].sort((a, b) => b.dateObj - a.dateObj);

      setHistory(combinedHistory);
      setLoading(false);
    };

    const unsubCases = onSnapshot(casesQuery, (snapshot) => {
      casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateMasterStats();
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.error("Clinician Cases Sync Err:", err);
    });

    const unsubRed = onSnapshot(redQuery, (snapshot) => {
      redData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateMasterStats();
    }, (err) => {
      if (err.code === 'permission-denied') return;
      console.error("Clinician Redemptions Sync Err:", err);
    });

    return () => {
      unsubCases();
      unsubRed();
    };
  }, [user?.uid]);

  const handleWithdraw = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!amount || Number(amount) < minPayout) {
      toast.error(`Minimum withdrawal is ₹${minPayout}`);
      return;
    }
    const currentBalance = (
      (userData as any)?.walletBalance && !isNaN(Number((userData as any).walletBalance)) 
      ? Number((userData as any).walletBalance) 
      : (stats.totalEarned - stats.withdrawn)
    );
    if (Number(amount) > currentBalance) {
      toast.error('Insufficient balance');
      return;
    }
    if (method === 'UPI' && !(userData as any)?.upiId) {
      toast.error('Please enter UPI ID in Payout Settings');
      return;
    }

    setIsSubmitting(true);
    try {
      const destination = method === 'UPI' 
        ? (userData as any)?.upiId 
        : `A/C: ${(userData as any)?.bankAccount} (IFSC: ${(userData as any)?.ifsc})`;

      if (!destination) {
        toast.error('Payout details not found. Please update Payout Settings.');
        setIsSubmitting(false);
        return;
      }

      const result = await requestWithdrawal(user!.uid, Number(amount), {
        method: method.toLowerCase(),
        details: {
          destination: destination,
          upiId: (userData as any)?.upiId || '',
          bankAccount: (userData as any)?.bankAccount || '',
          ifsc: (userData as any)?.ifsc || ''
        },
        timestamp: new Date().toISOString()
      });
      
      if (result.success) {
        toast.success('Settlement request dispatched to node!');
        setIsModalOpen(false);
        setAmount('');
      } else {
        toast.error(result.error || 'Dispatch failed');
      }
    } catch (error) {
      console.error("WITHDRAW_ERR:", error);
      toast.error('Network Error: Failed to reach node');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendKycOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      toast.error("Valid email required for OTP sync");
      return;
    }

    setIsSubmitting(true);
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);

    const { sendEmail } = await import('@/lib/email');
    const res = await sendEmail({
      to_email: user.email,
      subject: 'SECURITY PASSCODE: Payout Node Verification',
      message: 'Use this 6-digit passcode to verify your payout node and financial credentials.',
      passcode: newOtp
    });

    if (res.success) {
      setShowOtpModal(true);
      toast.success("Security Passcode Dispatched to Email");
    } else {
      toast.error("Dispatch Failed. Check network connection.");
    }
    setIsSubmitting(false);
  };

  const handleVerifyKycAndSave = async () => {
    if (userOtp !== generatedOtp) {
      toast.error("Invalid Security Passcode");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { updateUserProfile, uploadProfileImage } = await import('@/lib/firestore');
      let finalPanPhotoURL = kycData.panPhotoURL;
      
      if (panFile) {
        const photoResult = await uploadProfileImage(user!.uid, kycData.panPhotoURL, 'kyc_docs');
        if (photoResult.success && photoResult.url) finalPanPhotoURL = photoResult.url;
      }

      await updateUserProfile(user!.uid, { 
        ...kycData, 
        panPhotoURL: finalPanPhotoURL,
        kycStatus: 'Pending Verification',
        lastKycUpdate: new Date().toISOString()
      });
      
      toast.success("KYC Credentials Secured & Synced!");
      
      // Close modals
      setShowOtpModal(false);
      setIsKycModalOpen(false);
      setIsEditingKyc(false);

      // Force a reload after a short delay to sync the Auth Context
      setTimeout(() => {
        window.location.reload();
      }, 800);

    } catch (err) {
      console.error("KYC-SAVE-ERROR:", err);
      toast.error("Failed to secure credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncLedger = async () => {
    if (!user?.uid) return;
    const toastId = toast.loading("Synchronizing Master Ledger...");
    try {
      const { getDocs, query, collection, where, doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      const casesQuery = query(collection(db, 'cases'), where('clinicianId', '==', user.uid), where('status', '==', 'Approved'));
      const redemptionsQuery = query(collection(db, 'redemptions'), where('doctorUid', '==', user.uid));
      
      const [casesSnap, redSnap] = await Promise.all([getDocs(casesQuery), getDocs(redemptionsQuery)]);
      
      let earned = 0;
      casesSnap.forEach(d => { earned += Number(d.data().clinicianFee || 0); });
      
      let withdrawn = 0;
      redSnap.forEach(d => { 
        const status = d.data().status;
        if (status === 'Paid' || status === 'Pending' || status === 'Processing') {
          withdrawn += Number(d.data().amount || 0); 
        }
      });
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        walletBalance: earned - withdrawn,
        totalWithdrawn: withdrawn,
        updatedAt: serverTimestamp()
      });
      
      toast.success("Master Ledger Synchronized & Repaired!", { id: toastId });
    } catch (err) {
      console.error("SYNC_ERR:", err);
      toast.error("Ledger Sync Failed", { id: toastId });
    }
  };

  if (!mounted) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-5 sm:space-y-6 pb-6 px-2 sm:px-0">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 sm:gap-6 px-1 sm:px-0">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Earnings Console</h1>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest leading-none">Master Ledger Active</p>
               </div>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">Verified Node</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
              <Button 
                onClick={() => setIsKycModalOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-[0.2em] h-10 px-6 rounded-[4px] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <ShieldCheck size={16} className="text-blue-400" /> Payout Settings
              </Button>
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] h-10 px-8 rounded-[4px] shadow-2xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <ArrowUpRight size={16} /> Request Payout
              </Button>
          </div>
        </div>

        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-1 sm:px-0">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-3 sm:p-4 bg-slate-900 text-white border-0 shadow-2xl rounded-[4px] relative overflow-hidden group h-full">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-10 group-hover:scale-125 transition-transform duration-1000" />
              <div className="relative z-10">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white/5 backdrop-blur-xl rounded-[4px] flex items-center justify-center mb-6 border border-white/10 shadow-inner shrink-0">
                   <Wallet size={20} className="text-blue-400" />
                </div>
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Liquid Settlement Fund</p>
                <h4 className="text-3xl font-black text-white tracking-tighter">
                   ₹{(stats.totalEarned - stats.totalPaid - stats.totalPending).toLocaleString()}
                   <span className="text-sm ml-2 text-blue-400 font-bold tracking-widest uppercase opacity-80">Node</span>
                </h4>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Protocol Secured</span>
                   </div>
                   <button 
                     onClick={handleSyncLedger}
                     className="text-[8px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded border border-blue-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                   >
                     <Fingerprint size={10} /> Sync Ledger
                   </button>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-3 sm:p-4 bg-white border border-slate-200 shadow-2xl shadow-slate-200/50 rounded-[4px] h-full flex flex-col justify-between group overflow-hidden relative">
              <div className="relative z-10">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-emerald-50 rounded-[4px] flex items-center justify-center mb-6 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0 text-emerald-600">
                   <BadgeCheck size={20} />
                </div>
                <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Settled Yield (Auth)</p>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-none">₹{stats.totalPaid.toLocaleString()}</h2>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-[4px] border border-emerald-100 w-fit relative z-10">
                 Admin Authorized
              </div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700" />
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-3 sm:p-4 bg-white border border-slate-200 shadow-2xl shadow-slate-200/50 rounded-[4px] h-full flex flex-col justify-between group overflow-hidden relative">
              <div className="relative z-10">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-amber-50 rounded-[4px] flex items-center justify-center mb-6 border border-amber-100 group-hover:bg-amber-600 group-hover:text-white transition-all shrink-0 text-amber-600 group-hover:text-white">
                   <TrendingUp size={20} />
                </div>
                <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">In-Transit Fund</p>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-none">₹{stats.totalPending.toLocaleString()}</h2>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-[4px] border border-amber-100 w-fit relative z-10">
                 Awaiting Node Auth
              </div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700" />
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="p-3 sm:p-4 bg-white border border-slate-200 shadow-2xl shadow-slate-200/50 rounded-[4px] h-full flex flex-col justify-between group overflow-hidden relative">
              <div className="relative z-10">
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-indigo-50 rounded-[4px] flex items-center justify-center mb-6 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 text-indigo-600">
                   <CheckCircle2 size={20} />
                </div>
                <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Verified Lifetime Yield</p>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-none">₹{stats.totalEarned.toLocaleString()}</h2>
              </div>
              <div className="mt-4 flex items-center justify-between relative z-10">
                 <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 uppercase leading-none">{history.length}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Protocol Objects</span>
                 </div>
                 <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full w-[100%] bg-indigo-600 rounded-full" />
                 </div>
              </div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700" />
            </Card>
          </motion.div>
        </div>

        {/* Augmented Ledger */}
        <div className="space-y-4 sm:space-y-6">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 sm:px-0">
              <div className="flex items-center gap-2 sm:gap-3">
                 <div className="h-7 w-7 sm:h-8 sm:w-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shrink-0">
                    <History size={14} />
                 </div>
                 <h3 className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase tracking-widest">Transaction Ledger</h3>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-md border border-slate-100 w-fit">
                 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Real-time Stream</span>
              </div>
           </div>
           <div className="flex overflow-x-auto pb-4 no-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 px-1 sm:px-0 sm:pb-0">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <div key={i} className="min-w-[280px] sm:min-w-0 flex-shrink-0 h-56 bg-white rounded-2xl border border-slate-100 shadow-xl animate-pulse" />
                ))
              ) : history.length === 0 ? (
                <div className="w-full sm:col-span-full py-32 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-6">
                   <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center shadow-inner text-slate-200">
                      <Landmark size={40} />
                   </div>
                   <div className="space-y-1">
                      <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">Archive Manifest Empty</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New clinical nodes will synchronize here.</p>
                   </div>
                </div>
              ) : (
                history.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, index) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    key={item.id}
                    className="h-full min-w-[280px] sm:min-w-0 flex-shrink-0 sm:flex-shrink"
                  >
                    {item.type === 'EARNING' ? (
                      <Link href={`/clinician/work/${item.id}`}>
                        <div className="p-[1px] h-full rounded-[4px] bg-gradient-to-br from-slate-200 to-slate-300 hover:from-blue-500 hover:to-indigo-600 shadow-xl transition-all duration-500 group overflow-hidden">
                          <Card className="h-full border-none bg-white rounded-[3px] p-4 flex flex-col justify-between relative overflow-hidden group-hover:bg-slate-50 transition-colors">
                             <div className="relative z-10 space-y-5">
                               <div className="flex justify-between items-start">
                                  <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-2xl group-hover:scale-110 transition-transform">
                                     {item.patientName?.[0]?.toUpperCase() || 'C'}
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5">
                                    <span className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1.5 ${
                                       item.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200'
                                    }`}>
                                       {item.status === 'Approved' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                                       {item.status === 'Approved' ? 'Verified' : item.status}
                                    </span>
                                  </div>
                               </div>
                               <div className="space-y-1">
                                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate leading-none">{item.patientName}</h4>
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{item.treatmentName || 'Clinical Service'}</p>
                               </div>
                               <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                                  <div className="space-y-0.5">
                                     <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Yield Result</p>
                                     <h3 className="text-lg font-black text-slate-900 tracking-tighter">₹{Number(item.clinicianFee || 0).toLocaleString()}</h3>
                                  </div>
                                  <div className="text-[8px] font-black text-slate-300 uppercase italic">{item.dateObj?.toLocaleDateString()}</div>
                               </div>
                             </div>
                          </Card>
                        </div>
                      </Link>
                    ) : (
                      <div className="p-[1px] h-full rounded-[4px] bg-gradient-to-br from-rose-200 to-rose-300 shadow-xl transition-all duration-500 overflow-hidden">
                        <Card className="h-full border-none bg-white rounded-[3px] p-4 flex flex-col justify-between relative overflow-hidden bg-rose-50/10">
                           <div className="relative z-10 space-y-5">
                             <div className="flex justify-between items-start">
                                <div className="h-10 w-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-2xl">
                                   <Wallet size={18} />
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                  <span className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1.5 ${
                                     item.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                                  }`}>
                                     {item.status === 'Paid' ? <BadgeCheck size={10} /> : <Clock size={10} />}
                                     {item.status === 'Paid' ? 'Settled' : 'Pending'}
                                  </span>
                                </div>
                             </div>
                             <div className="space-y-1">
                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate leading-none">Settlement Payout</h4>
                                <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest truncate">{item.method?.toUpperCase()} REQUEST</p>
                             </div>
                             <div className="pt-3 border-t border-rose-100 flex items-center justify-between">
                                <div className="space-y-0.5">
                                   <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Amount Dispatched</p>
                                   <h3 className="text-lg font-black text-rose-600 tracking-tighter">₹{Number(item.amount || 0).toLocaleString()}</h3>
                                </div>
                                <div className="text-[8px] font-black text-slate-300 uppercase italic">{item.dateObj?.toLocaleDateString()}</div>
                             </div>
                           </div>
                        </Card>
                      </div>
                    )}
                  </motion.div>
                )))}
           </div>
           {!loading && history.length > itemsPerPage && (
              <div className="hidden sm:flex flex-col items-center gap-3 pt-8 pb-4">
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                     disabled={currentPage === 1}
                     className="h-9 w-9 shrink-0 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all shadow-sm active:scale-95"
                   >
                      <ChevronLeft size={16} />
                   </button>
                   
                   <div className="flex items-center gap-1.5 px-3 h-9 bg-slate-50 border border-slate-100 rounded-lg shadow-inner overflow-x-auto no-scrollbar max-w-[140px] sm:max-w-none">
                      {Array.from({ length: Math.ceil(history.length / itemsPerPage) }).map((_, i) => (
                         <button
                           key={i}
                           onClick={() => setCurrentPage(i + 1)}
                           className={`h-6 w-6 sm:h-7 sm:w-7 shrink-0 rounded-md text-[8px] sm:text-[9px] font-black transition-all ${
                              currentPage === i + 1 
                              ? 'bg-slate-900 text-white shadow-lg' 
                              : 'text-slate-400 hover:text-slate-900'
                           }`}
                         >
                            {i + 1}
                         </button>
                      ))}
                   </div>
   
                   <button 
                     onClick={() => setCurrentPage(prev => Math.min(Math.ceil(history.length / itemsPerPage), prev + 1))}
                     disabled={currentPage === Math.ceil(history.length / itemsPerPage)}
                     className="h-9 w-9 shrink-0 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all shadow-sm active:scale-95"
                   >
                      <ChevronRight size={16} />
                   </button>
                 </div>
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Page {currentPage} of {Math.ceil(history.length / itemsPerPage)}</p>
              </div>
           )}
        </div>

        {/* Payment Node Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 px-1 sm:px-0">
           <Card className="p-6 sm:p-10 border-none bg-blue-50/30 border-t-4 border-t-blue-600 shadow-2xl shadow-slate-200/50 rounded-[4px] space-y-6 sm:space-y-8 overflow-hidden relative group">
               <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
               <div className="relative z-10 space-y-6 sm:space-y-8">
                  <div className="flex items-center gap-4">
                     <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-600 rounded-[4px] flex items-center justify-center shadow-2xl shadow-blue-200 shrink-0">
                        <Landmark className="text-white" size={20} />
                     </div>
                     <div>
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest leading-none mb-1.5">Bank Payout Protocol</h3>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Protocol Sync Node</p>
                     </div>
                  </div>
                  <div className="p-5 bg-white/60 backdrop-blur-md rounded-[4px] border border-blue-100 border-dashed">
                     <p className="text-[9px] sm:text-[11px] font-bold text-slate-500 leading-relaxed uppercase tracking-tighter">Settlements are synchronized globally every Friday. Ensure Master Credentials are authenticated for seamless dispatch.</p>
                  </div>
                  <Button onClick={() => setIsKycModalOpen(true)} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-xl shadow-blue-200 text-[10px] sm:text-[12px] font-black uppercase tracking-[0.3em] rounded-[4px] transition-all active:scale-95">
                     Update Credentials
                  </Button>
               </div>
            </Card>

            <Card className="p-6 sm:p-10 border-none bg-emerald-50/30 border-t-4 border-t-emerald-600 shadow-2xl shadow-slate-200/50 rounded-[4px] space-y-6 sm:space-y-8 overflow-hidden relative group">
               <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
               <div className="relative z-10 space-y-6 sm:space-y-8">
                  <div className="flex items-center gap-4">
                     <div className="h-10 w-10 sm:h-12 sm:w-12 bg-emerald-600 rounded-[4px] flex items-center justify-center shadow-2xl shadow-emerald-200 shrink-0">
                        <ShieldCheck className="text-white" size={20} />
                     </div>
                     <div>
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest leading-none mb-1.5">Security Identity Node</h3>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Master Auth Node</p>
                     </div>
                  </div>
                  <div className="space-y-4 sm:space-y-5 pt-2">
                     <div className="flex justify-between items-center py-3.5 border-b border-emerald-100/50">
                        <span className="text-[9px] sm:text-[11px] font-black text-slate-600 uppercase tracking-widest">Financial KYC</span>
                        <span className="px-4 py-1.5 bg-emerald-600 text-white text-[8px] font-black rounded-[4px] shadow-lg shadow-emerald-100">VERIFIED</span>
                     </div>
                     <div className="flex justify-between items-center py-3.5">
                        <span className="text-[9px] sm:text-[11px] font-black text-slate-600 uppercase tracking-widest">Taxation Sync</span>
                        <span className="px-4 py-1.5 bg-blue-600 text-white text-[8px] font-black rounded-[4px] shadow-lg shadow-blue-100">LINKED</span>
                     </div>
                  </div>
               </div>
            </Card>
        </div>

        {/* Withdrawal Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={() => setIsModalOpen(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-[4px] shadow-2xl overflow-hidden border border-slate-100"
              >
                <div className="p-8 space-y-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Request Settlement</h2>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Available: ₹{(stats.totalEarned - stats.withdrawn).toLocaleString()}
                      </p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleWithdraw} className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Transfer Amount (INR)</label>
                       <div className="relative">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">₹</span>
                          <input 
                            type="number" required min={minPayout}
                            placeholder={`Min. ${minPayout}`}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full h-16 pl-12 pr-6 bg-white border border-blue-100 rounded-lg text-2xl font-black tracking-tighter focus:ring-4 focus:ring-pink-50 focus:border-pink-500 outline-none transition-all shadow-sm"
                          />
                       </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Settlement Channel</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          type="button" onClick={() => setMethod('UPI')}
                          className={`h-14 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all ${method === 'UPI' ? 'border-pink-500 bg-pink-50/30 text-pink-600 ring-4 ring-pink-50' : 'border-blue-50 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                           <QrCode size={18} className={method === 'UPI' ? 'text-emerald-500' : 'text-slate-400'} />
                           <span className="text-[9px] font-black uppercase">UPI ID</span>
                        </button>
                        <button 
                          type="button" onClick={() => setMethod('BANK')}
                          className={`h-14 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all ${method === 'BANK' ? 'border-pink-500 bg-pink-50/30 text-pink-600 ring-4 ring-pink-50' : 'border-blue-50 bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                           <Landmark size={18} className={method === 'BANK' ? 'text-blue-500' : 'text-slate-400'} />
                           <span className="text-[9px] font-black uppercase">Bank Account</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-5 bg-slate-50/50 rounded-lg border border-slate-100 flex items-center gap-4 group/node hover:border-blue-200 transition-all">
                       <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm border transition-all ${
                         method === 'UPI' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-blue-50 border-blue-100 text-blue-600'
                       }`}>
                          {method === 'UPI' ? <QrCode size={24} /> : <Landmark size={24} />}
                       </div>
                       <div className="space-y-0.5 flex-1 min-w-0">
                          <p className={`text-[8px] font-black uppercase tracking-widest ${method === 'UPI' ? 'text-emerald-500' : 'text-blue-500'}`}>
                            Active {method === 'UPI' ? 'UPI' : 'Bank'} Node
                          </p>
                          <p className="text-sm font-black text-slate-900 tracking-tight truncate">
                             {method === 'UPI' 
                               ? (userData as any)?.upiId || 'Not Configured'
                               : (userData as any)?.bankAccount ? `•••• ${(userData as any).bankAccount.slice(-4)}` : 'Not Configured'
                             }
                          </p>
                          {method === 'BANK' && (userData as any)?.ifsc && (
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ (userData as any).ifsc }</p>
                          )}
                       </div>
                    </div>

                    <Button 
                      type="submit" isLoading={isSubmitting}
                      disabled={((method === 'UPI' && !(userData as any)?.upiId) || (method === 'BANK' && !(userData as any)?.bankAccount))}
                      className="w-full h-14 bg-slate-900 hover:bg-pink-600 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-lg shadow-xl transition-all"
                    >
                      Process Settlement
                    </Button>
                    
                    <p className="text-[8px] text-center font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                       Settlements are processed every Friday.<br/>Verified Clinician Node Required.
                    </p>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* KYC MODAL */}
        <AnimatePresence>
          {isKycModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={() => setIsKycModalOpen(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-2xl rounded-[4px] shadow-2xl overflow-hidden border border-slate-100"
              >
                <div className="p-6 sm:p-10 md:p-12 space-y-8 sm:space-y-10">
                   <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                            <ShieldCheck size={24} />
                         </div>
                         <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Payout Onboarding</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Secure Financial Credentials Node</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                         {!isEditingKyc && (
                            <button 
                              onClick={() => setIsEditingKyc(true)}
                              className="h-9 px-4 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2"
                            >
                               <AlertCircle size={14} className="text-blue-500" /> Unlock Node
                            </button>
                         )}
                         <button onClick={() => setIsKycModalOpen(false)} className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
                            <X size={20} />
                         </button>
                      </div>
                   </div>

                   <form onSubmit={handleSendKycOtp} className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                      <div className="space-y-5">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-l-4 border-indigo-600 pl-3">Settlement Hub (UPI & Bank)</h3>
                         <div className="space-y-4">
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Account Number</label>
                               <div className="relative">
                                  <input 
                                    type={isEditingKyc ? "text" : "password"} 
                                    required disabled={!isEditingKyc}
                                    className={`w-full h-12 rounded-lg pl-5 pr-12 outline-none font-bold text-sm transition-all border ${isEditingKyc ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                    value={kycData.bankAccount} onChange={e => setKycData({...kycData, bankAccount: e.target.value})}
                                    placeholder="•••• •••• ••••"
                                  />
                                  <Landmark size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 opacity-60" />
                               </div>
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">IFSC Code</label>
                               <div className="relative">
                                  <input 
                                    type="text" 
                                    required disabled={!isEditingKyc}
                                    className={`w-full h-12 rounded-lg pl-5 pr-12 outline-none font-bold text-sm transition-all border ${isEditingKyc ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                    value={kycData.ifsc} onChange={e => setKycData({...kycData, ifsc: e.target.value.toUpperCase()})}
                                    placeholder="SBIN000XXXX"
                                  />
                                  <ShieldCheck size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 opacity-60" />
                               </div>
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">UPI Address (VPA)</label>
                               <div className="relative">
                                  <input 
                                    type="text" 
                                    required disabled={!isEditingKyc}
                                    className={`w-full h-12 rounded-lg pl-5 pr-12 outline-none font-bold text-sm transition-all border ${isEditingKyc ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                    value={kycData.upiId} onChange={e => setKycData({...kycData, upiId: e.target.value})}
                                    placeholder="dr.specialist@upi"
                                  />
                                  <QrCode size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 opacity-60" />
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-5">
                         <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-l-4 border-emerald-500 pl-3">Identity Node</h3>
                         <div className="space-y-4">
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Aadhaar Number</label>
                               <div className="relative">
                                  <input 
                                    type="text" 
                                    required disabled={!isEditingKyc} maxLength={12}
                                    className={`w-full h-12 rounded-lg pl-5 pr-12 outline-none font-bold text-sm transition-all border ${isEditingKyc ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                    value={kycData.aadhaarNo} onChange={e => setKycData({...kycData, aadhaarNo: e.target.value.replace(/\D/g, '')})}
                                    placeholder="12-digit number"
                                  />
                                  <Fingerprint size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-500 opacity-60" />
                               </div>
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">PAN Number</label>
                               <div className="relative">
                                  <input 
                                    type="text" 
                                    required disabled={!isEditingKyc} maxLength={10}
                                    className={`w-full h-12 rounded-lg pl-5 pr-12 outline-none font-bold text-sm transition-all border ${isEditingKyc ? 'bg-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                    value={kycData.panNo} onChange={e => setKycData({...kycData, panNo: e.target.value.toUpperCase()})}
                                    placeholder="ABCDE1234F"
                                  />
                                  <CreditCard size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-500 opacity-60" />
                               </div>
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">PAN Card Image</label>
                               <div className="relative">
                                  <input type="file" disabled={!isEditingKyc} accept="image/*" className="hidden" id="panUploadE" onChange={e => {
                                     const file = e.target.files?.[0];
                                     if (file) {
                                        setPanFile(file);
                                        const reader = new FileReader();
                                        reader.onloadend = () => setKycData({...kycData, panPhotoURL: reader.result as string});
                                        reader.readAsDataURL(file);
                                     }
                                  }} />
                                  <div 
                                    onClick={() => isEditingKyc && document.getElementById('panUploadE')?.click()}
                                    className={`w-full h-12 rounded-lg px-5 flex items-center justify-between cursor-pointer border ${kycData.panPhotoURL ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white'} transition-all`}
                                  >
                                     <span className="text-[10px] font-black text-slate-400 uppercase">{kycData.panPhotoURL ? "Document Captured" : "Upload PAN Image"}</span>
                                     <ShieldCheck size={16} className={kycData.panPhotoURL ? "text-emerald-500" : "text-slate-300"} />
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="md:col-span-2 pt-6">
                         {isEditingKyc ? (
                            <Button 
                              type="submit" 
                              isLoading={isSubmitting}
                              className="w-full h-14 bg-slate-900 hover:bg-indigo-700 text-white font-black uppercase text-[11px] tracking-[0.2em] rounded-lg shadow-xl transition-all flex items-center justify-center gap-3"
                            >
                               <Lock size={18} /> Save & Verify Credentials
                            </Button>
                         ) : (
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
                               <AlertCircle size={16} className="text-blue-500" />
                               <p className="text-[9px] font-black text-slate-600 uppercase tracking-tight">Unlock node to update your settlement & identity credentials.</p>
                            </div>
                         )}
                      </div>
                   </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* OTP MODAL */}
        <AnimatePresence>
          {showOtpModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowOtpModal(false)} />
               <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white rounded-[4px] shadow-2xl w-full max-w-md p-10 flex flex-col items-center gap-8 border border-slate-100">
                  <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                     <Mail size={32} />
                  </div>
                  <div className="text-center space-y-2">
                     <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Verify Security Node</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-8 leading-relaxed">Passcode sent to <span className="text-blue-600">{user?.email}</span></p>
                  </div>
                  <input 
                    type="text" maxLength={6} placeholder="000000"
                    className="w-full h-16 bg-slate-50 border-none rounded-xl text-3xl font-black tracking-[0.5em] text-center focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                    value={userOtp} onChange={e => setUserOtp(e.target.value.replace(/\D/g, ''))}
                  />
                  <div className="w-full flex gap-4">
                     <Button variant="outline" onClick={() => setShowOtpModal(false)} className="flex-1">Cancel</Button>
                     <Button onClick={handleVerifyKycAndSave} isLoading={isSubmitting} className="flex-1 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest">Confirm</Button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

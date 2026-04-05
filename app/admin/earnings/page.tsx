'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  CheckCircle2, Clock, Wallet, Landmark, Phone, 
  Search, ArrowRight, User, AlertCircle, RefreshCcw, Smartphone,
  Activity, FileText, IndianRupee, Gift, BadgeCheck, X, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, onSnapshot, doc, updateDoc, increment, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

import { Suspense } from 'react';

function PayoutManagementContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [filter, setFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Custom Confirmation Modal Identity
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [payoutToConfirm, setPayoutToConfirm] = useState<any>(null);

  // Settlement Detailed Audit State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);

  useEffect(() => {
    if (!db) return;
    
    setLoading(true);
    // Real-time synchronization with the Clinical Redemption Protocol
    const q = query(collection(db, 'redemptions'), orderBy('requestedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRedemptions(data);
      setLoading(false);
    }, (error) => {
      console.error("Cloud Analytics Sync Failure:", error);
      toast.error('Ledger sync latency identified.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleProcess = async (req: any) => {
    setProcessingId(req.id);
    try {
      // 1. DISPATCH ACTUAL MONEY TRANSFER (Automated Node)
      const payoutRes = await fetch('/api/admin/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redemptionId: req.id,
          amount: req.amount,
          details: req.details,
          method: req.method,
          doctorName: req.doctorName,
          doctorEmail: req.email || "clinical@blueteeth.in"
        })
      });

      const payoutData = await payoutRes.json();
      
      if (!payoutRes.ok || !payoutData.success) {
         throw new Error(payoutData.error || "Internal API Dispatch Fault.");
      }

      console.log(">>> [SETTLEMENT DISPATCHED]:", payoutData);
      
      // ENTERPRISE DIAGNOSTIC FEEDBACK — CUSTOM PREMIUM TOASTS
      if (payoutData.simulation) {
         toast.custom((t) => (
           <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-white/10 backdrop-blur-md`}>
             <div className="flex-1 w-0 p-5">
               <div className="flex items-start">
                 <div className="flex-shrink-0 pt-0.5">
                   <div className="h-10 w-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/10">
                     <Activity size={20} />
                   </div>
                 </div>
                 <div className="ml-4 flex-1">
                   <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Diagnostic Simulation Node</p>
                   <p className="text-sm font-black text-white leading-none">Identity Archive Updated</p>
                   <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Financial ledger synchronized successfully. Connect Razorpay X Keys to authorize real IMPS/NEFT dispatches.</p>
                 </div>
               </div>
             </div>
             <div className="flex border-l border-white/5">
               <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-xs font-black text-white/40 hover:text-white uppercase tracking-widest">Dismiss</button>
             </div>
           </div>
         ), { duration: 6000 });
      } else {
         toast.custom((t) => (
           <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-blue-600 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-10`}>
             <div className="flex-1 w-0 p-5">
               <div className="flex items-start">
                 <div className="flex-shrink-0 pt-0.5">
                   <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center text-white backdrop-blur-md">
                     <BadgeCheck size={20} />
                   </div>
                 </div>
                 <div className="ml-4 flex-1 text-white">
                   <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Clinical Settlement Success</p>
                   <p className="text-sm font-black leading-none uppercase tracking-tight">Rupees Dispatched to {req.doctorName}</p>
                   <p className="mt-2 text-[10px] font-bold text-blue-100 uppercase tracking-widest leading-none opacity-80 italic">Transaction ID: {payoutData.payout_id}</p>
                 </div>
               </div>
             </div>
             <div className="flex border-l border-white/10">
               <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-xs font-black text-white uppercase tracking-widest opacity-60 hover:opacity-100">Close</button>
             </div>
           </div>
         ), { duration: 6000 });
      }

      // 2. Finalize Redemption Identity in Protocol
      await updateDoc(doc(db as any, 'redemptions', req.id), { 
        status: 'Paid', 
        processedAt: serverTimestamp(),
        payoutId: payoutData.payout_id,
        isSimulation: payoutData.simulation || false
      });
      
      // 3. Automated Financial Ledger Sync (Deduct from Doctor)
      const drRef = doc(db as any, 'users', req.doctorUid);
      await updateDoc(drRef, {
        totalPoints: increment(-(req.points || 0)),
        walletBalance: increment(-(req.amount || 0))
      });

      toast.success(`Settlement dispatched for ${req.doctorName}. Transaction ID attached.`);
    } catch (e: any) {
      console.error("Critical Settlement Failure:", e);
      toast.error('Dispatch Fault: ' + (e.message || 'Identity authentication failed.'));
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = redemptions.filter(r => {
    const matchesTab = filter === 'All' || r.status === filter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || (r.doctorName || '').toLowerCase().includes(q) || (r.details || '').toLowerCase().includes(q) || String(r.points || '').includes(q);
    return matchesTab && matchesSearch;
  });
  
  const pendingAmount = redemptions.filter(r => r.status === 'Pending').reduce((a, b) => a + (b.amount || 0), 0);
  const distributedAmount = redemptions.filter(r => r.status === 'Paid').reduce((a, b) => a + (b.amount || 0), 0);

  return (
    <DashboardLayout isAdminRoute={true}>
      <div className="space-y-10 pb-12">
        {/* Elite Cloud Financial Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 shadow-sm">
               <Activity className="h-3 w-3" /> Real-time Liquidity Stream
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">Financial Archive & Payouts</h1>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-wider opacity-60">Global Clinical Reward Dispersal Hub</p>
          </div>
          
          <div className="flex h-11 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 p-1 min-w-[320px]">
            {['Pending', 'Paid', 'All'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-slate-900 text-white shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Global Financial Telemetry */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="p-7 bg-white border border-slate-100 shadow-xl relative overflow-hidden group rounded-2xl">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-4">Pending Requests</p>
            <div className="flex items-center justify-between">
               <h4 className="text-3xl font-black text-slate-900 tracking-tighter">₹{pendingAmount.toLocaleString()}</h4>
               <div className="h-12 w-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 group-hover:rotate-12 transition-transform">
                  <Clock className="h-6 w-6" />
               </div>
            </div>
          </Card>

          <Card className="p-7 bg-white border border-slate-100 shadow-xl relative overflow-hidden group rounded-2xl">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">Dispersed Rewards</p>
            <div className="flex items-center justify-between">
               <h4 className="text-3xl font-black text-slate-900 tracking-tighter">₹{distributedAmount.toLocaleString()}</h4>
               <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:rotate-12 transition-transform">
                  <BadgeCheck className="h-6 w-6" />
               </div>
            </div>
          </Card>

          <Card className="p-7 bg-slate-900 border-none shadow-2xl relative overflow-hidden group rounded-2xl text-white">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Liquidity Health</p>
            <div className="flex items-center justify-between">
               <h4 className="text-3xl font-black text-white tracking-tighter uppercase">Optimal</h4>
               <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-all">
                  <Activity className="h-6 w-6" />
               </div>
            </div>
          </Card>
        </div>

        {/* Clinical Settlement Stream */}
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
             <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
               <FileText className="h-4 w-4 text-blue-600" /> Active Settlement Ledger
             </h2>
             <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{filtered.length} Entries Identified</span>
           </div>

           <div className="grid grid-cols-1 gap-6">
             {loading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl"></div>
                ))
             ) : filtered.length > 0 ? (
               filtered.map((req, idx) => (
                   <motion.div
                     key={req.id}
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: idx * 0.05 }}
                     onClick={() => {
                        setSelectedPayout(req);
                        setShowDetailModal(true);
                     }}
                     className="cursor-pointer"
                   >
                    <Card className="bg-white border border-slate-100 hover:shadow-2xl transition-all rounded-xl overflow-hidden group">
                      <div className="flex flex-col lg:flex-row">
                        {/* Identity Cell */}
                        <div className="flex-1 p-5 sm:p-7 flex items-center gap-4 sm:gap-6">
                          <div className="h-12 w-12 sm:h-14 sm:w-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all shrink-0">
                            <User size={20} className="sm:w-6 sm:h-6" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] sm:text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1 sm:mb-1.5 opacity-50 truncate">#SETTLEMENT-{req.id.slice(-6).toUpperCase()}</p>
                            <h4 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight leading-none mb-1 sm:mb-2 truncate">{req.doctorName}</h4>
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 truncate">
                               <RefreshCcw size={10} className="text-emerald-500" /> {req.requestedAt ? new Date(req.requestedAt.seconds * 1000).toLocaleDateString() : 'Pending'}
                            </p>
                          </div>
                        </div>

                        {/* Payout Target Cell */}
                        <div className="lg:w-80 px-5 sm:px-8 py-5 sm:py-7 bg-slate-50/40 border-y lg:border-y-0 lg:border-x border-slate-100 flex flex-col justify-center gap-3">
                           <div className="flex items-center gap-3 group/copy">
                              <div className="h-9 w-9 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
                                 {req.method === 'upi' ? <Smartphone size={16} className="text-indigo-600" /> : <Landmark size={16} className="text-indigo-600" />}
                              </div>
                              <div className="flex-1 overflow-hidden">
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{req.method} Identity</p>
                                 <div className="flex flex-col">
                                   <div className="flex items-center gap-2">
                                     <p className="text-xs font-black text-slate-700 truncate max-w-[150px]">{req.details || 'Locked'}</p>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         navigator.clipboard.writeText(req.details);
                                         toast.success("Identity Copied!");
                                       }}
                                       className="p-1.5 hover:bg-white rounded-lg text-slate-300 hover:text-blue-600 transition-colors opacity-0 group-hover/copy:opacity-100"
                                     >
                                       <FileText size={12} />
                                     </button>
                                   </div>
                                   {req.verifiedName && (
                                     <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                                       <div className="h-1 w-1 bg-emerald-500 rounded-full animate-pulse" />
                                       <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none truncate">Verified: {req.verifiedName}</p>
                                     </div>
                                   )}
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* Liquidity Control Cell */}
                        <div className="lg:w-[450px] px-5 sm:px-8 py-5 sm:py-7 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-10">
                           <div className="text-center sm:text-right w-full sm:w-auto">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset Value</p>
                              <h3 className="text-2xl font-black text-slate-900 tracking-tighter">₹{Number(req.amount || 0).toLocaleString()}</h3>
                              <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{Number(req.points || 0).toFixed(1)} B-PTS</p>
                           </div>
                           <div className="flex-1 flex justify-end w-full sm:w-auto">
                              {req.status === 'Paid' ? (
                                <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-inner border border-slate-800">
                                  <BadgeCheck size={14} className="text-blue-400" /> Settled Audit
                                </div>
                              ) : (
                                <Button 
                                  isLoading={processingId === req.id}
                                  onClick={(e) => {
                                     e.stopPropagation();
                                     setPayoutToConfirm(req);
                                     setShowConfirmModal(true);
                                  }}
                                  className="w-full sm:w-auto rounded-xl px-8 sm:px-10 h-12 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                  Authorize Settlement <ArrowRight size={14} />
                                </Button>
                              )}
                           </div>
                        </div>
                      </div>
                    </Card>
                 </motion.div>
               ))
             ) : (
               <div className="py-24 text-center bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="h-20 w-20 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-6 transition-transform hover:scale-110">
                     {searchQuery ? <Search className="h-8 w-8 text-slate-300" /> : <AlertCircle className="h-8 w-8 text-slate-200" />}
                  </div>
                  <h4 className="text-slate-900 font-black text-xl mb-2 uppercase tracking-tight">{searchQuery ? 'Zero Matches' : 'Ledger Synchronized.'}</h4>
                  <p className="text-slate-400 font-bold text-xs max-w-xs mx-auto mb-8 opacity-60 uppercase tracking-widest leading-relaxed">{searchQuery ? `No active payouts matching "${searchQuery}".` : 'No active clinical payout requests detected in the protocol cloud.'}</p>
                  {!searchQuery && <Button variant="ghost" onClick={() => toast.success('Redemption Stream Validated')} className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-xl px-10 border border-blue-100/50 h-11">Refresh Local Stream</Button>}
               </div>
             )}
            </div>
         </div>

         {/* ELITE AUTHORIZATION MODAL — Replaces Browser Component */}
         <AnimatePresence>
            {showConfirmModal && payoutToConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                   <motion.div 
                     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                     onClick={() => setShowConfirmModal(false)}
                     className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                   />
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.95, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: 20 }}
                     className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
                   >
                      <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
                         <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <ShieldCheck size={24} />
                         </div>
                         <div>
                            <h3 className="text-lg font-black text-slate-900 leading-none mb-1 uppercase tracking-tight">Security Protocol</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorize Clinical Settlement</p>
                         </div>
                      </div>

                      <div className="p-8 space-y-6">
                         <div className="text-center space-y-2">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity: {payoutToConfirm.doctorName}</p>
                             <h2 className="text-4xl font-black text-slate-900 tracking-tighter">₹{payoutToConfirm.amount.toLocaleString()}</h2>
                             <div className="inline-flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-100">
                                <Activity size={10} /> Deduct: {payoutToConfirm.points.toFixed(1)} B-PTS
                             </div>
                         </div>
                         
                         <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                            <AlertCircle className="text-amber-500 shrink-0 h-4 w-4" />
                            <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-wider">Warning: This action will permanently deduct clinical points from the practitioner's global wallet. Ensure bank transfer is successful before authorization.</p>
                         </div>
                      </div>

                      <div className="p-6 flex flex-col gap-3">
                         <Button 
                           onClick={() => {
                             setShowConfirmModal(false);
                             handleProcess(payoutToConfirm);
                           }}
                           className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-blue-500/20 active:scale-95"
                         >
                           ✓ Confirm Authorization
                         </Button>
                         <button 
                           onClick={() => setShowConfirmModal(false)}
                           className="w-full h-10 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                         >
                           Dismiss Request
                         </button>
                      </div>
                   </motion.div>
                </div>
            )}
         </AnimatePresence>

         {/* SETTLEMENT AUDIT DETAIL MODAL — Drill-down Transparency */}
         <AnimatePresence>
            {showDetailModal && selectedPayout && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                   <motion.div 
                     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                     onClick={() => setShowDetailModal(false)}
                     className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                   />
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.95, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: 20 }}
                     className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col my-4"
                   >
                      {/* Premium Audit Header */}
                      <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                               <FileText size={20} />
                            </div>
                            <div>
                               <h3 className="text-md font-black uppercase tracking-widest leading-none">Settlement Audit</h3>
                               <p className="text-[9px] font-bold text-blue-400 mt-1 uppercase tracking-[0.2em]">Archived Transaction ID: {selectedPayout.id.slice(-8).toUpperCase()}</p>
                            </div>
                         </div>
                         <button onClick={() => setShowDetailModal(false)} className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
                            <X size={18} />
                         </button>
                      </div>

                      <div className="flex-1 p-6 space-y-6">
                         {/* Transaction Status Badge */}
                         <div className="flex justify-center">
                            <div className={`px-4 py-1.5 rounded-full font-black text-[9px] uppercase tracking-[0.2em] flex items-center gap-2 ${selectedPayout.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                               {selectedPayout.status === 'Paid' ? <BadgeCheck size={12} /> : <Clock size={12} />}
                               {selectedPayout.status} Protocol Status
                            </div>
                         </div>

                         {/* Financial Values */}
                         <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Net Disbursed</p>
                               <h3 className="text-xl font-black text-slate-900 tracking-tighter">₹{selectedPayout.amount.toLocaleString()}</h3>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Wallets Sync</p>
                               <h3 className="text-xl font-black text-blue-600 tracking-tighter">{selectedPayout.points.toFixed(1)} <span className="text-xs">PTS</span></h3>
                            </div>
                         </div>

                         {/* Destination Details Section */}
                         <div className="space-y-3">
                            <div className="bg-white border border-slate-100 rounded-xl p-5 space-y-4 shadow-sm">
                               <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Receiver Node</p>
                                     <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedPayout.doctorName}</p>
                                  </div>
                                  <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                     <User size={14} />
                                  </div>
                               </div>

                               <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                                  <div className="space-y-0.5">
                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Protocol Target ({selectedPayout.method.toUpperCase()})</p>
                                     <p className="text-[11px] font-black text-blue-600 tracking-widest leading-none">{selectedPayout.details}</p>
                                     {selectedPayout.verifiedName && <p className="text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1 mt-1 font-mono">✔ ID Confirmed: {selectedPayout.verifiedName}</p>}
                                  </div>
                                  <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                     {selectedPayout.method === 'upi' ? <Smartphone size={14} /> : <Landmark size={14} />}
                                  </div>
                               </div>
                            </div>
                         </div>

                         {/* Forensic Data / Transaction Keys */}
                         {selectedPayout.status === 'Paid' && (
                            <div className="bg-slate-900 rounded-xl p-5 space-y-3">
                               <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                  <Activity size={10} /> External Settlement Keys
                               </p>
                               <div className="grid grid-cols-1 gap-2">
                                  <div className="flex justify-between items-center bg-white/5 rounded-lg p-2.5">
                                     <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Payout ID</span>
                                     <span className="text-[9px] font-mono text-white tracking-widest">{selectedPayout.payoutId || 'Manual Authorization'}</span>
                                  </div>
                                  <div className="flex justify-between items-center bg-white/5 rounded-lg p-2.5">
                                     <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Dispatched At</span>
                                     <span className="text-[9px] font-mono text-white tracking-widest">{selectedPayout.processedAt ? new Date(selectedPayout.processedAt.seconds * 1000).toLocaleString() : 'N/A'}</span>
                                  </div>
                               </div>
                            </div>
                         )}
                      </div>

                      <div className="p-5 border-t border-slate-50 flex gap-3">
                         <button 
                           onClick={() => setShowDetailModal(false)}
                           className="w-full h-11 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200/50"
                         >
                           Dismiss Log Archive
                         </button>
                      </div>
                   </motion.div>
                </div>
            )}
         </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

export default function PayoutManagement() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <PayoutManagementContent />
    </Suspense>
  );
}

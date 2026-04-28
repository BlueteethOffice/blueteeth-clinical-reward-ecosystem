'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  CheckCircle2, Clock, Wallet, Landmark, Phone, 
  Search, ArrowRight, User, AlertCircle, RefreshCcw, Smartphone,
  Activity, FileText, IndianRupee, Gift, BadgeCheck, X, ShieldCheck,
  Users, Stethoscope, Eye, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, onSnapshot, doc, updateDoc, increment, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendEmail } from '@/lib/email';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { updateWithdrawalStatus } from '@/lib/firestore';

import { Suspense } from 'react';

function PayoutManagementContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [filter, setFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // PAGINATION CONTROL NODE
  const [associatePage, setAssociatePage] = useState(1);
  const [clinicianPage, setClinicianPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const handleResize = () => {
      setItemsPerPage(window.innerWidth < 768 ? 2 : 3);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
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
      if (error.code === 'permission-denied') return;
      console.error("Cloud Analytics Sync Failure:", error);
      toast.error('Ledger sync latency identified.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const { user } = useAuth();

  const handleProcess = async (req: any) => {
    if (!user) {
      toast.error('Identity authentication required.');
      return;
    }

    setProcessingId(req.id);
    try {
      const token = await user.getIdToken();

      // 1. DISPATCH ACTUAL MONEY TRANSFER (Automated Node)
      const payoutRes = await fetch('/api/admin/payout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          redemptionId: req.id,
          amount: req.amount,
          vpa: req.details?.upiId || req.details?.vpa || "",
          name: req.doctorName,
          upiId: req.details?.upiId || ""
        })
      });

      const payoutData = await payoutRes.json();
      
      if (!payoutRes.ok || !payoutData.success) {
         throw new Error(payoutData.message || payoutData.error || "Internal API Dispatch Fault.");
      }


      
      // ENTERPRISE DIAGNOSTIC FEEDBACK — CUSTOM PREMIUM TOASTS
      if (payoutData.data?.simulation) {
         toast.custom((t) => (
           <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900 shadow-2xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-white/10 backdrop-blur-md`}>
             <div className="flex-1 w-0 p-5">
               <div className="flex items-start">
                 <div className="flex-shrink-0 pt-0.5">
                   <div className="h-10 w-10 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/10">
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
           <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-blue-600 shadow-2xl rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-10`}>
             <div className="flex-1 w-0 p-5">
               <div className="flex items-start">
                 <div className="flex-shrink-0 pt-0.5">
                   <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center text-white backdrop-blur-md">
                     <BadgeCheck size={20} />
                   </div>
                 </div>
                 <div className="ml-4 flex-1 text-white">
                   <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Clinical Settlement Success</p>
                   <p className="text-sm font-black leading-none uppercase tracking-tight">Rupees Dispatched to {req.doctorName}</p>
                   <p className="mt-2 text-[10px] font-bold text-blue-100 uppercase tracking-widest leading-none opacity-80 italic">Transaction ID: {payoutData.data?.payoutId}</p>
                 </div>
               </div>
             </div>
             <div className="flex border-l border-white/10">
               <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-xs font-black text-white uppercase tracking-widest opacity-60 hover:opacity-100">Close</button>
             </div>
           </div>
         ), { duration: 6000 });
      }

      // 2. Finalize Redemption Identity & Deduct Balances (SECURE NODE)
      const res = await updateWithdrawalStatus(req.id, 'Paid', {
        payoutId: payoutData.data?.payoutId,
        isSimulation: payoutData.data?.simulation || false
      });

      if (!res.success) throw new Error(res.error || "Database Sync Failure.");

      // ✉️ NOTIFY DOCTOR: Payout Settlement Success Node
      if (req.doctorEmail) {
         try {
            await sendEmail({
              to_email: req.doctorEmail,
              to_name: req.doctorName,
              subject: `Success! Your Clinical Yield of ₹${req.amount.toLocaleString()} has been deposited 💸✅`,
              message: `Congratulations Dr. ${req.doctorName}! Your requested payout of ₹${req.amount.toLocaleString()} has been successfully processed and deposited into your registered ${req.method.toUpperCase()} node.`,
              passcode: "SETTLED"
            });
         } catch(e) { console.warn("Doctor Notification Deferred."); }
      }

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
    
    const detailsStr = r.method === 'upi' 
      ? (r.details?.upiId || '') 
      : `${r.details?.accountNumber || ''} ${r.details?.bankName || ''}`;

    const matchesSearch = !q || 
      (r.doctorName || '').toLowerCase().includes(q) || 
      detailsStr.toLowerCase().includes(q) || 
      String(r.amount || '').includes(q);
      
    return matchesTab && matchesSearch;
  });

  const associatePayouts = filtered.filter(r => r.role === 'associate' || !r.role);
  const clinicianPayouts = filtered.filter(r => r.role === 'clinician' || r.role === 'specialist');

  const pendingAssociate = associatePayouts.filter(r => r.status === 'Pending').reduce((a, b) => a + (b.amount || 0), 0);
  const pendingClinician = clinicianPayouts.filter(r => r.status === 'Pending').reduce((a, b) => a + (b.amount || 0), 0);
  const distributedAmount = redemptions.filter(r => r.status === 'Paid').reduce((a, b) => a + (b.amount || 0), 0);

  // RESET PAGES ON FILTER CHANGE
  useEffect(() => {
    setAssociatePage(1);
    setClinicianPage(1);
  }, [filter, searchQuery]);

  const paginatedAssociate = associatePayouts.slice((associatePage - 1) * itemsPerPage, associatePage * itemsPerPage);
  const paginatedClinician = clinicianPayouts.slice((clinicianPage - 1) * itemsPerPage, clinicianPage * itemsPerPage);

  const associateTotalPages = Math.ceil(associatePayouts.length / itemsPerPage);
  const clinicianTotalPages = Math.ceil(clinicianPayouts.length / itemsPerPage);

  return (
    <DashboardLayout isAdminRoute={true}>
      <div className="space-y-10 pb-4">
        {/* Elite Cloud Financial Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-2 sm:px-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-lg bg-blue-50 border border-blue-100 text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 shadow-sm">
               <Activity className="h-3 w-3" /> Live Financial Stream
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">Earnings Control</h1>
            <p className="text-slate-500 font-bold text-[10px] sm:text-xs uppercase tracking-widest opacity-60">Settlement Authorization Node</p>
          </div>
          
          <div className="flex h-10 bg-white rounded-lg shadow-lg border border-slate-200 p-1 w-full lg:w-auto">
            {['Pending', 'Paid', 'All'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Global Financial Telemetry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-2 sm:px-0">
          <Card className="p-5 bg-white border border-slate-100 shadow-xl relative overflow-hidden group rounded-[4px] md:rounded-lg">
            <p className="text-[9px] font-black text-amber-600 uppercase tracking-[0.2em] mb-4">Pending (Associate)</p>
            <div className="flex items-center justify-between">
               <h4 className="text-2xl font-black text-slate-900 tracking-tighter">₹{pendingAssociate.toLocaleString()}</h4>
               <div className="h-10 w-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500 group-hover:rotate-12 transition-transform">
                  <Clock className="h-5 w-5" />
               </div>
            </div>
          </Card>

          <Card className="p-5 bg-white border border-slate-100 shadow-xl relative overflow-hidden group rounded-[4px] md:rounded-lg">
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">Pending (Clinician)</p>
            <div className="flex items-center justify-between">
               <h4 className="text-2xl font-black text-slate-900 tracking-tighter">₹{pendingClinician.toLocaleString()}</h4>
               <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 group-hover:rotate-12 transition-transform">
                  <BadgeCheck className="h-5 w-5" />
               </div>
            </div>
          </Card>

          <Card className="p-5 bg-slate-900 border-none shadow-2xl relative overflow-hidden group rounded-[4px] md:rounded-lg text-white sm:col-span-2 lg:col-span-1">
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Total Settled</p>
            <div className="flex items-center justify-between">
               <h4 className="text-2xl font-black text-white tracking-tighter uppercase">₹{distributedAmount.toLocaleString()}</h4>
               <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center text-blue-400 group-hover:scale-110 transition-all">
                  <Activity className="h-5 w-5" />
               </div>
            </div>
          </Card>
        </div>

        {/* Separated Payout Streams */}
        <div className="grid grid-cols-1 gap-12">
          {/* SECTION 1: ASSOCIATE PAYOUTS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[10px] font-black text-blue-900 uppercase tracking-[0.2em] flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                   <Users size={14} />
                </div>
                Associate Yields
              </h2>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{associatePayouts.length} Nodes Found</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                 <div className="h-32 bg-slate-100 animate-pulse rounded-lg"></div>
              ) : associatePayouts.length > 0 ? (
                <>
                  {paginatedAssociate.map((req, idx) => (
                    <PayoutRow key={req.id} req={req} idx={idx} onProcess={handleProcess} onSelect={(r: any) => { setSelectedPayout(r); setShowDetailModal(true); }} onConfirm={(r: any) => { setPayoutToConfirm(r); setShowConfirmModal(true); }} processingId={processingId} exchangeRate={50} />
                  ))}
                  
                  {associateTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2 py-3 bg-slate-50/50 rounded-xl border border-slate-100">
                      <div className="flex flex-col">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Associate Sequence</p>
                        <p className="text-[9px] font-black text-slate-900 uppercase">Page {associatePage} of {associateTotalPages}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={associatePage === 1}
                          onClick={() => setAssociatePage(p => Math.max(1, p - 1))}
                          className="h-8 px-4 rounded-lg text-[8px] font-black uppercase tracking-widest border-slate-200 hover:bg-white"
                        >
                          Prev
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={associatePage === associateTotalPages}
                          onClick={() => setAssociatePage(p => Math.min(associateTotalPages, p + 1))}
                          className="h-8 px-4 rounded-lg text-[8px] font-black uppercase tracking-widest border-slate-200 hover:bg-white"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState query={searchQuery} />
              )}
            </div>
          </div>

          {/* SECTION 2: CLINICIAN PAYOUTS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 border-t border-slate-100 pt-8">
              <h2 className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                   <Stethoscope size={14} />
                </div>
                Clinician Fees
              </h2>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{clinicianPayouts.length} Nodes Found</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                 <div className="h-32 bg-slate-100 animate-pulse rounded-lg"></div>
              ) : clinicianPayouts.length > 0 ? (
                <>
                  {paginatedClinician.map((req, idx) => (
                    <PayoutRow key={req.id} req={req} idx={idx} isClinician={true} onProcess={handleProcess} onSelect={(r: any) => { setSelectedPayout(r); setShowDetailModal(true); }} onConfirm={(r: any) => { setPayoutToConfirm(r); setShowConfirmModal(true); }} processingId={processingId} exchangeRate={50} />
                  ))}

                  {clinicianTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2 py-3 bg-slate-50/50 rounded-xl border border-slate-100">
                      <div className="flex flex-col">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Clinician Sequence</p>
                        <p className="text-[9px] font-black text-slate-900 uppercase">Page {clinicianPage} of {clinicianTotalPages}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={clinicianPage === 1}
                          onClick={() => setClinicianPage(p => Math.max(1, p - 1))}
                          className="h-8 px-4 rounded-lg text-[8px] font-black uppercase tracking-widest border-slate-200 hover:bg-white"
                        >
                          Prev
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={clinicianPage === clinicianTotalPages}
                          onClick={() => setClinicianPage(p => Math.min(clinicianTotalPages, p + 1))}
                          className="h-8 px-4 rounded-lg text-[8px] font-black uppercase tracking-widest border-slate-200 hover:bg-white"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState query={searchQuery} />
              )}
            </div>
          </div>
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
                     className="relative w-full max-w-md bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
                   >
                      <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center gap-4">
                         <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
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
                                <Activity size={10} /> Deduct: {payoutToConfirm.points?.toFixed(1) || '0.0'} B-PTS
                             </div>
                         </div>
                         
                         <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex gap-3">
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
                           className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-lg shadow-xl shadow-blue-500/20 active:scale-95"
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
                     className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col my-4"
                   >
                      {/* Premium Audit Header */}
                      <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
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
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Net Disbursed</p>
                               <h3 className="text-xl font-black text-slate-900 tracking-tighter">₹{selectedPayout.amount.toLocaleString()}</h3>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Wallets Sync</p>
                               <h3 className="text-xl font-black text-blue-600 tracking-tighter">{selectedPayout.points?.toFixed(1) || '0.0'} <span className="text-xs">PTS</span></h3>
                            </div>
                         </div>

                         {/* Destination Details Section */}
                         <div className="space-y-3">
                            <div className="bg-white border border-slate-100 rounded-lg p-5 space-y-4 shadow-sm">
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
                                     <p className="text-[11px] font-black text-blue-600 tracking-widest leading-none">{selectedPayout.method === 'upi' ? selectedPayout.details?.upiId : selectedPayout.details?.accountNumber}</p>
                                     {selectedPayout.verifiedName && <p className="text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1 mt-1 font-mono">✔ ID Confirmed: {selectedPayout.verifiedName}</p>}
                                  </div>
                                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-all ${
                                     selectedPayout.method === 'upi' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                  }`}>
                                     {selectedPayout.method === 'upi' ? <Smartphone size={14} /> : <Landmark size={14} />}
                                  </div>
                               </div>
                            </div>
                         </div>

                         {/* Forensic Data / Transaction Keys */}
                         {selectedPayout.status === 'Paid' && (
                            <div className="bg-slate-900 rounded-lg p-5 space-y-3">
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
                           className="w-full h-11 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-lg hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200/50"
                         >
                           Dismiss Log Archive
                         </button>
                      </div>
                   </motion.div>
                </div>
            )}
         </AnimatePresence>
    </DashboardLayout>
  );
}

// --- SUB-COMPONENTS FOR FINANCIAL CLARITY ---

function PayoutRow({ req, idx, isClinician = false, onProcess, onSelect, onConfirm, processingId, exchangeRate }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05 }}
      onClick={() => onSelect(req)}
      className="cursor-pointer"
    >
      <Card className={`bg-white border ${isClinician ? 'border-indigo-100 hover:border-indigo-300' : 'border-blue-100 hover:border-blue-300'} hover:shadow-xl transition-all rounded-[4px] md:rounded-xl overflow-hidden group px-2 sm:px-0`}>
        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 p-4 sm:p-5 flex items-center gap-4 sm:gap-5">
            <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shadow-sm border transition-all ${isClinician ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-blue-600 text-white border-blue-500'}`}>
              {isClinician ? <Stethoscope size={18} /> : <User size={18} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-[7.5px] font-black uppercase tracking-widest ${isClinician ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'}`}>
                  {isClinician ? 'Clinician' : 'Associate'}
                </span>
                <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest opacity-50 truncate">#SETTLEMENT-{req.id.slice(-6).toUpperCase()}</p>
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight leading-none mb-1 truncate">{req.doctorName}</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 truncate">
                 <Clock size={10} className={isClinician ? 'text-indigo-400' : 'text-blue-400'} /> {req.requestedAt ? new Date(req.requestedAt.seconds * 1000).toLocaleDateString() : 'Pending'}
              </p>
            </div>
          </div>

          <div className="lg:w-72 px-4 sm:px-6 py-4 sm:py-5 bg-slate-50/50 border-y lg:border-y-0 lg:border-x border-slate-100 flex flex-col justify-center gap-2">
             <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg shadow-sm border flex items-center justify-center shrink-0 transition-colors ${
                   req.method === 'upi' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-blue-50 border-blue-100 text-blue-600'
                }`}>
                   {req.method === 'upi' ? <Smartphone size={14} /> : <Landmark size={14} />}
                </div>
                <div className="flex-1 overflow-hidden">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{req.method.toUpperCase()} ID</p>
                   <p className="text-[11px] font-black text-slate-700 truncate">{req.method === 'upi' ? req.details?.upiId : (req.details?.accountNumber || 'Locked')}</p>
                </div>
             </div>
          </div>

          <div className="lg:w-80 px-4 sm:px-6 py-4 sm:py-5 flex flex-row items-center justify-between gap-4">
             <div className="text-left lg:text-right flex-1">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Disbursement</p>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tighter">₹{Number(req.amount || 0).toLocaleString()}</h3>
             </div>
             <div className="shrink-0">
                {req.status === 'Paid' ? (
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 font-black text-[8px] uppercase tracking-widest border border-emerald-100">
                    <BadgeCheck size={12} /> Settled
                  </div>
                ) : (
                  <Button 
                    isLoading={processingId === req.id}
                    onClick={(e) => {
                       e.stopPropagation();
                       onConfirm(req);
                    }}
                    className={`rounded-lg px-4 sm:px-6 h-9 sm:h-10 text-white font-black text-[8.5px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${isClinician ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                  >
                    Authorize <ArrowRight size={12} />
                  </Button>
                )}
             </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="py-16 text-center bg-white rounded-[4px] md:rounded-xl border border-dashed border-slate-200">
       <div className="h-16 w-16 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <ShieldCheck className="h-8 w-8 text-blue-600" />
       </div>
       <h4 className="text-slate-900 font-black text-sm mb-1 uppercase tracking-tight">Stream Synchronized</h4>
       <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">No active requests in this node.</p>
    </div>
  );
}

export default function PayoutManagement() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <PayoutManagementContent />
    </Suspense>
  );
}

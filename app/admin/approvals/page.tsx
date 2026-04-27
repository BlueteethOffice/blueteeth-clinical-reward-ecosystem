'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import { 
  CheckCircle, XCircle, Eye, User, Phone, MapPin, 
  Search, FileCheck, Image as ImageIcon, ShieldCheck, FileText,
  BadgeCheck, ArrowRight, Zap, ShieldAlert, Activity, Printer, X, Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

import { listenAdminCases, approveCase, rejectCase } from '@/lib/firestore';
import { sendEmail } from '@/lib/email';

const TREATMENT_POINTS: Record<string, number> = {
  'Dental Implant': 10,
  'Root Canal (RCT)': 5,
  'Prophylaxis': 3,
  'Crown & Bridge': 4,
  'Orthodontics': 8,
  'Complete Denture': 6,
  'Scaling & Polishing': 2,
  'Tooth Extraction': 2,
  'Teeth Whitening': 3,
  'Composite Filling': 1.5
};

function FinalApprovalsContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeProofTab, setActiveProofTab] = useState<'initial' | 'final'>('final');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState<'pending' | 'authorized'>('pending');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(3);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(window.innerWidth < 768 ? 2 : 3);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setDataLoading(true);
    const unsub = listenAdminCases(viewTab === 'pending' ? 'Submitted' : 'Approved', (data) => {
      setCases(data || []);
      setDataLoading(false);
    });
    return () => unsub();
  }, [viewTab]);

  const handleFinalApproval = async (caseId: string) => {
    if (processing) return;
    const caseToProcess = cases.find(c => c.id === caseId);
    if (!caseToProcess) return;

    const tid = toast.loading(`AUTHORIZING: Releasing rewards...`);
    setProcessing(true);

    try {
      const fallbackPoints = TREATMENT_POINTS[caseToProcess.treatmentName] || TREATMENT_POINTS[caseToProcess.treatment] || 8;
      const basePoints = caseToProcess.points || caseToProcess.estimatedPoints || fallbackPoints;
      const bonusPoints = Number(caseToProcess.bonusPoints || 0);
      const finalPoints = basePoints + bonusPoints;

      const result = await approveCase(caseId, caseToProcess.doctorUid, finalPoints);

      if (result.success) {
        toast.success(`AUTHORIZED: Settlement released successfully.`, { id: tid });
        
        // ✉️ DISPATCH PROFESSIONAL NOTIFICATION
        if (caseToProcess.doctorEmail || caseToProcess.email) {
          sendEmail({
            to_email: caseToProcess.doctorEmail || caseToProcess.email,
            to_name: caseToProcess.doctorName || caseToProcess.clinicianName || 'Practitioner',
            subject: `Clinical Reward Authorized: Case #${caseToProcess.customCaseId || caseId.slice(0, 8)}`,
            message: `CONGRATULATIONS: Your clinical case for patient "${caseToProcess.patientName}" has been successfully authorized by the Admin Core. 
            
Reward of ${caseToProcess.points} B-Points has been released to your professional wallet. 

You can now view this in your earnings dashboard or proceed with redemption. 

Best Regards,
Blueteeth Clinical Network Team`
          }).catch(e => console.warn("Email alert suppressed."));
        }

        setSelectedCase(null);
      } else {
        toast.error(`Authorization Failed: ${result.error}`, { id: tid });
      }
    } catch (error) {
      toast.error("Security Protocol Error during release.", { id: tid });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApproval = async () => {
    if (selectedIds.length === 0 || processing) return;
    
    const tid = toast.loading(`BATCH AUTHORIZING: Processing ${selectedIds.length} clinical assets...`);
    setProcessing(true);

    try {
      const casesToProcess = cases.filter(c => selectedIds.includes(c.id));
      
      // Group by Doctor UID/Email to send single email per doctor
      const doctorGroups: Record<string, any[]> = {};
      casesToProcess.forEach(c => {
        const key = c.doctorUid || c.doctorEmail || 'unknown';
        if (!doctorGroups[key]) doctorGroups[key] = [];
        doctorGroups[key].push(c);
      });

      let successCount = 0;
      
      for (const [drKey, drCases] of Object.entries(doctorGroups)) {
        // 1. Process all cases in this group in PARALLEL for maximum speed
        const results = await Promise.all(
          drCases.map(c => approveCase(c.id, c.doctorUid, c.points))
        );
        successCount += results.filter(r => r.success).length;

        // 2. Dispatch ONE summary email for this doctor
        const drEmail = drCases[0].doctorEmail || drCases[0].email;
        if (drEmail) {
          const caseListHtml = drCases.map(c => 
            `• Case #${c.customCaseId || c.id.slice(-8)} | Patient: ${c.patientName} | Treatment: ${c.treatment} | Reward: ${c.points} Pts`
          ).join('\n');

          const totalPoints = drCases.reduce((acc, c) => acc + (c.points || 0), 0);

          sendEmail({
            to_email: drEmail,
            to_name: drCases[0].doctorName || 'Practitioner',
            subject: `Clinical Settlement Report: ${drCases.length} Rewards Authorized`,
            message: `SETTLEMENT AUTHORIZED: We are pleased to inform you that ${drCases.length} of your clinical submissions have been successfully authorized.

AUTHORIZED ASSETS:
${caseListHtml}

TOTAL RELEASED: ${totalPoints} B-Points
The rewards have been instantly credited to your professional wallet.

Best Regards,
Blueteeth Clinical Network`
          }).catch(e => console.warn("Batch email suppressed."));
        }
      }

      toast.success(`BATCH SUCCESS: ${successCount} assets authorized and settled.`, { id: tid });
        setSelectedIds([]);
    } catch (error) {
      toast.error("Batch Protocol Error identifying clinical nodes.", { id: tid });
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };
  const filteredCases = cases.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(c.patientName || '').toLowerCase().includes(q) || 
      String(c.treatment || '').toLowerCase().includes(q) ||
      String(c.clinicianName || '').toLowerCase().includes(q) ||
      String(c.id || '').toLowerCase().includes(q)
    );
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCases = filteredCases.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
     // Reset to first page if search query changes
     setCurrentPage(1);
  }, [searchQuery]);

  const openInNewTab = (url: string) => {
    if (!url) return;
    
    if (url.startsWith('data:')) {
      try {
        const parts = url.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const b64 = atob(parts[1]);
        let n = b64.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = b64.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } catch (e) {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  };
  
  return (
    <DashboardLayout isAdminRoute={true}>
      <Suspense fallback={<div className="space-y-6 animate-pulse p-8"><div className="h-20 bg-slate-100 rounded-xl"/><div className="grid grid-cols-3 gap-6"><div className="h-64 bg-slate-100 rounded-xl"/><div className="h-64 bg-slate-100 rounded-xl"/><div className="h-64 bg-slate-100 rounded-xl"/></div></div>}>
        <div className="space-y-6 pb-2" suppressHydrationWarning>
        {/* Elite Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-slate-50/90 backdrop-blur-xl z-50 py-4 sm:py-6 border-b border-slate-200/50 px-2 sm:px-0">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <div className="h-8 w-8 bg-blue-600 rounded-[4px] flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <BadgeCheck className="text-white h-5 w-5" />
               </div>
               <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">Authorization Center</h1>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-11">Final Audit & Release Console</p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative group flex-1 sm:flex-initial">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
               <input 
                 type="text"
                 placeholder="SEARCH CLINICAL ASSETS..."
                 className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-100 transition-all shadow-sm w-full sm:w-72 outline-none"
                 value={searchQuery}
                 onChange={(e) => {
                    const params = new URLSearchParams(window.location.search);
                    if (e.target.value) params.set('q', e.target.value);
                    else params.delete('q');
                    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
                 }}
               />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <Card className="bg-white border-slate-100 border-t-4 border-t-amber-500 shadow-xl shadow-amber-500/5 overflow-hidden relative group">
              <CardContent className="p-6">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Queue Status</p>
                 <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-black text-slate-900">{filteredCases.length}</h3>
                    <div className="h-10 w-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
                       <Activity size={20} />
                    </div>
                 </div>
                 <p className="text-[9px] font-bold text-amber-600 uppercase mt-4 flex items-center gap-1">
                    <Zap size={10} /> Pending Admin Authorization
                 </p>
              </CardContent>
           </Card>

           <Card className="bg-white border-slate-100 border-t-4 border-t-emerald-500 shadow-xl shadow-emerald-500/5 overflow-hidden relative group">
              <CardContent className="p-6">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Security Status</p>
                 <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-black text-slate-900">100%</h3>
                    <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                       <ShieldCheck size={20} />
                    </div>
                 </div>
                 <p className="text-[9px] font-bold text-emerald-600 uppercase mt-4 flex items-center gap-1">
                    <CheckCircle size={10} /> Encryption Protocols Active
                 </p>
              </CardContent>
           </Card>

           <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-blue-500 shadow-2xl shadow-blue-500/10 overflow-hidden relative group">
              <CardContent className="p-6">
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 text-blue-400">Node Cluster</p>
                 <div className="flex items-end justify-between">
                    <h3 className="text-3xl font-black text-white italic">PROD-01</h3>
                    <div className="h-10 w-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                       <Zap size={20} />
                    </div>
                 </div>
                 <p className="text-[9px] font-bold text-blue-400 uppercase mt-4 flex items-center gap-1">
                    <Activity size={10} className="animate-pulse" /> Real-time Sync Active
                 </p>
              </CardContent>
           </Card>
        </div>

        {/* View Tabs - Premium Navigation */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-[6px] w-fit border border-slate-200 mt-6 shadow-inner mx-2 sm:mx-0 overflow-x-auto no-scrollbar max-w-[calc(100vw-32px)]">
           <button 
             onClick={() => setViewTab('pending')}
             className={`px-4 sm:px-6 py-2.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest transition-all duration-200 ease-out active:scale-95 flex items-center gap-2 whitespace-nowrap ${viewTab === 'pending' ? 'bg-white text-blue-600 shadow-sm border border-slate-200 ring-2 ring-blue-500/5' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <Activity size={12} /> Pending Auth
           </button>
           <button 
             onClick={() => setViewTab('authorized')}
             className={`px-4 sm:px-6 py-2.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${viewTab === 'authorized' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200 ring-2 ring-emerald-500/5' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <CheckCircle size={12} /> Authorized
           </button>
        </div>

        {/* Main List */}
         <div className="mt-8">
           {(!hasMounted || dataLoading) ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                   <div key={i} className="h-64 bg-white rounded-[4px] border-2 border-slate-900/10 animate-pulse shadow-sm flex flex-col">
                      <div className="p-4 border-b border-slate-100 bg-slate-50 h-16" />
                      <div className="p-4 space-y-4 flex-1">
                         <div className="h-6 bg-slate-100 rounded w-3/4" />
                         <div className="h-4 bg-slate-50 rounded w-1/2" />
                         <div className="grid grid-cols-2 gap-2 mt-4">
                            <div className="h-12 bg-slate-50 rounded" />
                            <div className="h-12 bg-slate-50 rounded" />
                         </div>
                      </div>
                   </div>
                ))}
             </div>
           ) : paginatedCases.length > 0 ? (
             <>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedCases.map((c, idx) => (
                    <motion.div 
                      key={c.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                       <Card className={`bg-white border-2 hover:border-blue-600 shadow-sm hover:shadow-xl transition-all group overflow-hidden h-full flex flex-col ${selectedIds.includes(c.id) ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-900'}`}>
                          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div 
                                 onClick={(e) => { 
                                   if (viewTab === 'authorized') return;
                                   e.stopPropagation(); 
                                   toggleSelect(c.id); 
                                 }}
                                 className={`h-6 w-6 rounded-[4px] border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 ${viewTab === 'authorized' ? 'bg-emerald-500 border-emerald-500 text-white cursor-default' : (selectedIds.includes(c.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 hover:border-blue-400')}`}
                               >
                                  {(selectedIds.includes(c.id) || viewTab === 'authorized') && <CheckCircle size={14} />}
                               </div>
                               <div className="h-9 w-9 bg-white rounded-[4px] flex items-center justify-center text-blue-600 shadow-sm border border-slate-200 overflow-hidden relative">
                                  {c.finalProof ? (
                                    <img src={c.finalProof} className="h-full w-full object-cover" alt="" />
                                  ) : (
                                    <FileText size={18} />
                                  )}
                               </div>
                               <div>
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Asset ID</p>
                                  <p className="text-xs font-black text-slate-900 uppercase">#{c.id.slice(-8)}</p>
                               </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                               <span className={`px-3 py-1 text-white text-[9px] font-black rounded-[4px] uppercase tracking-widest shadow-lg ${viewTab === 'authorized' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}>
                                  {viewTab === 'authorized' ? 'Authorized' : 'Submitted'}
                               </span>
                               {(c.doctorUid === c.clinicianUid || (c.doctorName && c.clinicianName && c.doctorName.replace(/^Dr\.\s*/, '') === c.clinicianName.replace(/^Dr\.\s*/, ''))) && (
                                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-[4px] border border-amber-200 animate-pulse">OWN CASE **</span>
                               )}
                            </div>
                         </div>

                          <CardContent className="p-3 flex-1 space-y-3">
                             <div className="space-y-2">
                                <div>
                                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Clinical Case</p>
                                   <h4 className="text-base font-black text-slate-900 uppercase leading-none group-hover:text-blue-600 transition-colors">
                                      {c.patientName} {(c.doctorUid === c.clinicianUid || (c.doctorName && c.clinicianName && c.doctorName.replace(/^Dr\.\s*/, '') === c.clinicianName.replace(/^Dr\.\s*/, ''))) && <span className="text-amber-500">**</span>}
                                   </h4>
                                   <p className="text-[9px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                                      <Activity size={10} className="text-blue-500" /> {c.treatment}
                                   </p>
                                </div>

                              <div className="grid grid-cols-2 gap-2">
                                  <div className="p-2 bg-gradient-to-br from-violet-500/10 to-purple-500/5 backdrop-blur-sm rounded-[4px] border border-violet-200/60">
                                     <p className="text-[7px] font-black text-violet-500 uppercase mb-0.5 tracking-widest leading-none">
                                        {c.doctorRole === 'associate' ? 'Associate' : 'Submitter'}
                                     </p>
                                     <p className="text-[9px] font-black text-slate-900 truncate">{c.doctorName || 'N/A'}</p>
                                  </div>
                                  <div className="p-2 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 backdrop-blur-sm rounded-[4px] border border-cyan-200/60">
                                     <p className="text-[7px] font-black text-cyan-600 uppercase mb-0.5 tracking-widest leading-none">Charge & Reward</p>
                                     <p className="text-[9px] font-black text-emerald-600 truncate">₹{Number(c.treatmentCharge || 0).toLocaleString()}</p>
                                     <p className="text-[8px] font-black text-blue-600 mt-0.5">+{Number(c.points || 0).toFixed(1)} Pts {c.bonusPoints > 0 && <span className="text-amber-500">+{c.bonusPoints}B</span>}</p>
                                  </div>
                              </div>

                              <div className="p-2 bg-gradient-to-br from-amber-500/10 to-orange-400/5 backdrop-blur-sm rounded-[4px] border border-amber-200/60 border-dashed">
                                 <p className="text-[7px] font-black text-amber-600 uppercase mb-1 tracking-widest">Final Conclusion</p>
                                 <p className="text-[10px] font-medium text-slate-700 italic leading-relaxed">"{c.clinicianNotes || 'Standard procedural workflow completed.'}"</p>
                              </div>
                           </div>

                           <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                              <Button 
                                 variant="outline" 
                                 onClick={() => setSelectedCase(c)}
                                 className="h-9 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest border-slate-900 hover:bg-slate-50"
                              >
                                 Review Proof
                              </Button>
                              <Button 
                                 disabled={viewTab === 'authorized' || processing}
                                 onClick={() => handleFinalApproval(c.id)}
                                 className={`h-9 flex-1 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-xl transition-all active:scale-[0.98] ${viewTab === 'authorized' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default shadow-none' : 'bg-slate-900 hover:bg-blue-600 text-white'}`}
                              >
                                 {viewTab === 'authorized' ? 'Authorized & Settled' : 'Finalize & Release'}
                                 {viewTab !== 'authorized' && <ArrowRight size={12} className="ml-1 group-hover:translate-x-1 transition-transform" />}
                                 {viewTab === 'authorized' && <CheckCircle size={12} className="ml-1" />}
                              </Button>
                           </div>
                        </CardContent>
                     </Card>
                  </motion.div>
                ))}
               </div>

               {/* Pagination Controls */}
               {totalPages > 1 && (
                  <div className="mt-12 flex items-center justify-center gap-4">
                     <Button 
                       variant="outline" 
                       disabled={currentPage === 1}
                       onClick={() => {
                          setCurrentPage(prev => Math.max(1, prev - 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                       }}
                       className="h-10 px-6 rounded-xl border-2 border-slate-900 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                     >
                        Previous
                     </Button>
                     <div className="flex items-center gap-2">
                        {(() => {
                           const buttons = [];
                           const maxVisible = 3;
                           let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                           let end = Math.min(totalPages, start + maxVisible - 1);
                           
                           if (end - start + 1 < maxVisible) {
                              start = Math.max(1, end - maxVisible + 1);
                           }

                           for (let i = start; i <= end; i++) {
                              buttons.push(
                                 <button
                                   key={i}
                                   onClick={() => {
                                      setCurrentPage(i);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                   }}
                                   className={`h-8 w-8 rounded-lg text-[10px] font-black transition-all border-2 ${currentPage === i ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}
                                 >
                                    {i}
                                 </button>
                              );
                           }
                           return buttons;
                        })()}
                     </div>
                     <Button 
                       variant="outline"
                       disabled={currentPage === totalPages}
                       onClick={() => {
                          setCurrentPage(prev => Math.min(totalPages, prev + 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                       }}
                       className="h-10 px-6 rounded-xl border-2 border-slate-900 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                     >
                        Next
                     </Button>
                  </div>
               )}
             </>
           ) : (
             <div className="py-32 flex flex-col items-center justify-center text-center">
                <div className="h-24 w-24 bg-slate-100 rounded-3xl flex items-center justify-center mb-6 text-slate-300 border border-slate-200 border-dashed">
                   <ShieldCheck size={48} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Queue Synchronized</h3>
                <p className="text-sm text-slate-400 mt-2 font-medium max-w-sm">All specialist submissions have been processed and rewards have been authorized.</p>
             </div>
           )}
        </div>

        {/* Floating Detailed Review Modal */}
        <AnimatePresence>
          {selectedCase && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
                onClick={() => setSelectedCase(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-[4px] shadow-2xl overflow-hidden border-2 border-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-blue-600 rounded-[2px] flex items-center justify-center shadow-lg">
                         <ShieldCheck size={16} />
                      </div>
                      <div>
                         <h3 className="text-xs font-black uppercase tracking-tight">Clinical Proof Audit</h3>
                         <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">ID: #{selectedCase.id.slice(-8)}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-700" />
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[100px]">{selectedCase.patientName}</span>
                         </div>
                      </div>
                   </div>
                   <button onClick={() => setSelectedCase(null)} className="h-7 w-7 rounded-[2px] bg-slate-800 hover:bg-red-500 flex items-center justify-center transition-all group">
                      <X size={16} className="text-slate-400 group-hover:text-white" />
                   </button>
                </div>

                <div className="p-3 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                   {/* Primary Identity Row */}
                   <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-[4px] border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                         <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Source Associate</p>
                         <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-[2px] bg-amber-100 flex items-center justify-center text-amber-600 border border-amber-200">
                               <User size={14} />
                            </div>
                            <p className="text-[10px] font-black text-slate-900 truncate">{selectedCase.doctorName || 'Practitioner'}</p>
                         </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-[4px] border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                         <p className="text-[8px] font-black text-blue-700 uppercase tracking-widest mb-1">Technical Specialist</p>
                         <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-[2px] bg-blue-100 flex items-center justify-center text-blue-600 border border-blue-200">
                               <Activity size={14} />
                            </div>
                            <p className="text-[10px] font-black text-slate-900 truncate">{selectedCase.clinicianName || 'Specialist'}</p>
                         </div>
                      </div>
                   </div>

                   {/* Financial Metrics Deck */}
                   <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-white rounded-[4px] border-2 border-slate-900 flex flex-col items-center justify-center text-center">
                         <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-1">Treatment Fee</p>
                         <p className="text-[11px] font-black text-slate-900 leading-none">₹{Number(selectedCase.treatmentCharge || 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-blue-600 rounded-[4px] border-2 border-slate-900 flex flex-col items-center justify-center text-center shadow-lg">
                         <p className="text-[6px] font-black text-blue-100 uppercase tracking-widest mb-1">Associate Reward</p>
                         <p className="text-[11px] font-black text-white leading-none">
                            {(Number(selectedCase.points || TREATMENT_POINTS[selectedCase.treatmentName] || TREATMENT_POINTS[selectedCase.treatment] || 0) + Number(selectedCase.bonusPoints || 0)).toFixed(1)} Pts
                         </p>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-[4px] border-2 border-slate-900 flex flex-col items-center justify-center text-center">
                         <p className="text-[7px] font-black text-emerald-700 uppercase tracking-widest mb-1">Specialist Fee</p>
                         <p className="text-[11px] font-black text-emerald-800 leading-none">₹{Number(selectedCase.clinicianFee || 150).toLocaleString()}</p>
                      </div>
                   </div>

                   {/* Patient Info Cards Row */}
                   <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-2 p-2 bg-white rounded-[4px] border-2 border-slate-900">
                         <div className="h-5 w-5 rounded-[2px] bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                            <User size={10} />
                         </div>
                          <div className="min-w-0">
                             <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Patient</p>
                             <p className="text-[9px] font-black text-slate-900 truncate uppercase">{selectedCase.patientName}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-[4px] border-2 border-slate-900">
                         <div className="h-5 w-5 rounded-[2px] bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                            <Phone size={10} />
                         </div>
                          <div className="min-w-0">
                             <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Contact</p>
                             <p className="text-[9px] font-black text-slate-900 truncate">{selectedCase.patientMobile || selectedCase.mobile}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-white rounded-[4px] border-2 border-slate-900">
                         <div className="h-5 w-5 rounded-[2px] bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                            <MapPin size={10} />
                         </div>
                          <div className="min-w-0">
                             <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Site</p>
                             <p className="text-[9px] font-black text-slate-900 truncate uppercase">{selectedCase.location || 'N/A'}</p>
                          </div>
                      </div>
                   </div>

                   {/* Proof Selector Tabs */}
                   <div className="flex p-0.5 bg-slate-100 rounded-[4px] border border-slate-200">
                      <button 
                        onClick={() => setActiveProofTab('initial')}
                        className={`flex-1 py-1 text-[7px] font-black uppercase tracking-widest rounded-[2px] transition-all ${activeProofTab === 'initial' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                         Associate
                      </button>
                      <button 
                        onClick={() => setActiveProofTab('final')}
                        className={`flex-1 py-1 text-[7px] font-black uppercase tracking-widest rounded-[2px] transition-all flex items-center justify-center gap-1.5 ${activeProofTab === 'final' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                         Specialist
                         <div className="flex items-center gap-1 px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[5px] border border-emerald-200">
                            <CheckCircle size={6} /> DONE
                         </div>
                      </button>
                   </div>

                   <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Evidence Asset</p>
                        <div className="flex gap-1.5">
                           <Button 
                             variant="outline" 
                             size="sm"
                             className="h-6 px-1.5 text-[7px] font-black uppercase tracking-widest border-slate-900 rounded-[2px] gap-1"
                             onClick={() => {
                               const url = activeProofTab === 'initial' 
                                 ? (selectedCase.initialProof || selectedCase.proofUrl || selectedCase.evidenceUrl || selectedCase.imageUrl)
                                 : (selectedCase.finalProof || selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl);
                               if (url) openInNewTab(url);
                             }}
                           >
                             <ImageIcon size={8} /> View
                           </Button>
                           <Button 
                             variant="outline" 
                             size="sm"
                             className="h-6 px-1.5 text-[7px] font-black uppercase tracking-widest border-slate-900 rounded-[4px] gap-1"
                             onClick={() => {
                               const url = activeProofTab === 'initial' 
                                 ? (selectedCase.initialProof || selectedCase.proofUrl || selectedCase.evidenceUrl || selectedCase.imageUrl)
                                 : (selectedCase.finalProof || selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl);
                               if (!url) return;
                               const printWindow = window.open('', '_blank');
                               if (printWindow) {
                                 printWindow.document.write(`<img src="${url}" style="max-width:100%;" onload="window.print();window.close();">`);
                                 printWindow.document.close();
                               }
                             }}
                           >
                             <Printer size={8} /> Print
                           </Button>
                        </div>
                      </div>
                      
                      <div 
                        onClick={() => {
                          const url = activeProofTab === 'initial' 
                             ? (selectedCase.initialProof || selectedCase.proofUrl || selectedCase.evidenceUrl || selectedCase.imageUrl)
                             : (selectedCase.finalProof || selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl);
                          openInNewTab(url);
                        }}
                        className="group relative h-36 bg-slate-50 rounded-[4px] overflow-hidden cursor-pointer border-2 border-slate-900 flex items-center justify-center"
                      >
                         {(() => {
                           const url = activeProofTab === 'initial' 
                             ? (selectedCase.initialProof || selectedCase.proofUrl || selectedCase.evidenceUrl || selectedCase.imageUrl)
                             : (selectedCase.finalProof || selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl);

                           if (!url) return (
                             <div className="text-center p-4">
                                <ShieldAlert size={24} className="text-slate-200 mx-auto mb-1" />
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">No Technical Proof Available</p>
                             </div>
                           );
                           
                           const isPDF = url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf');

                           if (isPDF) {
                             return (
                               <div className="flex flex-col items-center justify-center gap-2 text-red-500">
                                 <FileText size={32} />
                                 <p className="text-[8px] font-black uppercase tracking-widest">PDF Attachment</p>
                               </div>
                             );
                           }

                           return (
                             <>
                               <img src={url} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" alt="proof" />
                               <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                                  <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-slate-900 shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                                     <Eye size={16} />
                                  </div>
                               </div>
                             </>
                           );
                         })()}
                      </div>
                   </div>

                   <div className="p-2 bg-blue-50 rounded-[4px] border-2 border-slate-900 border-dashed">
                      <p className="text-[7px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                         <FileText size={8} /> Specialist Justification
                      </p>
                      <p className="text-[9px] font-medium text-slate-700 leading-tight italic truncate">
                         "{selectedCase.clinicianNotes || 'Case resolved successfully per clinical guidelines.'}"
                      </p>
                   </div>

                   <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={() => setSelectedCase(null)} className="h-10 rounded-[4px] text-[9px] font-black uppercase tracking-widest border-2 border-slate-900 hover:bg-slate-50 transition-all">
                         Decline
                      </Button>
                      <Button 
                        onClick={() => handleFinalApproval(selectedCase.id)}
                        disabled={processing}
                        className="h-10 rounded-[4px] bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[9px] tracking-widest shadow-xl shadow-blue-500/20 border-2 border-slate-900 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        Authorize <ArrowRight size={12} />
                      </Button>
                   </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Bulk Action Bar - Premium Floating Console */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4"
          >
            <div className="bg-slate-900 border-2 border-blue-500/50 rounded-2xl p-3 sm:p-4 shadow-3xl shadow-blue-500/20 flex flex-col sm:flex-row items-center justify-between backdrop-blur-xl gap-4">
               <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg animate-pulse shrink-0">
                     <BadgeCheck size={20} />
                  </div>
                  <div>
                     <p className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Bulk Operations Active</p>
                     <p className="text-xs sm:text-sm font-black text-white">{selectedIds.length} Assets Selected</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={() => setSelectedIds([])}
                    className="sm:hidden ml-auto text-[9px] font-black text-slate-400 uppercase tracking-widest p-2"
                  >
                    <X size={16} />
                  </Button>
               </div>
               <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <Button 
                    variant="ghost" 
                    onClick={() => setSelectedIds([])}
                    className="hidden sm:flex text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest px-6"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleBulkApproval}
                    disabled={processing}
                    className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 h-11 sm:h-12 rounded-xl font-black text-[10px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.2em] shadow-xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 border border-blue-400/20"
                  >
                    {processing ? 'Processing...' : 'Authorize Batch'} <ArrowRight size={14} />
                  </Button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Bar - Premium Floating Console */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-4"
          >
            <div className="bg-slate-900 border-2 border-blue-500/50 rounded-2xl p-4 shadow-3xl shadow-blue-500/20 flex items-center justify-between backdrop-blur-xl">
               <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg animate-pulse">
                     <BadgeCheck size={20} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Bulk Operations Active</p>
                     <p className="text-sm font-black text-white">{selectedIds.length} Assets Selected for Authorization</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={() => setSelectedIds([])}
                    className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest px-6"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleBulkApproval}
                    disabled={processing}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/30 active:scale-95 transition-all flex items-center gap-2 border border-blue-400/20"
                  >
                    {processing ? 'Processing...' : 'Authorize & Notify Session'} <ArrowRight size={14} />
                  </Button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </Suspense>
  </DashboardLayout>
);
}

export default function FinalApprovals() {
  return <FinalApprovalsContent />;
}

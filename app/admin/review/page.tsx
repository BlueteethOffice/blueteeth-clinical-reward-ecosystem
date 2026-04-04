'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import { 
  CheckCircle, XCircle, Eye, User, Phone, MapPin, 
  Calendar, ClipboardList, Coins, Search, Filter, ExternalLink,
  FileCheck, Image as ImageIcon, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { fetchAdminCases, approveCase, rejectCase, revokeCase } from '@/lib/firestore';
import { Suspense } from 'react';
 
function CaseReviewContent() {

  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [dataLoading, setDataLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'Pending' | 'Approved'>('Pending');
  const [showPreview, setShowPreview] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({
    open: false, title: '', message: '', type: 'info' as any
  });

  const filteredCases = cases.filter(c => {
    // Even if case has status, we already fetched by status, so we just do search filtering
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(c.patientName || '').toLowerCase().includes(q) || 
      String(c.patientMobile || '').includes(q) ||
      String(c.treatment || '').toLowerCase().includes(q) ||
      String(c.id || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = filteredCases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  React.useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    setDataLoading(true);
    const data = await fetchAdminCases(filterStatus);
    setCases(data);
    setDataLoading(false);
  };

  const handleAction = async (caseId: string, action: 'approve' | 'reject' | 'revoke') => {
    setLoading(caseId);
    
    try {
      let result;
      if (action === 'approve') {
        result = await approveCase(caseId, selectedCase.doctorUid, selectedCase.points);
      } else if (action === 'revoke') {
        result = await revokeCase(caseId, selectedCase.doctorUid, selectedCase.points);
      } else {
        result = await rejectCase(caseId);
      }

      if (result.success) {
        toast.success(`Case ${action}ed successfully.`);
        setSelectedCase(null);
        await loadData();
      } else {
        toast.error(`Failed to ${action} case.`);
      }
    } catch (error) {
      toast.error("An error occurred during processing.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <DashboardLayout isAdminRoute={true}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-4">
          <div>
            <h1 className="text-2xl font-black text-blue-900 tracking-tight">Case Review Queue</h1>
            <p className="text-slate-500 mt-1 font-medium text-sm">Review and approve submitted patient cases to credit points.</p>
          </div>
          <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/50 gap-0.5">
            <button 
              onClick={() => setFilterStatus('Pending')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'Pending' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Pending ({filterStatus === 'Pending' ? cases.length : '...'})
            </button>
            <button 
              onClick={() => setFilterStatus('Approved')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'Approved' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Approved
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Pending List */}
          <div className="lg:col-span-2 space-y-4">
            {dataLoading ? (
               [...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl" suppressHydrationWarning={true}></div>
               ))
            ) : filteredCases.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-100" suppressHydrationWarning={true}>
                  <Search className="mx-auto h-12 w-12 text-slate-200 mb-2" suppressHydrationWarning={true} />
                  <p className="text-slate-400 font-medium" suppressHydrationWarning={true}>
                    {searchQuery ? `No results for "${searchQuery}"` : 'No pending cases to review.'}
                  </p>
               </div>
            ) : (
              <div className="space-y-4" suppressHydrationWarning={true}>
                {paginatedCases.map((c, idx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <Card 
                        onClick={() => {
                          console.log("[DEBUG] Selected Case Data:", c);
                          setSelectedCase(null); 
                          setTimeout(() => setSelectedCase(c), 50);
                        }}
                        className={`cursor-pointer transition-all border-l-4 ${
                          selectedCase?.id === c.id ? 'border-l-blue-600 ring-2 ring-blue-500/10 scale-[1.01] bg-blue-50/20' : 'border-l-transparent hover:border-l-slate-300 shadow-sm'
                        }`}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center font-black text-blue-600 text-xs ring-1 ring-blue-500/10">
                              {globalIdx}
                            </div>
                            <div>
                              <h4 className="font-bold text-blue-900 group-hover:text-blue-600 transition-colors uppercase">{c.patientName}</h4>
                              <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest">ID: {c.patientMobile}</p>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-6">
                            <div className="hidden sm:block">
                              <p className="text-[11px] font-black text-slate-600 uppercase italic">{c.treatment}</p>
                              <p className="text-[9px] text-slate-400 font-bold">{new Date(c.submittedAt?.seconds * 1000).toLocaleDateString()}</p>
                            </div>
                            <div className="flex flex-col items-center justify-center h-10 w-14 bg-blue-50 rounded-lg ring-1 ring-blue-500/10">
                              <span className="text-xs font-black text-blue-700">{c.points}</span>
                              <span className="text-[7px] font-black text-blue-500 uppercase tracking-tighter">PTS</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg group bg-blue-50/50 hover:bg-blue-100/50 border border-blue-100/20">
                              <Eye className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}

                {/* Clinical Pagination Footer */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-6 px-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       Showing {paginatedCases.length} of {filteredCases.length} Submissions
                    </p>
                    <div className="flex items-center gap-2">
                       <Button 
                         variant="outline" 
                         disabled={currentPage === 1}
                         onClick={() => setCurrentPage(p => p - 1)}
                         className="h-8 px-3 rounded-lg border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                       >
                         Prev
                       </Button>
                       {[...Array(totalPages)].map((_, i) => (
                         <button
                           key={i}
                           onClick={() => setCurrentPage(i + 1)}
                           className={`h-8 w-8 rounded-lg text-[10px] font-black transition-all ${
                             currentPage === i + 1 
                               ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                               : 'bg-white border border-slate-100 text-slate-400 hover:border-blue-200'
                           }`}
                         >
                           {i + 1}
                         </button>
                       ))}
                       <Button 
                         variant="outline" 
                         disabled={currentPage === totalPages}
                         onClick={() => setCurrentPage(p => p + 1)}
                         className="h-8 px-3 rounded-lg border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                       >
                         Next
                       </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Review Details Pane */}
          <AnimatePresence mode="wait">
            {selectedCase ? (
              <motion.div
                key={selectedCase.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="lg:col-span-1 sticky top-24"
              >
                <Card className="overflow-hidden">
                  <div className="bg-slate-900 px-3 py-2 text-white flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Case Audit</span>
                    <h3 className="text-sm font-black text-blue-400">#{selectedCase.id.slice(0, 6)}</h3>
                  </div>
                  <CardContent className="p-3 space-y-4">
                    {/* Patient Summary - Ultra Compact */}
                    <div className="space-y-1.5 font-sans">
                      <div className="flex items-center gap-3 p-2 bg-slate-50/80 rounded-lg border border-slate-100">
                        <User className="h-3.5 w-3.5 text-blue-400" />
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Name</p>
                          <p className="font-bold text-blue-900 text-xs">{selectedCase.patientName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-2 bg-slate-50/80 rounded-lg border border-slate-100">
                        <Phone className="h-3.5 w-3.5 text-blue-400" />
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Contact</p>
                          <p className="font-bold text-blue-900 text-xs">{selectedCase.patientMobile}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-2 bg-slate-50/80 rounded-lg border border-slate-100">
                        <MapPin className="h-3.5 w-3.5 text-blue-400" />
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Clinic Location</p>
                          <p className="font-bold text-blue-900 text-xs leading-none">{selectedCase.location}</p>
                        </div>
                      </div>
                    </div>

                    {/* Proof Attachment - Corrected Implementation */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                         <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Evidence Proof Attachment</h4>
                         <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase">Verify Data</span>
                      </div>
                      <div 
                        onClick={() => {
                          if (selectedCase?.evidenceUrl || selectedCase?.proofUrl || selectedCase?.imageUrl || selectedCase?.url || (selectedCase?.evidenceUrls && selectedCase.evidenceUrls.length > 0)) {
                            setShowPreview(true);
                          } else {
                            setModalState({
                              open: true,
                              title: 'Missing Visual Proof',
                              message: 'This clinical record has been synchronized without an attached image. Manual document verification is required before points allocation.',
                              type: 'warning'
                            });
                          }
                        }}
                        className="h-44 bg-slate-50/50 rounded-xl flex flex-col items-center justify-center border border-dashed border-slate-200 group hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden shadow-inner"
                      >
                         {/* SMART DETECTION: Checking all possible proof fields with Ultra Precision */}
                         {(selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl || selectedCase.url || (selectedCase.evidenceUrls && selectedCase.evidenceUrls.length > 0)) ? (
                           <>
                             <img 
                               src={selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl || selectedCase.url || selectedCase.evidenceUrls?.[0]} 
                               alt="Clinical Proof" 
                               key={selectedCase.id} // Force image re-render if ID changes
                               className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                               onError={(e) => {
                                 console.warn("Evidence Image Load Failure for Case:", selectedCase.id);
                                 e.currentTarget.style.display = 'none';
                               }}
                             />
                             <div className="absolute inset-0 bg-blue-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm">
                               <ExternalLink className="h-5 w-5 text-white mb-1.5" />
                               <p className="text-[9px] font-black text-white uppercase tracking-[0.15em]">Inspect High-Res</p>
                               {(selectedCase.evidenceUrls?.length > 1) && (
                                 <span className="mt-1 text-[8px] font-black text-blue-300">+{selectedCase.evidenceUrls.length - 1} More Views</span>
                               )}
                             </div>
                           </>
                         ) : (
                           <div className="flex flex-col items-center justify-center py-4 bg-white w-full h-full text-center p-4">
                              <ImageIcon className="h-6 w-6 text-slate-200 group-hover:text-blue-500 transition-colors mb-2" />
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No Visual Proof Synced</p>
                              <p className="text-[7px] text-slate-400 mt-1 uppercase">Manual verification required</p>
                           </div>
                         )}
                      </div>
                    </div>

                     {/* Decision Actions - Conditional for Pending only */}
                    <div className="pt-2">
                      {selectedCase.status === 'Approved' ? (
                        <div className="space-y-3">
                          <div className="w-full h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-2 text-emerald-700 font-bold text-[10px] uppercase tracking-widest shadow-sm">
                             <CheckCircle className="h-4 w-4" /> Points Dispatched & Verified
                          </div>
                          <Button
                            onClick={() => handleAction(selectedCase.id, 'revoke')}
                            isLoading={loading === selectedCase.id}
                            variant="outline"
                            className="w-full h-8 rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50 text-[9px] font-black uppercase tracking-widest"
                          >
                            Undo Approval (Revert to Pending)
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <Button 
                            onClick={() => handleAction(selectedCase.id, 'reject')}
                            isLoading={loading === selectedCase.id}
                            variant="outline" 
                            className="h-10 rounded-lg text-red-600 border-red-50 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest"
                          >
                            Reject
                          </Button>
                          <Button 
                            onClick={() => handleAction(selectedCase.id, 'approve')}
                            isLoading={loading === selectedCase.id}
                            className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 shadow-sm text-[10px] font-black uppercase tracking-widest text-white"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" /> Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="lg:col-span-1 h-64 relative group overflow-hidden rounded-xl border border-white">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-cyan-500/10 animate-pulse-slow" />
                <div className="absolute inset-0 backdrop-blur-2xl bg-white/40 border border-white/40 flex flex-col items-center justify-center p-8 text-center shadow-2xl shadow-blue-900/5">
                  <div className="h-16 w-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/30 mb-6">
                    <ClipboardList className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="text-slate-900 font-black text-lg tracking-tight">Access Case Intelligence</h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-2 leading-relaxed uppercase tracking-widest opacity-70">Identify a submission from the clinical queue to initiate audit protocols.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* High-Resolution Clinical Proof Lightbox */}
      <AnimatePresence>
        {showPreview && selectedCase && (selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl || selectedCase.url || (selectedCase.evidenceUrls && selectedCase.evidenceUrls.length > 0)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
            onClick={() => setShowPreview(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[82vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 z-50">
                <Button 
                   onClick={() => setShowPreview(false)}
                   className="h-8 w-8 p-0 rounded-full bg-slate-900/10 hover:bg-red-500 hover:text-white text-slate-500 backdrop-blur-md transition-all border border-slate-200"
                >
                   <XCircle className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex flex-col h-full bg-white">
                <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <FileCheck className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinical Audit Document</p>
                      <h3 className="text-sm font-black text-slate-900">Verification: {selectedCase.patientName}</h3>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 bg-slate-50/30 overflow-auto flex items-center justify-center p-4">
                   <img 
                      src={selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.evidenceUrls?.[0]} 
                      alt="Full Resolution Evidence"
                      className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm border border-slate-100"
                   />
                </div>
                
                <div className="p-4 bg-white border-t border-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="flex flex-col justify-center">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Case Reference</p>
                     <p className="text-xs font-bold text-slate-700 opacity-80 italic">#{selectedCase.id.slice(0, 10).toUpperCase()}</p>
                   </div>
                   <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
                      <Button 
                        onClick={() => {
                          const imageUrl = selectedCase.evidenceUrl || selectedCase.proofUrl;
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(`
                              <html>
                                <head>
                                  <title>Print Evidence - Blueteeth</title>
                                  <style>
                                    body { margin: 0; display: flex; justify-content: center; align-items: flex-start; }
                                    img { max-width: 100%; height: auto; display: block; }
                                    @media print { img { max-height: 100%; } }
                                  </style>
                                </head>
                                <body>
                                  <img src="${imageUrl}" onload="window.print();window.close();" />
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                          }
                        }}
                        variant="ghost" 
                        className="h-9 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white transition-all"
                      >
                         Print
                      </Button>
                      <Button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = selectedCase.evidenceUrl || selectedCase.proofUrl;
                          link.download = `Blueteeth_Case_${selectedCase.id.slice(0, 6)}.jpg`;
                          link.click();
                        }}
                        variant="ghost" 
                        className="h-9 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 hover:bg-emerald-600 hover:text-white transition-all"
                      >
                         Download
                      </Button>
                      <a 
                        href={selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.evidenceUrls?.[0]} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50">
                          Full View
                        </Button>
                      </a>
                   </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Professional Clinical Identity Modal */}
      <AnimatePresence>
        {modalState.open && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
             onClick={() => setModalState(prev => ({ ...prev, open: false }))}
           >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl relative border border-slate-100 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                 <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
                 <div className="flex flex-col items-center text-center space-y-6 pt-4">
                    <div className={`h-24 w-24 rounded-xl flex items-center justify-center shadow-xl ${
                      modalState.type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                    }`}>
                       {modalState.type === 'warning' ? <Filter className="h-10 w-10" /> : <ShieldCheck className="h-10 w-10" />}
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">{modalState.title}</h3>
                       <p className="mt-4 text-sm font-medium text-slate-500 leading-relaxed px-2">
                          {modalState.message}
                       </p>
                    </div>
                    <Button 
                      onClick={() => setModalState(prev => ({ ...prev, open: false }))}
                      className="w-full h-14 rounded-xl bg-slate-900 hover:bg-black text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl"
                    >
                      Acknowledge Review
                    </Button>
                 </div>
              </motion.div>
           </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

export default function CaseReview() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <CaseReviewContent />
    </Suspense>
  );
}

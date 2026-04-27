'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  FileCheck, Clock, CheckCircle2, ChevronLeft, 
  ChevronRight, Search, Hash, Activity, ExternalLink,
  FilePlus, Calendar, Eye, X, User, Phone, MapPin, 
  Image as ImageIcon, ShieldCheck, DollarSign, Zap, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import toast from 'react-hot-toast';

const ClinicianSubmissions = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const itemsPerPage = 8;

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'cases'), 
      where('doctorUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedData = data.sort((a: any, b: any) => {
        const dateA = a.submittedAt?.seconds || 0;
        const dateB = b.submittedAt?.seconds || 0;
        return dateB - dateA;
      });
      setCases(sortedData);
      setLoading(false);
    }, (err) => {
      console.error("Submissions Sync Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Pagination Logic
  const totalPages = Math.ceil(cases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCases = cases.slice(startIndex, startIndex + itemsPerPage);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <>
      <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-3 pt-4 pb-0">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pb-4 lg:pb-3 px-1 sm:px-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
               <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Submissions</h1>
               <span className="text-[10px] font-black bg-blue-600 text-white px-2.5 py-1 rounded-lg shadow-lg shadow-blue-200">{cases.length}</span>
            </div>
            <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <Activity size={12} className="text-blue-500 animate-pulse" /> Clinical Node Master Registry
            </p>
          </div>
          <Link href="/clinician/submit-case" className="w-full lg:w-auto">
             <Button className="w-full lg:w-auto bg-slate-900 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] px-8 rounded-xl h-12 shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3">
                <FilePlus size={16} /> New Submission Node
             </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className="py-40 text-center">
             <div className="flex flex-col items-center gap-6">
                 <div className="h-28 w-28 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-xl shadow-blue-500/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-blue-200/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <FilePlus size={48} className="relative z-10" />
                 </div>
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">No Submissions Found</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-xs mx-auto">Your patient referral registry is empty. Begin by submitting your first clinical node.</p>
                </div>
             </div>
          </div>
        ) : (
          <div className="space-y-3 px-2 sm:px-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {currentCases.map((c, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={c.id}
                  className={`p-[1px] rounded-[4px] h-full transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1 bg-gradient-to-br ${
                      c.status === 'Pending' ? 'from-amber-400 via-orange-500 to-yellow-600 shadow-amber-500/5' :
                      c.status === 'Approved' ? 'from-emerald-400 via-teal-500 to-green-600 shadow-emerald-500/5' :
                      'from-blue-400 via-indigo-500 to-blue-600 shadow-blue-500/5'
                   }`}
                >
                      <div className="bg-white rounded-[4px] p-5 h-full flex flex-col justify-between group relative overflow-hidden">
                         <div className="relative z-10">
                            <div className="flex justify-between items-start mb-5">
                               <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-base shadow-2xl transition-all duration-300">
                                  {c.patientName?.charAt(0).toUpperCase()}
                               </div>
                               <div className="text-right">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Potential Yield</span>
                                  <span className="text-xl font-black text-slate-900 tracking-tighter">
                                     ₹{(c.clinicianFee || (c.bPoints ? c.bPoints * 10 : 0)).toLocaleString()}
                                  </span>
                               </div>
                            </div>

                             <div className="space-y-3">
                                <div>
                                   <h3 className="text-base font-black text-slate-900 tracking-tight uppercase leading-none truncate mb-1.5">{c.patientName}</h3>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{c.treatmentName || c.treatment}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                   <span className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border shadow-sm ${
                                      c.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                      c.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                      'bg-blue-50 text-blue-600 border-blue-200'
                                   }`}>{c.status === 'Approved' ? 'Settled' : c.status}</span>
                                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-100 shadow-inner">ID: {c.customCaseId || c.id.slice(0,8).toUpperCase()}</span>
                                </div>
                             </div>
                          </div>

                          <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between relative z-10">
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <Calendar size={12} className="text-blue-500" />
                                {c.submittedAt?.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                             </div>
                             <button 
                               onClick={() => setSelectedCase(c)}
                               className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 group/btn"
                             >
                                Details <Eye size={12} className="group-hover/btn:scale-110 transition-transform" />
                             </button>
                          </div>
                          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700" />
                       </div>
                </motion.div>
              ))}
            </div>

              {/* Premium Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-3 pt-8 pb-2">
                  <div className="inline-flex items-center gap-1 bg-slate-900 rounded-[4px] p-1.5 shadow-2xl shadow-slate-900/20 border border-slate-800">
                    {/* Prev Button */}
                    <button
                      onClick={prevPage}
                      disabled={currentPage === 1}
                      className="h-9 w-9 rounded-[4px] flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all active:scale-95"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {/* Divider */}
                    <div className="h-5 w-px bg-white/10 mx-0.5" />

                    {/* Page Numbers */}
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`h-9 min-w-[36px] px-2 rounded-[4px] text-[11px] font-black tracking-wide transition-all active:scale-95 ${
                          currentPage === i + 1
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}

                    {/* Divider */}
                    <div className="h-5 w-px bg-white/10 mx-0.5" />

                    {/* Next Button */}
                    <button
                      onClick={nextPage}
                      disabled={currentPage === totalPages}
                      className="h-9 w-9 rounded-[4px] flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 transition-all active:scale-95"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Label */}
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    Manifest Page {currentPage} of {totalPages}
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </DashboardLayout>

    {/* Case Detail Modal */}
    <AnimatePresence>
       {selectedCase && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
             onClick={() => setSelectedCase(null)}
           />
           <motion.div
             initial={{ opacity: 0, scale: 0.9, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: 20 }}
             className="relative bg-white w-full max-w-lg max-h-[96vh] sm:max-h-[92vh] rounded-[4px] shadow-3xl overflow-hidden border border-slate-200 flex flex-col"
             onClick={(e) => e.stopPropagation()}
           >
             {/* Header */}
             <div className="bg-slate-900 p-5 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 bg-blue-600 rounded-[4px] flex items-center justify-center shadow-lg">
                      <FileCheck size={20} />
                   </div>
                   <div>
                      <h3 className="text-sm font-black uppercase tracking-widest">Submission Detail</h3>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest opacity-80">Node ID: #{selectedCase.id.slice(-8)}</p>
                   </div>
                </div>
                <button onClick={() => setSelectedCase(null)} className="h-8 w-8 rounded-[4px] bg-white/10 hover:bg-red-500 flex items-center justify-center transition-all group">
                   <X size={18} className="text-white" />
                </button>
             </div>

             <div className="p-5 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
                {/* Status & Date */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-[4px] border border-slate-100">
                   <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Submission Status</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                         selectedCase.status === 'Approved' ? 'text-emerald-600' : 'text-amber-600'
                      }`}>{selectedCase.status}</span>
                   </div>
                   <div className="text-right flex flex-col gap-0.5">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Submitted On</span>
                      <span className="text-[10px] font-black text-slate-900 uppercase">
                         {selectedCase.submittedAt?.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                   </div>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-3">
                      <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                            <User size={10} className="text-blue-500" /> Patient Name
                         </p>
                         <p className="text-sm font-black text-slate-900 uppercase">{selectedCase.patientName}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                            <Activity size={10} className="text-blue-500" /> Protocol
                         </p>
                         <p className="text-sm font-black text-slate-900 uppercase">{selectedCase.treatment || selectedCase.treatmentName}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                            <Activity size={10} className="text-emerald-500" /> Treatment Charge
                         </p>
                         <p className="text-sm font-black text-emerald-600 uppercase italic">₹{Number(selectedCase.treatmentCharge || 0).toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="space-y-3">
                      <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                            <Phone size={10} className="text-blue-500" /> Contact
                         </p>
                         <p className="text-sm font-black text-slate-900 uppercase">{selectedCase.patientMobile || selectedCase.mobile || 'N/A'}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                            <MapPin size={10} className="text-blue-500" /> Location
                         </p>
                         <p className="text-sm font-black text-slate-900 uppercase">{selectedCase.location || 'N/A'}</p>
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                            <DollarSign size={10} className="text-blue-600" /> Consultation Fee
                         </p>
                         <p className="text-sm font-black text-blue-700 uppercase italic">₹{selectedCase.status === 'Pending' ? '0' : Number(selectedCase.clinicianFee || 0).toLocaleString()}</p>
                      </div>
                   </div>
                </div>

                {/* Evidence Section */}
                <div className="space-y-2 pt-2">
                   <p className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                      <ImageIcon size={12} className="text-blue-600" /> Clinical Asset Proof (Click to Enlarge)
                   </p>
                   {(selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.initialProof || selectedCase.imageUrl) ? (
                      <div 
                        onClick={() => {
                          const imageUrl = selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.initialProof || selectedCase.imageUrl;
                          if (imageUrl.startsWith('data:')) {
                            const parts = imageUrl.split(',');
                            const base64Data = parts[1];
                            const mimeString = parts[0].split(':')[1].split(';')[0];
                            const byteCharacters = atob(base64Data);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                              byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], {type: mimeString});
                            const blobUrl = URL.createObjectURL(blob);
                            window.open(blobUrl, '_blank');
                          } else {
                            window.open(imageUrl, '_blank');
                          }
                        }}
                        className="block aspect-video bg-slate-50 rounded-[4px] border border-slate-200 overflow-hidden relative group cursor-pointer"
                      >
                         {(() => {
                            const url = selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.initialProof || selectedCase.imageUrl;
                            const isPDF = url?.includes('application/pdf') || url?.includes('.pdf') || url?.startsWith('data:application/pdf');
                            
                            if (isPDF) {
                              return (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50">
                                   <FileText size={48} className="text-red-500" />
                                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Clinical PDF Document</p>
                                   <span className="text-[8px] font-bold text-blue-600 underline">CLICK TO VIEW FULL DOSSIER</span>
                                </div>
                              );
                            }
                            
                            return (
                              <img 
                                src={url} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                alt="submission proof" 
                                onError={(e) => {
                                  // Fallback for broken images if they are actually PDFs but not detected
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const div = document.createElement('div');
                                    div.className = "w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-bold text-[10px] uppercase";
                                    div.innerText = "Document View (Click to Open)";
                                    parent.appendChild(div);
                                  }
                                }}
                              />
                            );
                         })()}
                         <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ExternalLink size={24} className="text-white" />
                         </div>
                      </div>
                   ) : (
                      <div className="aspect-video bg-slate-100 rounded-[4px] border border-slate-200 overflow-hidden relative flex flex-col items-center justify-center text-slate-300">
                         <Activity size={48} className="mb-2" />
                         <p className="text-[10px] font-black uppercase tracking-widest">No Visual Proof Attached</p>
                      </div>
                   )}
                </div>

                {/* Reward Detail */}
                <div className="p-4 bg-blue-600 rounded-[4px] text-white shadow-xl shadow-blue-500/20 flex items-center justify-between">
                   <div>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Authorized Settlement</p>
                       <p className="text-3xl font-black italic">₹{Number(Number(selectedCase.treatmentCharge || 0) + (selectedCase.status === 'Pending' ? 0 : Number(selectedCase.clinicianFee || 0))).toLocaleString()}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Verified Node</p>
                      <ShieldCheck size={24} className="text-white/40" />
                   </div>
                </div>
             </div>
           </motion.div>
         </div>
       )}
    </AnimatePresence>
    </>
  );
};

export default ClinicianSubmissions;

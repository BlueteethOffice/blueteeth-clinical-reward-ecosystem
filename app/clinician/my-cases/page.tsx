'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  FileCheck, Clock, CheckCircle2, ChevronLeft, 
  ChevronRight, Search, Hash, Activity, ExternalLink,
  FilePlus, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
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
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-2 pb-2">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 pb-5 px-1 sm:px-0">
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
                <div className="h-24 w-24 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 border border-slate-100 shadow-inner">
                   <FilePlus size={48} />
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
                             <Link href={`/clinician/work/${c.id}`}>
                                <button className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 group/btn">
                                   Manifest <ChevronRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
                                 </button>
                             </Link>
                          </div>
                          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700" />
                       </div>
                </motion.div>
              ))}
            </div>              {/* Compact Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-2 sm:gap-4 pt-3 pb-1 border-t border-slate-100">
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={prevPage}
                        disabled={currentPage === 1}
                        className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all shadow-xl active:scale-95"
                      >
                         <ChevronLeft size={20} />
                      </button>
                      
                      <div className="flex items-center gap-2 px-4 h-10 sm:h-12 bg-slate-50 border border-slate-200 rounded-[4px] shadow-inner overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
                         {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i + 1)}
                              className={`h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-lg text-[9px] sm:text-[10px] font-black transition-all ${
                                 currentPage === i + 1 
                                 ? 'bg-slate-900 text-white shadow-2xl' 
                                 : 'text-slate-400 hover:text-slate-900'
                              }`}
                            >
                               {i + 1}
                            </button>
                         ))}
                      </div>
   
                      <button 
                        onClick={nextPage}
                        disabled={currentPage === totalPages}
                        className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all shadow-xl active:scale-95"
                      >
                         <ChevronRight size={20} />
                      </button>
                   </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
                     Manifest Page {currentPage} of {totalPages}
                  </p>
               </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ClinicianSubmissions;

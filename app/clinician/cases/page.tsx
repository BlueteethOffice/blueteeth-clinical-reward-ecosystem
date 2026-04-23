'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ClipboardList, Clock, CheckCircle2, ChevronLeft, 
  ChevronRight, Search, Hash, Phone, ArrowRight, Activity, Calendar,
  Zap, Play, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { fetchClinicianCases, startCaseWork } from '@/lib/firestore';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ClinicianCasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status');
  const [itemsPerPage, setItemsPerPage] = useState(8);

  useEffect(() => {
    const updateItemsPerPage = () => {
      setItemsPerPage(window.innerWidth < 640 ? 2 : 8);
    };
    updateItemsPerPage();
    window.addEventListener('resize', updateItemsPerPage);
    return () => window.removeEventListener('resize', updateItemsPerPage);
  }, []);

  const loadCases = async (isSilent = false) => {
    if (!user?.uid) return;
    if (!isSilent) setLoading(true);
    try {
      const data = await fetchClinicianCases(user.uid);
      setCases(data);
    } catch (error) {
      toast.error("Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [user?.uid]);

  const filteredCases = cases.filter(c => {
    if (statusFilter) {
       if (statusFilter === 'Completed' && c.status !== 'Approved' && c.status !== 'Submitted') return false;
       if (statusFilter !== 'Completed' && c.status !== statusFilter) return false;
    }

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(c.patientName || '').toLowerCase().includes(q) ||
      String(c.patientMobile || '').includes(q) ||
      String(c.treatment || '').toLowerCase().includes(q)
    );
  });

  const paginatedCases = filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);

  const handleStartWork = async (caseId: string) => {
    setProcessingId(caseId);
    try {
      const res = await startCaseWork(caseId);
      if (res.success) {
        toast.success("Clinical Node Initialized", {
          duration: 3000,
          style: {
            background: '#0F172A',
            color: '#fff',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '10px',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '16px'
          },
          iconTheme: { primary: '#6366F1', secondary: '#fff' }
        });
        await loadCases(true);
      } else {
        toast.error(res.error || "System Sync Failure");
      }
    } catch (err) {
      console.error(err);
      toast.error("Critical Connection Error");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-2 pb-2">
        
        {/* Workspace Hub Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-6 pb-2 sm:pb-6 px-1 sm:px-0">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-3">
               <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">
                 {statusFilter ? `${statusFilter} Nodes` : 'Clinical Registry'}
               </h1>
               <span className="text-[10px] font-black bg-blue-600 text-white px-2.5 py-1 rounded-[4px] shadow-lg shadow-blue-200">{filteredCases.length}</span>
            </div>
            <div className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               <div className="h-1.5 w-1.5 rounded-[4px] bg-blue-500 animate-pulse" /> 
               Management Protocol Active
            </div>
          </div>
          
          <div className="relative w-full lg:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="SEARCH REGISTRY..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 h-12 sm:h-14 rounded-[4px] border border-slate-200 bg-white focus:ring-4 focus:ring-blue-100 outline-none font-black text-[10px] uppercase tracking-widest shadow-xl transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-slate-50 animate-pulse rounded-[4px] border border-slate-100" />
            ))}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-40 text-center">
             <div className="flex flex-col items-center gap-6">
                <div className="h-24 w-24 bg-blue-50 rounded-[4px] flex items-center justify-center text-blue-500 border border-blue-100 shadow-xl shadow-blue-500/5 relative">
                   <Activity size={48} />
                   <div className="absolute inset-0 bg-blue-400 rounded-[4px] blur-2xl opacity-10 animate-pulse" />
                </div>
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">No Active Nodes</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-xs mx-auto">Your clinical registry is empty for this filter. New assignments will appear here.</p>
                </div>
             </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6 pt-4 px-1 sm:px-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {paginatedCases.map((c, index) => (
                 <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: index * 0.05 }}
                  key={c.id} 
                  className={`p-[1px] rounded-[4px] h-full transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1 bg-gradient-to-br ${
                      c.status === 'Assigned' ? 'from-blue-400 via-indigo-500 to-purple-600 shadow-blue-500/10' :
                      c.status === 'In Progress' ? 'from-amber-400 via-orange-500 to-yellow-600 shadow-amber-500/10' :
                      'from-emerald-400 via-teal-500 to-green-600 shadow-emerald-500/10'
                   }`}
                >
                      <div className="bg-white/90 backdrop-blur-md rounded-[4px] p-3 sm:p-5 h-full flex flex-col justify-between group cursor-default overflow-hidden relative">
                         <div className="space-y-2 sm:space-y-4 relative z-10">
                            <div className="flex justify-between items-start">
                               <div className="h-10 w-10 rounded-[4px] bg-slate-900 flex items-center justify-center text-white font-black text-base shadow-2xl transition-transform duration-500 shrink-0">
                                  {c.patientName?.charAt(0).toUpperCase()}
                               </div>
                               <div className="text-right">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Clinic Yield</span>
                                  <span className="text-xl font-black text-slate-900 tracking-tighter leading-none">₹{c.clinicianFee?.toLocaleString() || '0'}</span>
                               </div>
                            </div>

                            <div className="space-y-3">
                               <div>
                                  <h3 className="text-base font-black text-slate-900 tracking-tight uppercase leading-none truncate mb-2">
                                     {c.doctorUid === user?.uid && <span className="text-amber-500 mr-1 text-sm">★</span>}
                                     {c.patientName}
                                  </h3>
                                  <div className="flex flex-col gap-2 mt-1">
                                     <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">
                                        <Activity size={10} className="text-blue-500 shrink-0" />
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[120px]">{c.treatmentName || c.treatment}</span>
                                     </div>
                                     {c.doctorUid !== user?.uid && (
                                        <div className="flex items-center gap-1.5">
                                           <span className="text-[7px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-[4px] uppercase tracking-widest border border-indigo-100">
                                              Ref: {c.doctorName?.split(' ')[0] || 'Associate'}
                                           </span>
                                        </div>
                                     )}
                                  </div>
                               </div>

                               <div className="flex items-center gap-2 pt-1">
                                  <span className={`px-2.5 py-1 rounded-[4px] text-[8px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1 ${
                                     c.status === 'Assigned' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                     c.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                     c.status === 'Submitted' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                     'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  }`}>
                                     {c.status === 'Approved' && <CheckCircle2 size={10} className="text-emerald-500" />}
                                     {c.status}
                                  </span>
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-[4px] border border-slate-100 shadow-inner">ID: {c.id.slice(0,8).toUpperCase()}</span>
                                  {(c.status === 'Submitted' || c.status === 'Approved') && (
                                     <div className="flex flex-col items-end">
                                        <p className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">Resolved By</p>
                                        <p className="text-[8px] font-black text-blue-600 uppercase leading-none">{c.solvedByName || 'Specialist'}</p>
                                     </div>
                                  )}
                               </div>
                            </div>
                         </div>

                         <div className="mt-2 sm:mt-8 space-y-2 sm:space-y-3 relative z-10">
                            <div className="flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest px-0.5 border-b border-slate-50 pb-3">
                               <div className="flex items-center gap-1.5">
                                  <Calendar size={12} className="text-blue-400" />
                                  {c.date || 'ACTIVE'}
                                </div>
                                <span className="text-slate-300">PROTOCOL NODE</span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3 pt-2">
                               <Link href={`/clinician/work/${c.id}`} className="block">
                                  <Button 
                                    className={`w-full text-white text-[10px] font-black uppercase tracking-[0.2em] h-12 rounded-[4px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${
                                      c.status === 'Assigned' ? 'bg-slate-900 hover:bg-slate-800' :
                                      c.status === 'In Progress' ? 'bg-blue-600 hover:bg-blue-700' :
                                      'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                  >
                                    {c.status === 'Assigned' ? 'Open Node' : 
                                     c.status === 'In Progress' ? 'Workspace' : 
                                     'Audit View'} <ArrowRight size={14} />
                                  </Button>
                               </Link>
                               {c.status === 'Assigned' && (
                                  <Button 
                                    onClick={() => handleStartWork(c.id)} 
                                    disabled={processingId === c.id}
                                    className="w-full bg-white border-2 border-amber-500 text-amber-600 hover:bg-amber-50 text-[10px] font-black uppercase tracking-[0.2em] h-12 rounded-[4px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                                  >
                                    {processingId === c.id ? (
                                      <div className="h-5 w-5 border-2 border-amber-500/30 border-t-amber-600 rounded-full animate-spin" />
                                    ) : (
                                      <><Play size={14} fill="currentColor" /> Activate Node</>
                                    )}
                                  </Button>
                               )}
                            </div>
                         </div>
                         <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-700" />
                      </div>
                </motion.div>
              ))}
            </div>
            {/* Premium Pagination Controls */}
             {totalPages > 1 && (
                <div className="flex flex-col items-center gap-2 sm:gap-4 pt-3 sm:pt-12 pb-1 sm:pb-6 border-t border-slate-100/60">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-[4px] bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all shadow-xl active:scale-95"
                    >
                       <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex items-center gap-2 px-4 h-10 sm:h-12 bg-slate-50 border border-slate-200 rounded-[4px] shadow-inner overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
                       {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`h-7 w-7 sm:h-8 sm:w-8 shrink-0 rounded-[4px] text-[9px] sm:text-[10px] font-black transition-all ${
                               currentPage === i + 1 
                               ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20' 
                               : 'text-slate-400 hover:text-slate-900'
                            }`}
                          >
                             {i + 1}
                          </button>
                       ))}
                    </div>
  
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-[4px] bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all shadow-xl active:scale-95"
                    >
                       <ChevronRight size={20} />
                    </button>
                  </div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    Registry Node <span className="text-slate-900">{currentPage}</span> of <span className="text-slate-900">{totalPages}</span>
                 </p>
               </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

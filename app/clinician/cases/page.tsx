'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ClipboardList, Clock, CheckCircle2, ChevronLeft, 
  ChevronRight, Search, Hash, Phone, ArrowRight, Activity, Calendar,
  Zap, Play, ExternalLink, Filter, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { fetchClinicianCases, startCaseWork } from '@/lib/firestore';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ClinicianCasesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const searchParams = useSearchParams();
  const getTabFromParam = (param: string | null) => (param === 'Submitted' || param === 'Approved') ? 'Completed' : (param || 'All');
  const [activeTab, setActiveTab] = useState(getTabFromParam(searchParams.get('status')));
  const [itemsPerPage, setItemsPerPage] = useState(8);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setActiveTab(getTabFromParam(status));
    }
  }, [searchParams]);

  useEffect(() => {
    const updateItemsPerPage = () => {
      setItemsPerPage(window.innerWidth < 640 ? 4 : 8);
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
    // Tab Filter
    if (activeTab !== 'All') {
       if (activeTab === 'Completed') {
          if (c.status !== 'Approved' && c.status !== 'Submitted') return false;
       } else {
          if (c.status !== activeTab) return false;
       }
    }

    // Search Filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(c.patientName || '').toLowerCase().includes(q) ||
      String(c.patientMobile || '').includes(q) ||
      String(c.treatment || '').toLowerCase().includes(q) ||
      String(c.customCaseId || c.id).toLowerCase().includes(q)
    );
  });

  const paginatedCases = filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);

  const handleStartWork = async (caseId: string) => {
    setProcessingId(caseId);
    try {
      const res = await startCaseWork(caseId);
      if (res.success) {
        toast.success("Work Started!", {
          duration: 3000,
          style: { background: '#0F172A', color: '#fff', borderRadius: '4px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' },
        });
        await loadCases(true);
        // Automatically switch to 'In Progress' tab to show work is starting
        setActiveTab('In Progress');
      } else {
        toast.error(res.error || "Failed to start work");
      }
    } catch (err) {
      toast.error("Critical Connection Error");
    } finally {
      setProcessingId(null);
    }
  };

  const tabs = [
    { name: 'All', icon: List },
    { name: 'Assigned', icon: Clock },
    { name: 'In Progress', icon: Activity },
    { name: 'Completed', icon: CheckCircle2 },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-4 pb-6 px-2 sm:px-0">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
               <div className="h-12 w-12 bg-slate-900 rounded-[4px] flex items-center justify-center text-white shadow-xl shadow-slate-200">
                  <ClipboardList size={24} />
               </div>
               <div>
                  <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">
                    Cases Ledger
                  </h1>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                     <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> System Online & Synced
                  </p>
               </div>
            </div>
          </div>
          
          <div className="relative w-full lg:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="SEARCH BY NAME OR ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 h-14 rounded-[4px] border border-slate-200 bg-white focus:ring-4 focus:ring-blue-100 outline-none font-black text-[10px] uppercase tracking-widest shadow-xl transition-all"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-4">
           {tabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => { setActiveTab(tab.name); setCurrentPage(1); }}
                className={`flex items-center gap-3 px-6 py-3.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-4 ${
                  activeTab === tab.name 
                    ? 'bg-slate-900 text-white border-blue-600 shadow-xl shadow-slate-200 translate-y-[-2px]' 
                    : 'bg-white text-slate-400 border-transparent hover:bg-slate-50'
                }`}
              >
                <tab.icon size={16} />
                {tab.name}
                <span className={`ml-2 px-2 py-0.5 rounded-[4px] text-[8px] ${activeTab === tab.name ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                   {cases.filter(c => {
                      if (tab.name === 'All') return true;
                      if (tab.name === 'Completed') return c.status === 'Approved' || c.status === 'Submitted';
                      return c.status === tab.name;
                   }).length}
                </span>
              </button>
           ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-slate-50 animate-pulse rounded-[4px] border border-slate-100" />
            ))}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-40 text-center bg-white rounded-[4px] border border-dashed border-slate-200 shadow-inner">
             <div className="flex flex-col items-center gap-6">
                <div className="h-24 w-24 bg-slate-50 rounded-[4px] flex items-center justify-center text-slate-200 border border-slate-100">
                   <Activity size={48} />
                </div>
                <div className="space-y-2">
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest">No Cases Found</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-xs mx-auto">No records match your current filter or search criteria.</p>
                </div>
             </div>
          </div>
        ) : (
          <div className="space-y-8 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedCases.map((c, index) => (
                 <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: index * 0.05 }}
                  key={c.id} 
                  className={`p-[1px] rounded-[4px] h-full transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1 bg-gradient-to-br ${
                      c.status === 'Assigned' ? 'from-slate-200 to-slate-300 hover:from-amber-400 hover:to-orange-500' :
                      c.status === 'In Progress' ? 'from-blue-400 to-indigo-600' :
                      'from-emerald-400 to-teal-600'
                   }`}
                >
                      <div className="bg-white rounded-[4px] p-5 h-full flex flex-col justify-between group cursor-default overflow-hidden relative">
                         <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-start">
                               <div className="h-12 w-12 rounded-[4px] bg-slate-900 flex items-center justify-center text-white font-black text-lg shadow-2xl transition-transform duration-500 shrink-0">
                                  {c.patientName?.charAt(0).toUpperCase()}
                               </div>
                               <div className="text-right">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">My Fee</span>
                                  <span className="text-2xl font-black text-slate-900 tracking-tighter leading-none">₹{c.clinicianFee?.toLocaleString() || '0'}</span>
                               </div>
                            </div>

                            <div className="space-y-4">
                               <div>
                                  <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none truncate mb-2">
                                     {c.patientName}
                                  </h3>
                                  <div className="flex flex-col gap-2 mt-1">
                                     <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 w-fit">
                                        <Activity size={12} className="text-blue-500 shrink-0" />
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest truncate max-w-[150px]">{c.treatmentName || c.treatment}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-[4px] text-[8px] font-black uppercase tracking-widest border shadow-sm flex items-center gap-1.5 ${
                                           c.status === 'Assigned' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                           c.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                           c.status === 'Submitted' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                           'bg-emerald-50 text-emerald-600 border-emerald-200'
                                        }`}>
                                           {c.status === 'Approved' && <CheckCircle2 size={10} className="text-emerald-500" />}
                                           {c.status}
                                        </span>
                                        {c.doctorUid === user?.uid && (
                                           <span className="px-2 py-1 bg-indigo-600 text-white rounded-[4px] text-[8px] font-black uppercase tracking-widest shadow-md">SELF CASE</span>
                                        )}
                                     </div>
                                  </div>
                               </div>

                               <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                  <div className="flex flex-col">
                                     <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Case ID</span>
                                     <span className="text-[9px] font-black text-slate-900 uppercase">#{c.customCaseId || c.id.slice(0,8).toUpperCase()}</span>
                                  </div>
                                  <div className="flex flex-col text-right">
                                     <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Added On</span>
                                     <span className="text-[9px] font-black text-slate-900 uppercase">{c.date || 'Today'}</span>
                                  </div>
                               </div>
                            </div>
                         </div>

                         <div className="mt-8 space-y-3 relative z-10">
                            <div className="grid grid-cols-1 gap-3">
                               <Link href={`/clinician/work/${c.id}`} className="block">
                                  <Button 
                                    className={`w-full text-white text-[10px] font-black uppercase tracking-[0.2em] h-12 rounded-[4px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${
                                      c.status === 'Assigned' ? 'bg-slate-900 hover:bg-slate-800' :
                                      c.status === 'In Progress' ? 'bg-blue-600 hover:bg-blue-700' :
                                      'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                  >
                                    {c.status === 'Assigned' ? 'View Details' : 
                                     c.status === 'In Progress' ? 'Workspace' : 
                                     'View Solution'} <ArrowRight size={14} />
                                  </Button>
                                </Link>
                                
                                {c.status === 'Assigned' && (
                                   <Button 
                                     onClick={() => handleStartWork(c.id)} 
                                     disabled={processingId === c.id}
                                     className="w-full bg-white border-2 border-amber-500 text-amber-600 hover:bg-amber-50 text-[10px] font-black uppercase tracking-[0.2em] h-12 rounded-[4px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                                   >
                                     {processingId === c.id ? (
                                       <Loader2 className="animate-spin text-amber-600" size={16} />
                                     ) : (
                                       <><Play size={14} fill="currentColor" /> Start Work</>
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

            {/* Pagination */}
            {totalPages > 1 && (
               <div className="flex flex-col items-center gap-4 pt-12 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-12 w-12 rounded-[4px] bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all shadow-xl active:scale-95"
                    >
                       <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex items-center gap-2 px-4 h-12 bg-slate-50 border border-slate-200 rounded-[4px] shadow-inner">
                       {Array.from({ length: totalPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`h-8 w-8 shrink-0 rounded-[4px] text-[10px] font-black transition-all ${
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
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-12 w-12 rounded-[4px] bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white disabled:opacity-30 transition-all shadow-xl active:scale-95"
                    >
                       <ChevronRight size={20} />
                    </button>
                  </div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Page {currentPage} of {totalPages}
                 </p>
               </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Loader2({ size, className }: { size?: number, className?: string }) {
  return <Activity size={size} className={`animate-spin ${className}`} />;
}

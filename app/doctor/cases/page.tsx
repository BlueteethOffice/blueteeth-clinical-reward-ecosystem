'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Search, Filter, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight, Eye, Smartphone, Calendar, FileText, BadgeCheck, X, Award, ShieldCheck, Hash, Phone, FileImage, Info, ListTodo } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function CaseHistory() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
       const cached = localStorage.getItem('blueteeth_cases_cache');
       if (cached) {
          setCases(JSON.parse(cached));
          setLoading(false);
       }
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'cases'),
      where('doctorUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data();
        data.push({
          id: docSnap.id,
          ...item,
          rawDate: item.submittedAt?.toDate(),
          date: item.submittedAt?.toDate()?.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          }) || 'Recently'
        });
      });
      
      const sortedData = data.sort((a, b) => {
        const timeA = a.rawDate?.getTime() || 0;
        const timeB = b.rawDate?.getTime() || 0;
        return timeB - timeA;
      });

      setCases(sortedData);
      localStorage.setItem('blueteeth_cases_cache', JSON.stringify(sortedData));
      setLoading(false);
    }, (error) => {
      console.error("Clinical Sync Failure:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter]);

  // [UX OPTIMIZATION] Hard-Lock background scroll including HTML tag to prevent "chaining"
  useEffect(() => {
    if (selectedCase) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [selectedCase]);

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const isManualAdjustment = String(c.patientName || '').trim().toUpperCase() === "ADMIN MANUAL ADJUSTMENT";
      if (isManualAdjustment) return false;

      const matchesFilter = filter === 'All' || c.status === filter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        String(c.patientName || '').toLowerCase().includes(q) || 
        String(c.patientMobile || '').includes(q) ||
        String(c.treatment || '').toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [cases, filter, searchQuery]);

  const handleExport = () => {
    if (cases.length === 0) {
      toast.error("No clinical records to export.");
      return;
    }

    const headers = ["Patient Name", "Mobile", "Case ID", "Treatment", "Date", "Status", "B-Points", "Value (INR)"];
    const csvRows = cases.map(c => [
      c.patientName,
      c.patientMobile,
      c.id.toUpperCase(),
      c.treatmentName || c.treatment,
      c.date,
      c.status,
      Number(c.points) + Number(c.bonusPoints || 0),
      Math.round((Number(c.points) + Number(c.bonusPoints || 0)) * 50)
    ]);

    const csvContent = [headers, ...csvRows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Blueteeth_Clinical_Archive_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report Downloaded Successfully.");
  };

  const handleViewAttachment = (url: string) => {
    if (!url) return;

    if (url.startsWith('data:application/pdf')) {
      const toastId = toast.loading("Opening clinical PDF...");
      try {
        const base64Data = url.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        toast.success("Document opened.", { id: toastId });
      } catch (e) {
        toast.error("Format error. Opening raw link...", { id: toastId });
        window.open(url, '_blank');
      }
      return;
    }

    // [UX OPTIMIZATION] For images or regular URLs, use high-fidelity viewer
    const newTab = window.open();
    if (newTab) {
      newTab.document.write(`
        <html>
          <head>
            <title>Blueteeth Clinical Evidence | ${selectedCase?.patientName || 'Record'}</title>
            <style>
              body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; overflow: auto; font-family: sans-serif; }
              .container { text-align: center; width: 100%; padding: 20px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; }
              img { max-width: 100%; height: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
              .header { background: #1e293b; color: white; padding: 12px 24px; position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; z-index: 100; }
              .badge { background: #3b82f6; padding: 4px 12px; border-radius: 99px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            </style>
          </head>
          <body>
            <div class="header">
               <span style="font-weight: 900; font-size: 14px; letter-spacing: -0.5px;">Blueteeth Clinical Archive</span>
               <span class="badge">SECURE AUDIT VIEW</span>
            </div>
            <div class="container" style="margin-top: 60px;">
               <img src="${url}" alt="Attachment">
            </div>
          </body>
        </html>
      `);
      newTab.document.close();
    } else {
      window.open(url, '_blank');
    }
  };

  const totalPages = Math.ceil(filteredCases.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCases = filteredCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (!isMounted) return null;
  return (
    <DashboardLayout>
      <div className="max-w-[1600px] w-full mx-auto px-2 sm:px-6 lg:px-8 space-y-5 lg:space-y-8 pb-2 pt-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
          <div className="order-2 md:order-1 animate-in fade-in slide-in-from-left-2 duration-500">
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">Case History</h1>
            <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] mt-1.5">List of all your submitted cases</p>
          </div>
          <div className="order-1 md:order-2 flex gap-3 w-full md:w-auto">
            <Button 
               onClick={handleExport}
               className="flex-1 md:flex-none h-11 px-8 rounded-md bg-slate-900 hover:bg-slate-800 text-white shadow-2xl shadow-slate-200 gap-3 font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95 border-none"
            >
               <FileText size={16} /> Download Report
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="bg-white/40 backdrop-blur-md border-slate-100 shadow-2xl shadow-slate-200/20 rounded-xl overflow-hidden border-t-4 border-t-blue-600">
          <CardContent className="p-4 sm:p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <div className="h-10 w-10 bg-blue-500/10 rounded-md flex items-center justify-center text-blue-600 border border-blue-500/20 backdrop-blur-md">
                  <Filter size={18} />
               </div>
               <div className="flex flex-col">
                  <h3 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1 leading-none">Search & Filter</h3>
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-black text-slate-800 truncate max-w-[150px] sm:max-w-none">
                        {searchQuery ? `Searching: "${searchQuery}"` : 'All Cases'}
                     </span>
                     <div className="h-3 w-[1px] bg-slate-200 mx-2" />
                     <span className="text-[9px] font-black text-blue-600 bg-blue-500/10 px-3 py-1 rounded-md uppercase tracking-widest border border-blue-100 whitespace-nowrap">
                        {filter} Status
                     </span>
                  </div>
               </div>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center px-1">
              {['All', 'Approved', 'Pending', 'Rejected'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                    filter === f 
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30' 
                      : 'bg-white text-slate-600 border border-slate-100 hover:border-blue-400 hover:text-blue-600 hover:shadow-md'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table Ledger */}
        <Card className="border-slate-100 rounded-xl shadow-2xl shadow-slate-200/40 bg-white overflow-visible">
          {/* Mobile View - Professional Card Stack */}
          <div className="block lg:hidden divide-y divide-slate-100">
            {loading ? (
               [...Array(3)].map((_, i) => (
                  <div key={i} className="p-6 animate-pulse">
                     <div className="h-4 bg-slate-100 rounded w-1/2 mb-2"></div>
                     <div className="h-3 bg-slate-50 rounded w-1/4"></div>
                  </div>
               ))
            ) : paginatedCases.length > 0 ? (
               paginatedCases.map((c) => (
                  <div 
                     key={c.id} 
                     onClick={() => setSelectedCase(c)}
                     className="p-4 sm:p-5 active:bg-blue-50/50 transition-colors"
                  >
                     <div className="flex justify-between items-start mb-3">
                        <div>
                           <p className="text-[14px] font-black text-slate-900 uppercase tracking-tight leading-tight">{c.patientName}</p>
                           <p className="text-[9px] font-bold text-slate-600 mt-1 uppercase tracking-widest">REF-{(c.id || '').toUpperCase().slice(0, 8)} • {c.date}</p>
                        </div>
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                           c.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                           c.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'
                        }`}>{c.status}</span>
                     </div>
                     <div className="flex justify-between items-end">
                        <div className="text-[9px] font-black text-slate-700 uppercase tracking-tighter max-w-[60%] truncate">
                           {c.treatmentName || c.treatment}
                        </div>
                        <div className="text-right">
                           <span className="text-lg font-black text-slate-900 tracking-tighter">+{Number(c.points || 0).toFixed(1)}</span>
                           <span className="text-[7px] text-blue-500 font-bold ml-1 uppercase tracking-widest">Points</span>
                        </div>
                     </div>
                  </div>
               ))
            ) : (
               <div className="p-12 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest">No cases found in history</div>
            )}
          </div>

          {/* Desktop Audit Table */}
          <div className="hidden lg:block overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-700 border-b border-slate-100">
                  <th className="px-4 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap w-[22%]">Patient Name</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap w-[22%]">Treatment Details</th>
                  <th className="px-4 py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Points</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Status</th>
                  <th className="px-4 pr-10 py-5 text-right text-[10px] font-black uppercase tracking-[0.1em] whitespace-nowrap">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-8"><div className="h-4 bg-slate-50 rounded-md w-32 mb-2"></div><div className="h-2 bg-slate-50/50 rounded-md w-20"></div></td>
                      <td className="px-6 py-8"><div className="h-4 bg-slate-50 rounded-md w-24"></div></td>
                      <td className="px-6 py-8"><div className="h-6 bg-slate-50 rounded-xl w-16 mx-auto"></div></td>
                      <td className="px-6 py-8"><div className="h-11 bg-slate-50 rounded-xl w-24 mx-auto"></div></td>
                      <td className="px-6 py-8"></td>
                    </tr>
                   ))
                ) : paginatedCases.length > 0 ? (
                  paginatedCases.map((c, idx) => (
                      <motion.tr 
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group transition-all hover:bg-slate-50/70 border-b border-slate-50 last:border-0"
                        onClick={() => setSelectedCase(c)}
                      >
                      <td className="px-6 py-6">
                        <div className="flex flex-col gap-1.5">
                           <span className="text-[14px] font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate max-w-[150px] sm:max-w-none">{c.patientName}</span>
                           <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md"><Hash size={9} className="text-blue-500" /> REF-{(c.id || '').toUpperCase().slice(0, 8)}</span>
                              <span className="flex items-center gap-1 text-[9px]"><Smartphone size={9} className="text-indigo-400" /> {(c.patientMobile || '').slice(0, 3)}****{(c.patientMobile || '').slice(-3)}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-4 py-6">
                        <div className="flex flex-col">
                           <span className="font-extrabold text-slate-800 text-[13.5px] uppercase tracking-tight group-hover:text-blue-600 transition-colors">{c.treatmentName || c.treatment}</span>
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                             <Calendar size={11} className="text-slate-300" /> {c.date}
                           </span>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5 p-3 px-4 bg-blue-50/30 rounded-xl border border-blue-100 ring-1 ring-inset ring-blue-500/5">
                           <span className="text-sm font-black text-blue-700 tracking-tighter">+{Number(c.points || 0).toFixed(1)}</span>
                           <span className="text-[7.5px] font-black text-blue-400 uppercase tracking-widest leading-none">Points</span>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm ${
                           c.status === 'Approved' ? 'bg-emerald-50/30 border-emerald-100 text-emerald-600' :
                           c.status === 'Pending' ? 'bg-amber-50/30 border-amber-100 text-amber-600' : 'bg-red-50/30 border-red-100 text-red-600'
                        }`}>
                           <div className={`h-1.5 w-1.5 rounded-full ${c.status === 'Approved' ? 'bg-emerald-500 animate-pulse' : c.status === 'Pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
                           <span className="text-[9px] font-black tracking-[0.2em] uppercase">{c.status}</span>
                        </div>
                      </td>
                      <td className="px-4 pr-10 py-6 text-right">
                        <button 
                           onClick={(e) => { e.stopPropagation(); setSelectedCase(c); }}
                           className="h-10 w-9 rounded-md bg-white border border-slate-100 text-slate-700 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all flex items-center justify-center active:scale-95 hover:bg-blue-50 ml-auto"
                        >
                           <Eye className="h-5 w-5" />
                        </button>
                      </td>
                      </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-32 text-center">
                      <div className="flex flex-col items-center">
                         <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100 shadow-inner text-slate-300">
                           <ListTodo size={32} />
                         </div>
                         <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">No Cases Found in Registry</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="p-4 sm:p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest sm:tracking-[0.2em] flex-1 text-center sm:text-left">
                Node {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredCases.length)} <span className="mx-1 sm:mx-2 text-slate-200">|</span> Archive Count: {filteredCases.length}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                   onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                   disabled={currentPage === 1}
                   className="h-10 px-5 rounded-md font-black text-[9px] uppercase tracking-widest disabled:opacity-30 border-slate-200 bg-white shadow-sm text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Prev
                </Button>
                
                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button 
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-10 w-9 rounded-md font-black text-[9px] transition-all ${
                          currentPage === pageNum 
                            ? 'bg-slate-900 text-white shadow-xl translate-y-[-2px]' 
                            : 'bg-white text-slate-600 border border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <Button 
                   disabled={currentPage === totalPages || totalPages === 0}
                   onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                   className="h-10 px-5 rounded-md bg-slate-900 border-none font-black text-[9px] uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all text-white shadow-xl shadow-slate-200"
                >
                  Next Node
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Case Details Modal */}
        <AnimatePresence>
          {selectedCase && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-6 pointer-events-none">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedCase(null)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
              />
              
              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                className="pointer-events-auto relative w-full h-auto max-h-[96vh] sm:max-h-none sm:h-auto max-w-none sm:max-w-[550px] bg-white rounded-xl shadow-2xl flex flex-col border border-slate-100 sm:border-slate-100 overflow-hidden"
              >
                {/* Modal Header - Premium Slate Look */}
                <div className="p-4 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 bg-white/10 rounded-md flex items-center justify-center text-white border border-white/10 shadow-inner">
                      <FileText size={18} className="sm:size-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-white uppercase tracking-[0.2em] text-[9px] sm:text-[10px] leading-none mb-1">Case Details Summary</h3>
                      <p className="text-[9px] sm:text-[10px] font-black text-white tracking-tighter uppercase flex items-center gap-2">
                        <ShieldCheck size={10} className="text-blue-400" /> Case ID: {(selectedCase.id || '').toUpperCase().slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90 text-white/50 hover:text-white border border-white/10 relative z-10"
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>

                {/* Modal Body - Condensed & Sharp */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-5 space-y-6 sm:space-y-5 no-scrollbar bg-slate-50/20">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                     <div className="space-y-1 sm:space-y-1">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest px-0.5">Patient Name</p>
                        <p className="text-slate-900 font-extrabold text-sm sm:text-base tracking-tight leading-none bg-white p-3 sm:p-3 rounded-md border border-slate-200 shadow-sm">{selectedCase.patientName}</p>
                     </div>
                     <div className="space-y-1 sm:space-y-1">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest px-0.5">Mobile Number</p>
                        <p className="text-slate-700 font-bold text-xs sm:text-sm bg-white p-3 sm:p-3 rounded-md border border-slate-200 shadow-sm flex items-center gap-3">
                           <Phone size={12} className="text-blue-500" /> {selectedCase.patientMobile || 'Not Masked'}
                        </p>
                     </div>
                     <div className="space-y-1 sm:space-y-1">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest px-0.5">Submission Date</p>
                        <p className="text-slate-600 font-bold text-[10px] sm:text-xs bg-white p-3 sm:p-3 rounded-md border border-slate-200 shadow-sm flex items-center gap-3">
                           <Calendar size={12} className="text-indigo-400" /> {selectedCase.date}
                        </p>
                     </div>
                  </div>

                  <div className="p-4 sm:p-5 bg-white rounded-md border border-slate-200 shadow-sm space-y-5 sm:space-y-4">
                     <div className="flex flex-col sm:flex-row justify-between gap-5 sm:gap-4">
                        <div className="flex flex-col gap-1.5">
                           <span className="font-black text-slate-600 uppercase tracking-widest text-[8px]">Treatment Selection</span>
                           <span className="font-black text-slate-900 text-[11px] sm:text-[11px] py-1.5 px-3 rounded-md bg-slate-50 border border-slate-100 inline-block w-fit">
                              {selectedCase.treatmentName || selectedCase.treatment}
                           </span>
                        </div>
                        <div className="flex flex-col gap-1.5 sm:items-end">
                           <span className="font-black text-blue-500 uppercase tracking-widest text-[8px]">Total Case Points</span>
                           <span className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tighter leading-none">
                              +{Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)} <span className="text-[10px] uppercase">B-Pts</span>
                           </span>
                        </div>
                     </div>
                     
                     <div className="flex justify-between items-center bg-slate-950 p-4 sm:p-4 rounded-md">
                        <div className="flex flex-col">
                           <span className="font-black text-white/80 uppercase tracking-[0.2em] text-[7px] sm:text-[8px]">Cash Value</span>
                           <span className="text-[8px] sm:text-[9px] text-blue-400 font-bold italic">Status: {selectedCase.status}</span>
                        </div>
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter">₹{Math.round((Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)) * 50).toLocaleString()}</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                     <div className="space-y-1 sm:space-y-1.5">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">Case Photo / PDF Proof</p>
                        {selectedCase.evidenceUrl ? (
                          <button 
                            onClick={() => handleViewAttachment(selectedCase.evidenceUrl)}
                            className="flex items-center gap-4 p-3 sm:p-3 w-full bg-slate-50 text-slate-900 rounded-md border border-slate-200 hover:bg-slate-900 hover:text-white transition-all group active:scale-95"
                          >
                             <div className="h-8 w-8 bg-slate-900 rounded-md flex items-center justify-center text-white group-hover:bg-white group-hover:text-slate-900 transition-colors">
                               {(selectedCase.evidenceUrl.toLowerCase().includes('.pdf') || selectedCase.evidenceUrl.includes('application/pdf')) ? <FileText size={16} /> : <FileImage size={16} />}
                             </div>
                             <span className="font-black text-[9px] sm:text-[10px] uppercase tracking-widest">View Archive</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 p-3 bg-slate-50 text-slate-600 rounded-md border border-slate-200 border-dashed">
                             <Info size={16} />
                             <span className="font-black text-[9px] uppercase tracking-widest">No Evidence attached</span>
                          </div>
                        )}
                     </div>
                     
                     <div className="space-y-1 sm:space-y-1.5">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">Doctor's Notes</p>
                        <div className="bg-white rounded-md p-3 text-[11px] sm:text-[11px] text-slate-600 font-medium border border-slate-200 italic leading-snug min-h-[60px] sm:min-h-[70px]">
                           {selectedCase.notes || "Case submitted normally."}
                        </div>
                     </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 sm:p-4 shrink-0 bg-slate-50 border-t border-slate-200">
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="w-full h-12 sm:h-12 rounded-md bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg"
                  >
                    Close Details
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

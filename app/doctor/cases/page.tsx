'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Search, Filter, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight, Eye, Smartphone, Calendar, FileText, BadgeCheck, X, Award, ShieldCheck } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
// Removed fetchAllDoctorCases import as we use direct onSnapshot for real-time reactivity

export default function CaseHistory() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  React.useEffect(() => {
    if (!user?.uid) return;

    // High-reliability polling strategy for clinical environments
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
      setLoading(false);
    }, (error) => {
      console.error("Clinical Sync Failure:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter]);

  const filteredCases = cases.filter(c => {
    // Audit Registry Protocol: Excising legacy system logs from clinical chronology
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

  const totalPages = Math.ceil(filteredCases.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCases = filteredCases.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Clinical Repository</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Unified clinical record management and audit trails.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button className="flex-1 md:flex-none h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200 gap-2 font-bold text-[11px] uppercase tracking-wider transition-all active:scale-95">
               <FileText size={16} /> Export Records
            </Button>
          </div>
        </div>

        {/* Filters & Information (Elite Glass Control) */}
        <Card className="bg-white border-slate-100 shadow-xl shadow-slate-200/40 rounded-2xl overflow-hidden">
          <CardContent className="p-8 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-5">
               <div className="h-11 w-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                  <Filter size={20} />
               </div>
               <div className="flex flex-col">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Observation Query</h3>
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-black text-slate-900">
                        {searchQuery ? `Searching: "${searchQuery}"` : 'All Clinical Nodes'}
                     </span>
                     <div className="h-4 w-[1px] bg-slate-200 mx-2" />
                     <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase tracking-widest">
                        {filter} Status
                     </span>
                  </div>
               </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar w-full md:w-auto justify-center">
              {['All', 'Approved', 'Pending', 'Rejected'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    filter === f 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'bg-white text-slate-500 border border-slate-100 hover:border-blue-400 hover:text-blue-600 hover:shadow-md'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clinical Ledger Table */}
        <Card className="overflow-hidden border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/50 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100">
                  <th className="px-10 py-5 text-left text-[10px] font-black uppercase tracking-[0.15em]">Clinical Case ID</th>
                  <th className="px-10 py-5 text-left text-[10px] font-black uppercase tracking-[0.15em]">Treatment Node</th>
                  <th className="px-10 py-5 text-center text-[10px] font-black uppercase tracking-[0.15em]">Yield</th>
                  <th className="px-10 py-5 text-center text-[10px] font-black uppercase tracking-[0.15em]">Sync Status</th>
                  <th className="px-10 py-5 text-right text-[10px] font-black uppercase tracking-[0.15em]">Vault</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-10 py-6"><div className="h-4 bg-slate-100 rounded-lg w-32 mb-2"></div><div className="h-3 bg-slate-50 rounded-lg w-20"></div></td>
                      <td className="px-10 py-6"><div className="h-4 bg-slate-100 rounded-lg w-24"></div></td>
                      <td className="px-10 py-6"><div className="h-6 bg-slate-100 rounded-xl w-16 mx-auto"></div></td>
                      <td className="px-10 py-6"><div className="h-11 bg-slate-100 rounded-xl w-24 mx-auto"></div></td>
                      <td className="px-10 py-6"></td>
                    </tr>
                   ))
                ) : paginatedCases.length > 0 ? (
                  paginatedCases.map((c, idx) => (
                      <motion.tr 
                        key={c.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`transition-all duration-300 group cursor-default ${
                          c.patientName === "ADMIN MANUAL ADJUSTMENT" ? 'bg-blue-50/50 hover:bg-blue-100/50' : 'hover:bg-blue-50/40'
                        }`}
                      >
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                           <span className="text-[15px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{c.patientName}</span>
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                              <span className="h-3 w-3 bg-slate-100 rounded-md flex items-center justify-center text-[8px] text-slate-400">ID</span> 
                              #{c.id.slice(-6).toUpperCase()}
                           </span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                           <span className="text-[13px] font-black text-slate-700">{c.treatment}</span>
                           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{c.date}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className="inline-flex flex-col items-center rounded-xl bg-blue-50 px-3 py-1.5 border border-blue-100">
                           <span className="text-[11px] font-black text-blue-700">
                             +{Number(c.points).toFixed(1)}
                             {c.bonusPoints > 0 && <span className="text-emerald-500 ml-1"> (+{Number(c.bonusPoints).toFixed(1)})</span>}
                           </span>
                           <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">B-PTS</span>
                        </span>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border mx-auto ${
                           c.status === 'Approved' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-600' : 
                           c.status === 'Pending' ? 'bg-amber-50/50 border-amber-100 text-amber-600' : 'bg-rose-50 border-rose-100 text-rose-600'
                        }`}>
                           <div className={`h-1.5 w-1.5 rounded-full ${
                             c.status === 'Approved' ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20 shadow-[0_0_8px_#10b981]' : 
                             c.status === 'Pending' ? 'bg-amber-400 ring-4 ring-amber-400/20' : 'bg-rose-500'
                           }`} />
                           <span className="text-[10px] font-black tracking-widest uppercase">{c.status}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button 
                           onClick={() => setSelectedCase(c)}
                           className="h-11 w-10 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all flex items-center justify-center active:scale-90 group-hover:scale-110"
                        >
                           <Eye className="h-5 w-5" />
                        </button>
                      </td>
                      </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-10 py-32 text-center bg-slate-50/5">
                      <div className="flex flex-col items-center">
                         <div className="h-20 w-20 bg-white shadow-xl rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                            <Search className="h-11 w-8 text-slate-200" />
                         </div>
                         <h4 className="text-slate-900 font-black text-lg">No clinical nodes mapped</h4>
                         <p className="text-slate-400 font-medium text-sm mt-1">Your case submissions will sync here in real-time.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Elite Pagination (Matched Style) */}
          {totalPages > 1 && (
            <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex-1">
                Node {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredCases.length)} <span className="mx-2 text-slate-200">|</span> Aggregate: {filteredCases.length}
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="h-11 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-30 border-slate-200 bg-white"
                >
                  Previous
                </Button>
                
                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button 
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-11 w-10 rounded-xl font-black text-[10px] transition-all ${
                          currentPage === pageNum 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                            : 'bg-white text-slate-400 border border-slate-100 hover:border-blue-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <Button 
                  variant="outline"
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="h-11 px-4 rounded-xl bg-white border border-slate-200 font-black text-[10px] uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all text-slate-600 hover:bg-slate-50"
                >
                  Next Page
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Case Details Modal (High-Fidelity) - Moved Inside Layout */}
        {selectedCase && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               onClick={() => setSelectedCase(null)}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
               <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                  <div className="flex items-center gap-4">
                     <div className="h-11 w-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-600 shadow-lg shadow-blue-500/10 border border-blue-100">
                       <FileText size={22} className="stroke-[2.5]" />
                     </div>
                     <div>
                        <h3 className="font-black text-blue-800 leading-none text-xl tracking-tight">Case Dossier</h3>
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-[10px] text-blue-600 font-black bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
                              Active Node
                           </span>
                           <span className="text-[10px] text-slate-400 font-bold tracking-widest">#{selectedCase.id.slice(0,12).toUpperCase()}</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                     <BadgeCheck size={14} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                  </div>
               </div>
               
               <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                     <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Patient Record</p>
                        <p className="text-slate-900 font-black text-sm truncate">{selectedCase.patientName}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Clinical Link</p>
                        <p className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
                           <Smartphone size={10} className="text-blue-500" /> {selectedCase.patientMobile}
                        </p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Protocol</p>
                        <p className="text-blue-600 font-black text-xs truncate bg-blue-50/50 px-2 py-0.5 rounded-md border border-blue-100/50 inline-block">
                           {selectedCase.treatment}
                        </p>
                     </div>
                     <div className="space-y-1 text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sync Time</p>
                        <p className="text-slate-700 font-bold text-xs truncate">{selectedCase.date}</p>
                     </div>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="p-6 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Protocol Integrity Details</p>
                         <div className="flex justify-between items-center py-2 border-b border-white">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Base Treatment Yield</span>
                            <span className="text-[10px] font-black text-slate-900 leading-none">+{Number(selectedCase.points).toFixed(1)} B-PTS</span>
                         </div>
                         <div className="flex justify-between items-center py-2 border-b border-white">
                            <div className="flex flex-col">
                               <span className={`text-[9px] font-bold uppercase leading-none ${(selectedCase.bonusPoints > 0) ? 'text-emerald-500' : 'text-slate-400'}`}>Admin Clinical Bonus</span>
                               <span className="text-[7px] font-black text-slate-400 uppercase mt-1 italic">{selectedCase.bonusPoints > 0 ? (selectedCase.bonusReason || "Clinical Performance Bonus") : "No administrative adjustment"}</span>
                            </div>
                            <span className={`text-[11px] font-black px-3 py-1 rounded-lg ${(selectedCase.bonusPoints > 0) ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'}`}>+{(selectedCase.bonusPoints || 0).toFixed(1)} B-PTS</span>
                         </div>
                         <div className="flex justify-between items-center pt-2">
                            <span className="text-[9px] font-black text-blue-600 uppercase">Settled Clinical Wealth</span>
                            <span className="text-[11px] font-black text-blue-600">₹{Math.round((Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)) * 50).toLocaleString()}</span>
                         </div>
                      </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Practitioner Observations</p>
                     <div className="bg-slate-50/40 rounded-lg p-2.5 text-[10px] text-slate-700 font-medium border border-slate-100 italic leading-snug">
                        {selectedCase.notes || "Standard clinical record successfully synchronized & verified by audit team."}
                     </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gradient-to-br from-blue-600 via-indigo-800 to-blue-900 rounded-xl text-white shadow-xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-8 bg-white/5 rounded-full blur-3xl" />
                     <div className="flex flex-col gap-1 relative z-10">
                        <p className="text-[7px] font-black text-blue-200 uppercase tracking-widest leading-none">Network Resolution Status</p>
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border mt-1 ${
                           selectedCase.status === 'Approved' ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' : 
                           selectedCase.status === 'Pending' ? 'bg-amber-500/20 border-amber-400/30 text-amber-300' : 'bg-rose-500/20 border-rose-400/30 text-rose-300'
                        }`}>
                           <div className={`h-1 w-1 rounded-full ${
                             selectedCase.status === 'Approved' ? 'bg-emerald-400 animate-pulse' : 
                             selectedCase.status === 'Pending' ? 'bg-amber-400' : 'bg-rose-400'
                           }`} />
                           <span className="text-[9px] font-black tracking-[0.2em] uppercase">{selectedCase.status}</span>
                        </div>
                     </div>
                     <div className="text-right relative z-10">
                        <p className="text-[7px] font-black text-blue-200 uppercase tracking-widest mb-1">Total Clinical Yield</p>
                         <div className="flex items-baseline justify-end gap-1">
                            <span className="text-3xl font-black tracking-tighter">+{ (Number(selectedCase.points) + Number(selectedCase.bonusPoints || 0)).toFixed(1) }</span>
                            <span className="text-[8px] font-black text-blue-300 uppercase tracking-widest">B-PTS</span>
                         </div>
                     </div>
                  </div>
               </div>
               
               <div className="p-3 bg-slate-50 border-t border-slate-100">
                  <Button 
                    onClick={() => setSelectedCase(null)} 
                    className="w-full bg-blue-600 hover:bg-blue-600 rounded-lg font-black uppercase tracking-[0.2em] text-[10px] h-11 transition-all active:scale-[0.98] shadow-lg text-white"
                  >
                     Dismiss Review
                  </Button>
               </div>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

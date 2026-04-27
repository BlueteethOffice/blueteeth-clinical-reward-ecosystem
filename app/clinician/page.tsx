'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Clock, CheckCircle2, TrendingUp, Activity, ShieldCheck, 
  Wifi, WifiOff, ChevronLeft, ChevronRight, X, User, Phone, 
  Calendar, Hash, Banknote, ArrowRight, FileText, ClipboardList, ListTodo,
  Eye, MapPin, Image as ImageIcon, ExternalLink, FileCheck, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function ClinicianDashboard() {
  const { user, userData } = useAuth();
  const [dbStats, setDbStats] = React.useState({ 
    assigned: 0, 
    inProgress: 0, 
    completed: 0, 
    totalEarnings: 0 
  });
  const [cases, setCases] = React.useState<any[]>([]);
  const [selfSubmittedCases, setSelfSubmittedCases] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = React.useState(true);
  const [isMounted, setIsMounted] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<'Testing' | 'Connected' | 'Disconnected'>('Testing');
  const [currentPage, setCurrentPage] = React.useState(0);
  const [currentAssignedPage, setCurrentAssignedPage] = React.useState(0);
  const [selectedCase, setSelectedCase] = React.useState<any>(null);
  const itemsPerPage = 4;
  const assignedItemsPerPage = 5;

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Helper to optimize cache size
  const getEssentialData = (caseList: any[]) => {
    return caseList.slice(0, 20).map(c => ({
      id: c.id,
      patientName: c.patientName,
      status: c.status,
      customCaseId: c.customCaseId,
      treatmentName: c.treatmentName,
      treatment: c.treatment,
      date: c.date,
      clinicianFee: c.clinicianFee,
      submittedAt: c.submittedAt
    }));
  };

  // Effect 0: Initial Cache Load
  React.useEffect(() => {
    if (typeof window !== 'undefined' && user?.uid) {
      const cachedCases = localStorage.getItem(`clinician_cases_${user.uid}`);
      if (cachedCases) {
        try {
          const parsed = JSON.parse(cachedCases);
          setCases(parsed);
          setLoading(false);
        } catch (e) { console.error("Cache load error", e); }
      }

      const cachedSubmissions = localStorage.getItem(`clinician_submissions_${user.uid}`);
      if (cachedSubmissions) {
        try {
          const parsed = JSON.parse(cachedSubmissions);
          setSelfSubmittedCases(parsed);
          setLoadingSubmissions(false);
        } catch (e) { console.error("Cache load error", e); }
      }
    }
  }, [user?.uid]);

  // Effect 1: Fetch Assigned Work
  React.useEffect(() => {
    if (!user?.uid || !db) {
      if (!db) setConnectionStatus('Disconnected');
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'cases'), where('clinicianId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConnectionStatus('Connected');
      const allCases: any[] = [];
      let counts = { assigned: 0, inProgress: 0, completed: 0, earnings: 0 };

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const caseItem = {
          id: docSnap.id,
          ...data,
          date: data.submittedAt?.toDate()?.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
          }) || 'Recently'
        };
        allCases.push(caseItem);

        if (data.status === 'Assigned') counts.assigned++;
        else if (data.status === 'In Progress') counts.inProgress++;
        else if (data.status === 'Approved' || data.status === 'Submitted') {
            if (data.status === 'Approved') {
                counts.completed++;
                counts.earnings += (Number(data.clinicianFee) || 0);
            }
        }
      });

      const sortedCases = allCases.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      setCases(sortedCases);
      setDbStats({
        assigned: counts.assigned,
        inProgress: counts.inProgress,
        completed: counts.completed,
        totalEarnings: counts.earnings
      });
      
      if (typeof window !== 'undefined' && user?.uid) {
        try {
          localStorage.setItem(`clinician_cases_${user.uid}`, JSON.stringify(getEssentialData(sortedCases)));
        } catch (e) {
          localStorage.removeItem(`clinician_cases_${user.uid}`);
        }
      }
      
      setLoading(false);
    }, (err) => {
      setConnectionStatus('Disconnected');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Effect 2: Fetch Self-Submitted Cases
  React.useEffect(() => {
    if (!user?.uid || !db) return;

    setLoadingSubmissions(true);
    const q = query(collection(db, 'cases'), where('doctorUid', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const submissions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().submittedAt?.toDate()?.toLocaleDateString() || 'Recently'
      }));

      const sorted = (submissions as any[]).sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      setSelfSubmittedCases(sorted);
      
      if (typeof window !== 'undefined' && user?.uid) {
        try {
          localStorage.setItem(`clinician_submissions_${user.uid}`, JSON.stringify(getEssentialData(sorted)));
        } catch (e) {
          localStorage.removeItem(`clinician_submissions_${user.uid}`);
        }
      }
      
      setLoadingSubmissions(false);
    });

    return () => unsubscribe();
  }, [user]);

  const stats = [
    { name: 'Assigned Cases', value: dbStats.assigned.toString(), icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', gradient: 'from-amber-200 via-amber-100 to-amber-200' },
    { name: 'In Progress', value: dbStats.inProgress.toString(), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-200 via-blue-100 to-blue-200' },
    { name: 'Completed', value: dbStats.completed.toString(), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-200 via-emerald-100 to-emerald-200' },
    { name: 'Total Earnings', value: `₹${dbStats.totalEarnings.toLocaleString()}`, icon: Banknote, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', gradient: 'from-indigo-200 via-indigo-100 to-indigo-200' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-3 pt-4 pb-2" suppressHydrationWarning>
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 px-2 sm:px-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 text-[8px] font-black uppercase tracking-[0.2em] text-blue-400 border border-slate-800">
               <Activity size={10} className="animate-pulse" /> Clinical Protocol Active
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                {!isMounted ? 'Doctor' : (userData?.name ? (userData.name.toLowerCase().startsWith('dr.') ? userData.name : `Dr. ${userData.name}`) : 'Doctor')}
              </span>
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">Console</p>
               {isMounted && userData?.regNo && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[8px] font-black text-blue-600 uppercase tracking-wider">
                   ID: {userData.regNo}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
             <Link href="/clinician/submit-case" className="w-full sm:w-auto">
                <Button className="w-full h-12 px-8 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[4px] shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 group">
                   <FileText size={16} className="group-hover:text-blue-400" /> New Case Node
                </Button>
             </Link>
             <Link href="/clinician/cases?status=Assigned" className="w-full sm:w-auto">
                <Button className="w-full h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[4px] shadow-2xl shadow-blue-500/20 transition-all hover:-translate-y-1 flex items-center justify-center gap-3">
                   Full History <ArrowRight className="h-4 w-4" />
                </Button>
             </Link>
          </div>
        </div>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 px-2 sm:px-0">
          {stats.map((item, idx) => (
            <div key={item.name} className={`p-[1px] rounded-[4px] bg-gradient-to-br ${item.gradient} shadow-2xl shadow-slate-200/50 group overflow-hidden`}>
               <Card className="h-full bg-white p-4 sm:p-6 rounded-[11px] border-none relative overflow-hidden group-hover:bg-slate-50 transition-colors">
                 <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                   <div className={`h-10 w-10 sm:h-14 sm:w-14 rounded-[4px] flex items-center justify-center ${item.bg} group-hover:scale-110 transition-transform shadow-inner shrink-0`}><item.icon className={`h-5 w-5 sm:h-7 sm:w-7 ${item.color}`} /></div>
                   <div className="min-w-0">
                     <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{item.name}</p>
                     <h3 className="text-base sm:text-2xl font-black text-slate-900 tracking-tighter truncate">{item.value}</h3>
                   </div>
                 </div>
               </Card>
            </div>
          ))}
        </div>

        {/* SECTION: My Patient Registry */}
         <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 sm:px-0">
             <div className="flex items-center gap-3">
               <div className="h-9 w-9 bg-slate-900 rounded-[4px] flex items-center justify-center text-blue-400 shadow-xl"><User size={18} /></div>
              <div>
                 <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Self-Submitted Records</h2>
                 <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Direct Referrals</p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <div className="hidden sm:flex items-center gap-2 bg-white border border-slate-100 p-1 rounded-[4px] shadow-sm">
                <Button variant="ghost" size="sm" className="h-7 w-7 rounded-[4px] text-slate-400 disabled:opacity-20" onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))} disabled={currentPage === 0}>
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-[8px] font-black text-slate-900 w-8 text-center">{currentPage + 1}/{Math.ceil(selfSubmittedCases.length / itemsPerPage) || 1}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 rounded-[4px] text-slate-400 disabled:opacity-20" onClick={() => setCurrentPage(prev => Math.min(Math.ceil(selfSubmittedCases.length / itemsPerPage) - 1, prev + 1))} disabled={currentPage >= Math.ceil(selfSubmittedCases.length / itemsPerPage) - 1}>
                  <ChevronRight size={14} />
                </Button>
              </div>
              <Link href="/clinician/my-cases" className="w-full sm:w-auto">
                <Button className="h-9 px-4 w-full sm:w-auto bg-white border border-slate-200 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 rounded-[4px] flex items-center justify-center gap-2">History <ListTodo size={12} /></Button>
              </Link>
            </div>
          </div>

          <div className="relative">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2 sm:px-0">
                {loadingSubmissions && selfSubmittedCases.length === 0 ? (
                  [...Array(4)].map((_, i) => <div key={i} className="h-44 bg-white rounded-[4px] border border-slate-100 p-5 space-y-4 shadow-sm animate-pulse" />)
                ) : selfSubmittedCases.length === 0 ? (
                  <div className="col-span-full py-16 bg-slate-50/50 rounded-[4px] border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-4">
                     <div className="h-12 w-12 bg-white rounded-[4px] flex items-center justify-center text-slate-300 shadow-inner"><Activity size={24} /></div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry awaiting data sync...</p>
                  </div>
                ) : (
                  selfSubmittedCases.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage).map((c) => (
                    <motion.div key={c.id} whileHover={{ y: -5 }} className="p-[1px] rounded-[4px] bg-gradient-to-br from-slate-200 to-slate-300 hover:from-blue-500 hover:to-indigo-600 shadow-xl transition-all duration-500 group cursor-pointer" onClick={() => setSelectedCase(c)}>
                        <Card className="h-full p-5 bg-white border-none rounded-[11px] relative overflow-hidden group-hover:bg-slate-50 transition-colors">
                           <div className="relative z-10 space-y-4">
                              <div className="flex justify-between items-start">
                                 <div className="h-9 w-9 bg-slate-900 rounded-[4px] flex items-center justify-center text-white font-black text-[11px] group-hover:scale-110 transition-transform">{c.patientName.charAt(0).toUpperCase()}</div>
                                 <div className="flex flex-col gap-1 items-end">
                                    <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border shadow-sm ${c.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>{c.status}</span>
                                    {c.doctorUid === user?.uid && (
                                       <span className="px-2 py-1 bg-indigo-600 text-white rounded-[4px] text-[8px] font-black uppercase tracking-widest shadow-md whitespace-nowrap">SELF CASE</span>
                                    )}
                                 </div>
                              </div>
                              <div>
                                 <div className="flex items-center justify-between gap-3">
                                    <p className="font-black text-slate-900 text-sm uppercase tracking-tight line-clamp-1 grow">{c.patientName}</p>
                                    <span className="shrink-0 text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">#{c.customCaseId || c.id.slice(0, 6)}</span>
                                 </div>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 line-clamp-1">{c.treatmentName || c.treatment}</p>
                              </div>
                              <div className="flex justify-between items-end pt-3 border-t border-slate-50">
                                 <span className="text-[8px] font-black text-slate-300 uppercase">{c.date}</span>
                                 <div className="text-right">
                                    <span className="text-xs font-black text-slate-900 block">₹{c.clinicianFee || 0}</span>
                                    <span className="text-[7px] font-black text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">View Summary</span>
                                 </div>
                              </div>
                           </div>
                        </Card>
                    </motion.div>
                  ))
                )}
             </div>
          </div>
        </div>

        {/* Assignment Ledger */}
        <div className="space-y-4 px-1 sm:px-0">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-slate-900 rounded-[4px] flex items-center justify-center text-white shadow-xl"><ListTodo size={18} /></div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Assignment Ledger</h2>
            </div>
          </div>

          <div className="bg-white rounded-[4px] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                    <tr className="bg-slate-900 border-b border-slate-800">
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest">Patient Name</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest text-center">Status Badge</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest">Settlement ₹</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest">Treatment ₹</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest text-right">Details</th>
                    </tr>
                  </thead>
                 <tbody className="divide-y divide-slate-100">
                   {loading && cases.length === 0 ? (
                     [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={5} className="h-24 bg-slate-50/30"></td></tr>)
                   ) : cases.length === 0 ? (
                     <tr><td colSpan={5} className="py-24 text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry Node Empty</p></td></tr>
                   ) : (
                      cases.slice(currentAssignedPage * assignedItemsPerPage, (currentAssignedPage + 1) * assignedItemsPerPage).map((c) => (
                       <tr key={c.id} className="hover:bg-slate-50 transition-all group cursor-pointer" onClick={() => setSelectedCase(c)}>
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-5">
                               <div className="h-11 w-11 bg-slate-900 rounded-[4px] flex items-center justify-center text-blue-400 font-black text-sm shadow-xl group-hover:scale-110 transition-transform">{c.patientName.charAt(0).toUpperCase()}</div>
                               <div>
                                  <p className="font-black text-slate-900 text-base leading-tight uppercase group-hover:text-blue-600 transition-colors">{c.patientName}</p>
                                  <div className="flex items-center gap-3 mt-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                     <span>ID: {c.customCaseId || c.id.slice(0, 8).toUpperCase()}</span>
                                     <span className="h-1 w-1 rounded-[4px] bg-slate-200" />
                                     <span>{c.treatmentName || c.treatment}</span>
                                  </div>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-center">
                            <div className="flex flex-col items-center gap-1">
                               <span className={`inline-flex px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                                 c.status === 'Assigned' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                                 c.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-200 animate-pulse' :
                                 'bg-emerald-50 text-emerald-600 border-emerald-200'
                               }`}>{c.status}</span>
                               {c.doctorUid === user?.uid && (
                                  <span className="px-3 py-1 bg-indigo-600 text-white rounded-[4px] text-[9px] font-black uppercase tracking-widest shadow-lg whitespace-nowrap">SELF CASE</span>
                               )}
                            </div>
                         </td>
                          <td className="px-8 py-6"><span className="text-lg font-black text-slate-900 tracking-tighter">₹{c.clinicianFee?.toLocaleString() || '0'}</span></td>
                          <td className="px-8 py-6"><span className="text-lg font-black text-emerald-600 tracking-tighter">₹{Number(c.treatmentCharge || 0).toLocaleString()}</span></td>
                         <td className="px-8 py-6 text-right">
                            <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 flex items-center gap-2 justify-end w-full">Manifest <Eye size={14}/></button>
                         </td>
                       </tr>
                      ))
                   )}
                 </tbody>
               </table>
             </div>
             
             {/* Pagination Footer */}
             <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total <span className="text-blue-400">{cases.length}</span> Records</p>
                <div className="flex items-center gap-3">
                   <Button variant="outline" className="h-9 w-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-20 rounded-lg" onClick={() => setCurrentAssignedPage(prev => Math.max(0, prev - 1))} disabled={currentAssignedPage === 0}><ChevronLeft size={16} /></Button>
                   <div className="h-9 px-4 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-black text-blue-400">{currentAssignedPage + 1} / {Math.ceil(cases.length / assignedItemsPerPage) || 1}</div>
                   <Button variant="outline" className="h-9 w-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-20 rounded-lg" onClick={() => setCurrentAssignedPage(prev => Math.min(Math.ceil(cases.length / assignedItemsPerPage) - 1, prev + 1))} disabled={currentAssignedPage >= Math.ceil(cases.length / assignedItemsPerPage) - 1}><ChevronRight size={16} /></Button>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
         {selectedCase && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setSelectedCase(null)} />
             <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white w-full max-w-lg rounded-[4px] shadow-3xl overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
               <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 bg-blue-600 rounded-[4px] flex items-center justify-center shadow-lg"><FileCheck size={20} /></div>
                     <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Case Node Dossier</h3>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest opacity-80">ID: #{selectedCase.customCaseId || selectedCase.id.slice(-8)}</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedCase(null)} className="h-8 w-8 rounded-[4px] bg-white/10 hover:bg-red-500 flex items-center justify-center transition-all group"><X size={18} className="text-white" /></button>
               </div>

               <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                  {/* Status & Action */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-[4px] border border-slate-100">
                     <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Status</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${selectedCase.status === 'Approved' ? 'text-emerald-600' : 'text-amber-600'}`}>{selectedCase.status}</span>
                     </div>
                     {(selectedCase.status === 'Assigned' || selectedCase.status === 'In Progress') && selectedCase.clinicianId === user?.uid && (
                        <Link href={`/clinician/work/${selectedCase.id}`}>
                           <Button className="h-9 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest px-4 rounded-[4px] shadow-lg shadow-blue-500/20">Open Workspace <ArrowRight size={12} className="ml-2"/></Button>
                        </Link>
                     )}
                  </div>

                  {/* Information Grid */}
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-3">
                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5"><User size={10} className="text-blue-500" /> Patient Name</p><p className="text-sm font-black text-slate-900 uppercase">{selectedCase.patientName}</p></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5"><Activity size={10} className="text-blue-500" /> Treatment</p><p className="text-sm font-black text-slate-900 uppercase">{selectedCase.treatment || selectedCase.treatmentName}</p></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5"><Banknote size={10} className="text-emerald-500" /> Charge</p><p className="text-sm font-black text-emerald-600 uppercase">₹{Number(selectedCase.treatmentCharge || 0).toLocaleString()}</p></div>
                     </div>
                     <div className="space-y-3">
                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5"><Phone size={10} className="text-blue-500" /> Contact</p><p className="text-sm font-black text-slate-900 uppercase">{selectedCase.patientMobile || selectedCase.mobile || 'N/A'}</p></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5"><MapPin size={10} className="text-blue-500" /> Location</p><p className="text-sm font-black text-slate-900 uppercase">{selectedCase.location || 'N/A'}</p></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5"><FileText size={10} className="text-indigo-500" /> Registration No.</p><p className="text-sm font-black text-indigo-600 uppercase">{selectedCase.clinicianRegNo || userData?.regNo || 'N/A'}</p></div>
                     </div>
                  </div>

                  {/* Evidence */}
                  <div className="space-y-2 pt-2">
                     <p className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2"><ImageIcon size={12} className="text-blue-600" /> Submission Evidence</p>
                     {(selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.initialProof || selectedCase.imageUrl) ? (
                        <div onClick={() => {
                          const imageUrl = selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.initialProof || selectedCase.imageUrl;
                          if (imageUrl.startsWith('data:')) {
                            const byteString = atob(imageUrl.split(',')[1]);
                            const mimeString = imageUrl.split(',')[0].split(':')[1].split(';')[0];
                            const ab = new ArrayBuffer(byteString.length);
                            const ia = new Uint8Array(ab);
                            for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
                            const blob = new Blob([ab], {type: mimeString});
                            const blobUrl = URL.createObjectURL(blob);
                            window.open(blobUrl, '_blank');
                          } else { window.open(imageUrl, '_blank'); }
                        }} className="block aspect-video bg-slate-100 rounded-[4px] border border-slate-200 overflow-hidden relative group cursor-zoom-in">
                           {(() => {
                              const imageUrl = selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.initialProof || selectedCase.imageUrl;
                              const urlLower = imageUrl?.toLowerCase() || '';
                              const isImage = urlLower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$|%)/i) || (urlLower.includes('%2f') && (urlLower.includes('jpg') || urlLower.includes('png') || urlLower.includes('jpeg') || urlLower.includes('webp'))) || urlLower.startsWith('data:image');
                              const isPdf = urlLower.includes('.pdf') || urlLower.includes('%2fpdf') || urlLower.startsWith('data:application/pdf') || (urlLower.includes('alt=media') && !isImage);
                              
                              if (isPdf) {
                                 return (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white transition-transform duration-500 group-hover:scale-105 border border-slate-700 rounded-[2px]">
                                       <FileText size={36} className="mb-3 text-blue-500" />
                                       <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">PDF Document Node</span>
                                    </div>
                                 );
                              }
                              return (
                                 <img 
                                   src={imageUrl} 
                                   className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                   alt="submission proof" 
                                   onError={(e) => {
                                     e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'><rect width='600' height='400' fill='%230f172a'/><text x='50%' y='50%' fill='%233b82f6' font-family='sans-serif' font-size='24' font-weight='bold' text-anchor='middle' dominant-baseline='middle'>DOCUMENT NODE</text></svg>";
                                   }}
                                 />
                              );
                           })()}
                           <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ExternalLink size={24} className="text-white" /></div>
                        </div>
                     ) : (
                        <div className="aspect-video bg-slate-100 rounded-[4px] border border-slate-200 overflow-hidden relative flex flex-col items-center justify-center text-slate-300 italic text-[10px] font-black uppercase">No Initial Evidence</div>
                     )}
                  </div>

                  {/* Doctor Notes */}
                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2"><FileText size={12} className="text-blue-600" /> Doctor Notes</p>
                     <div className="p-3 bg-slate-50 rounded-[4px] border border-slate-100 text-[11px] font-bold text-slate-600 italic">
                        "{selectedCase.notes || 'No notes recorded.'}"
                     </div>
                  </div>

                  {/* RESOLUTION DETAILS */}
                  {(selectedCase.status === 'Submitted' || selectedCase.status === 'Approved') && (
                     <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2">
                           <div className="h-6 w-6 bg-emerald-100 rounded-[4px] flex items-center justify-center text-emerald-600"><Zap size={12}/></div>
                           <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Clinical Resolution Manifest</h4>
                        </div>
                        <div className="space-y-3">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Technical Remarks</p>
                           <div className="p-3 bg-slate-900 rounded-[4px] text-[11px] font-bold text-slate-300 italic leading-relaxed border border-slate-800">
                              "{selectedCase.clinicianNotes || 'No specific clinical resolution notes recorded.'}"
                           </div>
                        </div>
                        <div className="space-y-2">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Final Treatment Proof</p>
                           {selectedCase.finalProof ? (
                              <div onClick={() => {
                                 const imageUrl = selectedCase.finalProof;
                                 if (imageUrl.startsWith('data:')) {
                                   const byteString = atob(imageUrl.split(',')[1]);
                                   const mimeString = imageUrl.split(',')[0].split(':')[1].split(';')[0];
                                   const ab = new ArrayBuffer(byteString.length);
                                   const ia = new Uint8Array(ab);
                                   for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
                                   const blob = new Blob([ab], {type: mimeString});
                                   const blobUrl = URL.createObjectURL(blob);
                                   window.open(blobUrl, '_blank');
                                 } else { window.open(imageUrl, '_blank'); }
                               }} className="block aspect-video bg-emerald-50 rounded-[4px] border border-emerald-100 overflow-hidden relative group cursor-zoom-in">
                                  <img src={selectedCase.finalProof} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="final proof" />
                                  <div className="absolute inset-0 bg-emerald-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ExternalLink size={24} className="text-white" /></div>
                               </div>
                           ) : (
                              <div className="aspect-video bg-slate-50 rounded-[4px] border-2 border-dashed border-slate-100 flex items-center justify-center italic text-[10px] font-black text-slate-300 uppercase">Final Proof Syncing...</div>
                           )}
                        </div>
                     </div>
                  )}
               </div>
             </motion.div>
           </div>
         )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

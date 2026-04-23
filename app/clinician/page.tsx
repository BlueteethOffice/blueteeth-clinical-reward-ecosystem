'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Clock, CheckCircle2, TrendingUp, Activity, ShieldCheck, 
  Wifi, WifiOff, ChevronLeft, ChevronRight, X, User, Phone, 
  Calendar, Hash, Banknote, ArrowRight, FileText, ClipboardList, ListTodo
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { startCaseWork } from '@/lib/firestore';

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
      submittedAt: c.submittedAt // Keep for sorting
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
      
      // Update Cache Safely
      if (typeof window !== 'undefined' && user?.uid) {
        try {
          localStorage.setItem(`clinician_cases_${user.uid}`, JSON.stringify(getEssentialData(sortedCases)));
        } catch (e) {
          console.warn("Storage full, clearing old cache");
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

  // Effect 2: Fetch Self-Submitted Cases (Direct Referrals)
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

      // Client-side sorting
      const sorted = (submissions as any[]).sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      setSelfSubmittedCases(sorted);
      
      // Update Cache Safely
      if (typeof window !== 'undefined' && user?.uid) {
        try {
          localStorage.setItem(`clinician_submissions_${user.uid}`, JSON.stringify(getEssentialData(sorted)));
        } catch (e) {
          console.warn("Storage full, clearing old cache");
          localStorage.removeItem(`clinician_submissions_${user.uid}`);
        }
      }
      
      setLoadingSubmissions(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleStartWork = async (caseId: string) => {
      const { startCaseWork } = await import('@/lib/firestore');
      const res = await startCaseWork(caseId);
      if (res.success) {
          toast.success("Case marked as In Progress");
      } else {
          toast.error(res.error || "Failed to start work");
      }
  };

  const stats = [
    { name: 'Assigned Cases', value: dbStats.assigned.toString(), icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', gradient: 'from-amber-200 via-amber-100 to-amber-200' },
    { name: 'In Progress', value: dbStats.inProgress.toString(), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', gradient: 'from-blue-200 via-blue-100 to-blue-200' },
    { name: 'Completed', value: dbStats.completed.toString(), icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-200 via-emerald-100 to-emerald-200' },
    { name: 'Total Earnings', value: `₹${dbStats.totalEarnings.toLocaleString()}`, icon: Banknote, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', gradient: 'from-indigo-200 via-indigo-100 to-indigo-200' },
  ];

  // No return null to prevent flash
  // if (!isMounted) return null;

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-3 pb-2" suppressHydrationWarning>
        
        {/* Elite Header Node */}
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
              <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Specialist Node Console
              </p>
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
                   Assigned Work <ArrowRight className="h-4 w-4" />
                </Button>
             </Link>
          </div>
        </div>

        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 px-2 sm:px-0">
          {stats.map((item, idx) => (
            <div 
              key={item.name} 
              className={`p-[1px] rounded-[4px] bg-gradient-to-br ${item.gradient} shadow-2xl shadow-slate-200/50 group overflow-hidden`}
            >
               <Card className="h-full bg-white p-4 sm:p-6 rounded-[11px] border-none relative overflow-hidden group-hover:bg-slate-50 transition-colors">
                 <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                   <div className={`h-10 w-10 sm:h-14 sm:w-14 rounded-[4px] flex items-center justify-center ${item.bg} group-hover:scale-110 transition-transform shadow-inner shrink-0`}><item.icon className={`h-5 w-5 sm:h-7 sm:w-7 ${item.color}`} /></div>
                   <div className="min-w-0">
                     <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{item.name}</p>
                     <h3 className="text-base sm:text-2xl font-black text-slate-900 tracking-tighter truncate">{item.value}</h3>
                   </div>
                 </div>
                 <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${item.bg} rounded-[4px] blur-3xl opacity-20 group-hover:scale-150 transition-transform duration-700`} />
               </Card>
            </div>
          ))}
        </div>

        {/* SEPARATE SECTION: My Patient Registry (Direct Referrals) */}
         <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 sm:px-0">
             <div className="flex items-center gap-3">
               <div className="h-9 w-9 bg-slate-900 rounded-[4px] flex items-center justify-center text-blue-400 shadow-xl"><User size={18} /></div>
              <div>
                 <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Self-Submitted Records</h2>
                 <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Direct Referrals Node</p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <div className="hidden sm:flex items-center gap-2 bg-white border border-slate-100 p-1 rounded-[4px] shadow-sm">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-[4px] text-slate-400 disabled:opacity-20"
                  onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-[8px] font-black text-slate-900 w-8 text-center">
                  {currentPage + 1}/{Math.ceil(selfSubmittedCases.length / itemsPerPage) || 1}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-[4px] text-slate-400 disabled:opacity-20"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(selfSubmittedCases.length / itemsPerPage) - 1, prev + 1))}
                  disabled={currentPage >= Math.ceil(selfSubmittedCases.length / itemsPerPage) - 1}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
              <Link href="/clinician/my-cases" className="w-full sm:w-auto">
                <Button className="h-9 px-4 w-full sm:w-auto bg-white border border-slate-200 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 rounded-[4px] flex items-center justify-center gap-2">
                    History <ListTodo size={12} />
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
             {/* Mobile Horizontal Scroll */}
             <div className="flex sm:hidden overflow-x-auto gap-4 px-2 pb-6 no-scrollbar snap-x">
                {loadingSubmissions && selfSubmittedCases.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="min-w-[220px] h-[150px] bg-slate-50 rounded-[4px] border border-slate-100 p-4 space-y-3 shadow-sm animate-pulse">
                       <div className="flex justify-between">
                          <div className="h-8 w-8 bg-slate-100 rounded-[4px]" />
                          <div className="h-5 w-16 bg-slate-50 rounded" />
                       </div>
                       <div className="h-4 w-3/4 bg-slate-50 rounded" />
                       <div className="h-3 w-1/2 bg-slate-50/50 rounded" />
                    </div>
                  ))
                ) : selfSubmittedCases.length === 0 ? (
                  <div className="w-full py-16 bg-slate-50/50 rounded-[4px] border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-4">
                     <div className="h-12 w-12 bg-white rounded-[4px] flex items-center justify-center text-slate-300 shadow-inner"><Activity size={24} /></div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry awaiting data sync...</p>
                  </div>
                ) : (
                  selfSubmittedCases.map((c) => (
                    <motion.div 
                      key={c.id}
                      className="min-w-[220px] h-[150px] snap-center p-[1px] rounded-[4px] bg-gradient-to-br from-slate-200 to-slate-300 shadow-lg"
                    >
                      <Link href={`/clinician/work/${c.id}`}>
                        <Card className="h-full p-4 bg-slate-50 border-none rounded-[4px] relative overflow-hidden">
                           <div className="relative z-10 space-y-4">
                              <div className="flex justify-between items-start">
                                 <div className="h-9 w-9 bg-slate-900 rounded-[4px] flex items-center justify-center text-white font-black text-[11px]">
                                    {c.patientName.charAt(0).toUpperCase()}
                                 </div>
                                 <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border shadow-sm ${
                                    c.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                 }`}>{c.status}</span>
                              </div>
                              <div>
                                 <div className="flex items-center justify-between gap-3">
                                    <p className="font-black text-slate-900 text-sm uppercase tracking-tight line-clamp-1 grow">{c.patientName}</p>
                                    <span className="shrink-0 text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">#{c.customCaseId || c.id.slice(0, 6)}</span>
                                 </div>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 line-clamp-1">{c.treatmentName || c.treatment}</p>
                              </div>
                              <div className="flex justify-between items-end pt-2 border-t border-slate-100">
                                 <span className="text-[7px] font-black text-slate-400 uppercase">{c.date}</span>
                                 <div className="text-right">
                                    <span className="text-xs font-black text-slate-900 block leading-none">₹{c.clinicianFee || 0}</span>
                                 </div>
                              </div>
                           </div>
                        </Card>
                      </Link>
                    </motion.div>
                  ))
                )}
             </div>

             {/* Desktop Grid View (Untouched) */}
             <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2 sm:px-0">
                {loadingSubmissions && selfSubmittedCases.length === 0 ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="h-44 bg-white rounded-[4px] border border-slate-100 p-5 space-y-4 shadow-sm animate-pulse">
                       <div className="flex justify-between">
                          <div className="h-10 w-10 bg-slate-50 rounded-[4px]" />
                          <div className="h-5 w-16 bg-slate-50 rounded" />
                       </div>
                       <div className="h-4 w-3/4 bg-slate-50 rounded" />
                       <div className="h-3 w-1/2 bg-slate-50/50 rounded" />
                    </div>
                  ))
                ) : selfSubmittedCases.length === 0 ? (
                  <div className="col-span-full py-16 bg-slate-50/50 rounded-[4px] border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-4">
                     <div className="h-12 w-12 bg-white rounded-[4px] flex items-center justify-center text-slate-300 shadow-inner"><Activity size={24} /></div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry awaiting data sync...</p>
                  </div>
                ) : (
                  selfSubmittedCases.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage).map((c) => (
                    <motion.div 
                      key={c.id}
                      whileHover={{ y: -5 }}
                      className="p-[1px] rounded-[4px] bg-gradient-to-br from-slate-200 to-slate-300 hover:from-blue-500 hover:to-indigo-600 shadow-xl transition-all duration-500 group"
                    >
                      <Link href={`/clinician/work/${c.id}`}>
                        <Card className="h-full p-5 bg-white border-none rounded-[11px] relative overflow-hidden group-hover:bg-slate-50 transition-colors">
                           <div className="relative z-10 space-y-4">
                              <div className="flex justify-between items-start">
                                 <div className="h-9 w-9 bg-slate-900 rounded-[4px] flex items-center justify-center text-white font-black text-[11px] group-hover:scale-110 transition-transform">
                                    {c.patientName.charAt(0).toUpperCase()}
                                 </div>
                                 <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border shadow-sm ${
                                    c.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                 }`}>{c.status}</span>
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
                                    <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Dispatch Workspace</span>
                                 </div>
                              </div>
                           </div>
                        </Card>
                      </Link>
                    </motion.div>
                  ))
                )}
             </div>
          </div>
        </div>        {/* Active Work Ledger */}
        <div className="space-y-4 px-1 sm:px-0">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-slate-900 rounded-[4px] flex items-center justify-center text-white shadow-xl"><ListTodo size={18} /></div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Assignment Ledger</h2>
            </div>
            <div className="flex items-center gap-3">
               <div className="text-right hidden sm:block">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Node Status</p>
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter mt-1">Global Registry Active</p>
               </div>
               <div className="h-2 w-2 rounded-[4px] bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
          </div>

          <div className="bg-white rounded-[4px] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
             {/* Desktop Table View */}
             <div className="hidden lg:block overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                    <tr className="bg-slate-900 border-b border-slate-800">
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest">Clinical Identity</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest text-center">Status Badge</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest">Settlement ₹</th>
                      <th className="px-8 py-5 text-[10px] font-black text-white uppercase tracking-widest text-right">Access Node</th>
                    </tr>
                  </thead>
                 <tbody className="divide-y divide-slate-100">
                   {loading && cases.length === 0 ? (
                     [...Array(3)].map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={4} className="h-24 bg-slate-50/30"></td></tr>)
                   ) : cases.length === 0 ? (
                     <tr><td colSpan={4} className="py-40 text-center">
                        <div className="flex flex-col items-center gap-6">
                           <div className="h-20 w-20 bg-slate-50 rounded-[4px] flex items-center justify-center text-slate-200 shadow-inner">
                              <Activity size={40} />
                           </div>
                           <div className="space-y-2">
                              <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Registry Node Empty</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-xs mx-auto">New clinical assignments will manifest here in real-time.</p>
                           </div>
                        </div>
                     </td></tr>
                   ) : (
                      cases.slice(currentAssignedPage * assignedItemsPerPage, (currentAssignedPage + 1) * assignedItemsPerPage).map((c) => (
                       <tr key={c.id} className="hover:bg-slate-50 transition-all group">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-5">
                               <div className="h-11 w-11 bg-slate-900 rounded-[4px] flex items-center justify-center text-blue-400 font-black text-sm shadow-xl group-hover:scale-110 transition-transform">
                                  {c.patientName.charAt(0).toUpperCase()}
                               </div>
                               <div>
                                  <p className="font-black text-slate-900 text-base leading-tight uppercase group-hover:text-blue-600 transition-colors">
                                     {c.doctorUid === user?.uid && <span className="text-amber-500 mr-1">★</span>}
                                     {c.patientName}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                     <span className="flex items-center gap-1.5"><Hash size={10} className="text-blue-500" />{c.customCaseId || c.id.slice(0, 8).toUpperCase()}</span>
                                     <span className="h-1 w-1 rounded-[4px] bg-slate-200" />
                                     <span className="text-slate-500">{c.treatmentName || c.treatment}</span>
                                     {c.doctorUid !== user?.uid && (
                                        <span className="ml-2 text-[7px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-blue-100">
                                           Ref: {c.doctorName?.split(' ')[0] || 'Associate'}
                                        </span>
                                     )}
                                  </div>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-center">
                            <span className={`inline-flex px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-sm transition-all ${
                              c.status === 'Assigned' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                              c.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-200 animate-pulse' :
                              c.status === 'Submitted' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                              'bg-emerald-50 text-emerald-600 border-emerald-200'
                            }`}>
                               {c.status}
                            </span>
                         </td>
                          <td className="px-8 py-6">
                             <div className="flex flex-col items-start">
                                <span className="text-lg font-black text-slate-900 tracking-tighter">₹{c.clinicianFee?.toLocaleString() || '0'}</span>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Protocol Fee</span>
                             </div>
                          </td>
                         <td className="px-8 py-6 text-right">
                            <Link href={`/clinician/work/${c.id}`}>
                               <Button variant="ghost" className="h-10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 group/btn">
                                  Workspace <ArrowRight size={14} className="ml-2 group-hover/btn:translate-x-1 transition-transform" />
                               </Button>
                            </Link>
                         </td>
                       </tr>
                      ))
                   )}
                 </tbody>
               </table>
             </div>

             {/* Mobile Card View */}
             <div className="lg:hidden divide-y divide-slate-100">
               {loading && cases.length === 0 ? (
                 [...Array(3)].map((_, i) => <div key={i} className="p-6 animate-pulse space-y-3"><div className="h-5 bg-slate-50 rounded w-1/3"/><div className="h-4 bg-slate-50 rounded w-full"/></div>)
               ) : cases.length === 0 ? (
                 <div className="py-24 text-center px-6">
                    <div className="h-12 w-12 bg-slate-50 rounded-[4px] flex items-center justify-center text-slate-200 mx-auto mb-4"><Activity size={24} /></div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No assignments manifest at this time.</p>
                 </div>
               ) : (
                 cases.slice(currentAssignedPage * assignedItemsPerPage, (currentAssignedPage + 1) * assignedItemsPerPage).map((c) => (
                   <Link key={c.id} href={`/clinician/work/${c.id}`} className="block p-6 hover:bg-slate-50 transition-colors group">
                     <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 bg-slate-900 rounded-[4px] flex items-center justify-center text-white text-xs font-black group-hover:scale-110 transition-transform shadow-lg">
                              {c.patientName.charAt(0).toUpperCase()}
                           </div>
                           <div>
                              <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{c.patientName}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">#{c.customCaseId || c.id.slice(0, 6)}</p>
                           </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border shadow-sm ${
                          c.status === 'Assigned' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          c.status === 'In Progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-emerald-50 text-emerald-600 border-emerald-200'
                        }`}>{c.status}</span>
                     </div>
                     <div className="flex justify-between items-end">
                        <div className="space-y-1.5">
                           <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{c.treatmentName || c.treatment}</p>
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">REF: {c.doctorName?.split(' ')[0] || 'Associate'}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-base font-black text-slate-900 tracking-tighter">₹{c.clinicianFee?.toLocaleString() || '0'}</p>
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Yield</p>
                        </div>
                     </div>
                   </Link>
                 ))
               )}
             </div>
             
             {/* Dynamic Footer Pagination */}
             <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                   Node Sync <span className="text-blue-400">{cases.length}</span> Objects Found
                </p>
                <div className="flex items-center gap-3">
                   <Button 
                     variant="outline" 
                     className="h-9 w-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-20 rounded-lg"
                     onClick={() => setCurrentAssignedPage(prev => Math.max(0, prev - 1))}
                     disabled={currentAssignedPage === 0}
                   >
                     <ChevronLeft size={16} />
                   </Button>
                   <div className="h-9 px-4 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-black text-blue-400">
                      {currentAssignedPage + 1} / {Math.ceil(cases.length / assignedItemsPerPage) || 1}
                   </div>
                   <Button 
                     variant="outline" 
                     className="h-9 w-12 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 disabled:opacity-20 rounded-lg"
                     onClick={() => setCurrentAssignedPage(prev => Math.min(Math.ceil(cases.length / assignedItemsPerPage) - 1, prev + 1))}
                     disabled={currentAssignedPage >= Math.ceil(cases.length / assignedItemsPerPage) - 1}
                   >
                     <ChevronRight size={16} />
                   </Button>
                </div>
             </div>
           </div>
         </div>
       </div>
    </DashboardLayout>
  );
}

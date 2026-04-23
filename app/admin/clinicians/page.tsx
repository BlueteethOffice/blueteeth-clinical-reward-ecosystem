'use client';

import React, { useState, useEffect, Suspense } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Search, UserCheck, Mail, Phone,
  FilePlus, Download, 
  Activity, ChevronRight,
  ShieldCheck, Smartphone, BadgeCheck, TrendingUp, X, PlusCircle, IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

function ClinicianListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryQ = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(queryQ);
  
  const [clinicians, setClinicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClinician, setSelectedClinician] = useState<any>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [pendingCases, setPendingCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [assignmentFee, setAssignmentFee] = useState(100);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [effectivePageSize, setEffectivePageSize] = useState(8);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setEffectivePageSize(4);
    } else {
      setEffectivePageSize(100); // Desktop back to original (showing all/many)
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!db || !hasMounted) return;
    setLoading(true);
    const q = query(collection(db, 'users'), where('role', '==', 'clinician'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClinicians(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      toast.error("Failed to sync clinician registry.");
    });
    return () => unsubscribe();
  }, [db, hasMounted]);

  useEffect(() => {
    const loadSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'global'));
      if (snap.exists()) {
        const data = snap.data();
        setAssignmentFee(data.defaultClinicianFee || 100);
      }
    };
    if (hasMounted) loadSettings();
  }, [hasMounted]);

  const fetchPendingCases = async () => {
    setLoadingCases(true);
    try {
      const q = query(collection(db, 'cases'), where('status', '==', 'Submitted'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((c: any) => !c.clinicianId);
      setPendingCases(data);
    } catch (error) {
      toast.error("Failed to fetch pending cases.");
    } finally {
      setLoadingCases(false);
    }
  };

  const handleAssignCase = async (caseId: string) => {
    if (!selectedClinician) return;
    const tid = toast.loading(`SECURE SYNC: Assigning case...`);
    try {
      await updateDoc(doc(db as any, 'cases', caseId), {
        clinicianId: selectedClinician.id,
        clinicianName: selectedClinician.name,
        clinicianFee: Number(assignmentFee),
        status: 'Assigned',
        assignedAt: serverTimestamp()
      });
      toast.success(`SUCCESS: Case assigned to Dr. ${selectedClinician.name}`, { id: tid });
      setShowAssignModal(false);
      fetchPendingCases();
    } catch (error) {
      toast.error("Assignment Failed.", { id: tid });
    }
  };

  const toggleStatus = async (clinician: any) => {
    try {
      const newStatus = clinician.status === 'Active' ? 'Inactive' : 'Active';
      await updateDoc(doc(db as any, 'users', clinician.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setSelectedClinician({ ...clinician, status: newStatus });
      toast.success(`Registry Updated: Specialist marked as ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status.");
    }
  };

  const filteredClinicians = clinicians.filter(c => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.specialization || '').toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filteredClinicians.length / effectivePageSize);
  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedClinicians = filteredClinicians.slice(startIndex, startIndex + effectivePageSize);

  return (
    <DashboardLayout isAdminRoute={true}>
      <div className="space-y-6 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 sm:px-0">
          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-black text-blue-900 tracking-tight">Specialist Registry</h1>
            <p className="text-slate-500 font-medium text-[10px] sm:text-xs uppercase tracking-wider">Clinical Specialist Management Node</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => {
                const headers = ['Name', 'Email', 'Specialization', 'Status'];
                const rows = clinicians.map(c => [c.name, c.email, c.specialization, c.status].join(','));
                const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "Clinicians_List.csv");
                document.body.appendChild(link);
                link.click();
                toast.success('Data Exported');
              }}
              className="h-9 sm:h-10 w-full sm:w-auto rounded-[4px] gap-2 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest border-slate-200 shadow-sm"
            >
              <Download size={14} /> Export Data
            </Button>
          </div>
        </div>

        <div className="relative group px-1 sm:px-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search by name, expertise, or email..."
            className="w-full h-11 sm:h-12 pl-10 pr-4 bg-white border border-slate-200 rounded-[4px] text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              const params = new URLSearchParams(window.location.search);
              if (e.target.value) params.set('q', e.target.value);
              else params.delete('q');
              router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
            }}
          />
        </div>

        <div className="px-0.5 sm:px-0">
          <Card className="border border-slate-200 shadow-xl rounded-[4px] bg-white overflow-hidden">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800">
                    <th className="px-6 py-4 text-[9px] font-black text-white uppercase tracking-widest">Doctor Details</th>
                    <th className="px-6 py-4 text-[9px] font-black text-white uppercase tracking-widest text-center">Expertise</th>
                    <th className="px-6 py-4 text-[9px] font-black text-white uppercase tracking-widest text-center">Cases Done</th>
                    <th className="px-6 py-4 text-[9px] font-black text-white uppercase tracking-widest text-center">Status</th>
                    <th className="px-6 py-4 text-[9px] font-black text-white uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedClinicians.map((clinician, idx) => (
                    <tr key={clinician.id} className="hover:bg-slate-50 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black uppercase text-xs overflow-hidden">
                            {clinician.photoURL ? <img src={clinician.photoURL} className="h-full w-full object-cover" /> : clinician.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-blue-900 uppercase tracking-tight">{clinician.name}</p>
                            <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5"><Mail size={10} /> {clinician.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[9px] font-black text-blue-600 uppercase tracking-widest border border-blue-100">
                          <ShieldCheck size={12} /> {clinician.specialization || 'Clinical Specialist'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-black text-slate-900">0 Cases</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => toggleStatus(clinician)} className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${clinician.status === 'Inactive' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                          {clinician.status || 'Active'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedClinician(clinician); setShowDrawer(true); }} className="h-8 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                          View Profile <ChevronRight size={12} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-slate-100 bg-white">
              {paginatedClinicians.map((clinician) => (
                <div key={clinician.id} className="p-5 active:bg-slate-50 cursor-pointer" onClick={() => { setSelectedClinician(clinician); setShowDrawer(true); }}>
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black overflow-hidden">
                           {clinician.photoURL ? <img src={clinician.photoURL} className="h-full w-full object-cover" /> : <span>{clinician.name?.charAt(0)}</span>}
                        </div>
                        <div>
                           <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{clinician.name}</p>
                           <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={10} /> {clinician.specialization || 'Clinical Specialist'}</p>
                        </div>
                     </div>
                     <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${clinician.status === 'Inactive' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{clinician.status || 'Active'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:hidden px-4 sm:px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 overflow-hidden">
              <div className="flex items-center gap-3 flex-1">
                <p className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">
                  Page <span className="text-blue-300">{currentPage}</span>/<span className="text-blue-300">{Math.max(1, totalPages)}</span>
                </p>
                <p className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">
                  {filteredClinicians.length} Nodes Online
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="h-8 px-3 rounded-[4px] text-[9px] font-black bg-slate-900 text-white border-slate-800 hover:bg-blue-600">Prev</Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="h-8 px-3 rounded-[4px] text-[9px] font-black bg-slate-900 text-white border-slate-800 hover:bg-blue-600">Next</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showDrawer && selectedClinician && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDrawer(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[210]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-[211] overflow-hidden flex flex-col border-l border-slate-100 shadow-2xl">
               <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-black text-blue-900 uppercase tracking-widest">Specialist Profile</h2>
                  <button onClick={() => setShowDrawer(false)} className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X size={18} /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  <div className="flex flex-col items-center text-center">
                     <div className="h-24 w-24 rounded-3xl bg-blue-600 flex items-center justify-center text-white text-3xl font-black uppercase overflow-hidden shadow-xl mb-4">
                        {selectedClinician.photoURL ? <img src={selectedClinician.photoURL} className="h-full w-full object-cover" /> : selectedClinician.name?.charAt(0)}
                     </div>
                     <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedClinician.name}</h3>
                     <div className="mt-2 px-3 py-1 bg-blue-50 text-[9px] font-black text-blue-600 uppercase rounded-full border border-blue-100">{selectedClinician.specialization || 'Clinical Specialist'}</div>
                  </div>
                  <div className="space-y-4">
                     <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
                        <Mail className="text-blue-600" size={16} />
                        <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase">Email Identity</p>
                           <p className="text-xs font-bold text-slate-700">{selectedClinician.email}</p>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <Button variant="outline" onClick={() => toggleStatus(selectedClinician)} className="h-11 rounded-xl text-[9px] font-black uppercase border-rose-200 text-rose-600 hover:bg-rose-50">Toggle Status</Button>
                  <Button onClick={() => { fetchPendingCases(); setShowAssignModal(true); }} className="h-11 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase hover:bg-blue-700">Assign Case</Button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAssignModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssignModal(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[220]" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-xl shadow-2xl z-[221] overflow-hidden border border-slate-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                   <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">Assign Case</h3>
                   <button onClick={() => setShowAssignModal(false)}><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                   {loadingCases ? <div className="text-center py-10">Scanning...</div> : pendingCases.length > 0 ? pendingCases.map((c: any) => (
                     <div key={c.id} className="p-4 border border-slate-200 rounded-lg hover:border-blue-500 cursor-pointer" onClick={() => handleAssignCase(c.id)}>
                        <p className="text-[10px] font-black text-blue-600">REF: {c.id.slice(-6).toUpperCase()}</p>
                        <h4 className="text-sm font-black text-slate-900 uppercase">{c.patientName}</h4>
                     </div>
                   )) : <div className="text-center py-10 text-[10px] font-black text-slate-400 uppercase">All cases assigned</div>}
                </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

export default function ClinicianList() {
  return (
    <Suspense fallback={<div className="h-screen bg-slate-50 animate-pulse" />}>
      <ClinicianListContent />
    </Suspense>
  );
}

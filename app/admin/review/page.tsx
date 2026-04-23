'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSearchParams } from 'next/navigation';
import { 
  CheckCircle, XCircle, Eye, User, Users, Phone, MapPin, 
  Calendar, ClipboardList, Coins, Search, Filter, ExternalLink,
  FileCheck, Image as ImageIcon, ShieldCheck, FileText, Activity, Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { fetchAdminCases, approveCase, rejectCase, revokeCase, fetchClinicians, assignClinician } from '@/lib/firestore';
import { Suspense } from 'react';

// Responsive Dual-Style Case Card Component
const CaseCard = ({ c, idx, onSelect, isSelected }: { c: any, idx: number, onSelect: (c: any) => void, isSelected: boolean }) => {
  const status = c.status || 'Pending';
  const isAssociate = c.doctorRole?.toLowerCase() === 'associate' || c.role?.toLowerCase() === 'associate';
  const themeColor = isAssociate ? 'blue' : 'indigo';
  const firstLetter = c.patientName?.charAt(0).toUpperCase() || '?';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="w-full sm:max-w-[380px] mx-auto"
    >
      {/* MOBILE VIEW: Elite Case History Style (Same as Associate Portal) */}
      <div 
        onClick={() => onSelect(c)}
        className={`sm:hidden p-4 active:bg-blue-50/50 transition-all border-l-4 cursor-pointer ${
          status === 'Approved' ? 'border-l-emerald-500 bg-emerald-50/30' :
          status === 'Rejected' ? 'border-l-rose-500 bg-rose-50/30' : 
          isAssociate ? 'border-l-amber-500 bg-amber-50/30' : 'border-l-blue-500 bg-blue-50/30'
        } mb-3 bg-white shadow-sm rounded-r-[4px] border border-slate-100 relative group ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      >
         <div className="flex justify-between items-start mb-3">
            <div>
               <p className="text-[15px] font-black text-slate-900 uppercase tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
                  {!isAssociate && <span className="text-blue-600 mr-1">**</span>}
                  {c.patientName || 'Anonymous Node'}
               </p>
               <p className="text-[9px] font-black text-slate-600 mt-1 uppercase tracking-widest leading-none">
                  REF-{(c.id || '').toUpperCase().slice(0, 8)} 
                  <span className="mx-1 opacity-20">|</span> 
                  {c.submittedAt ? new Date(c.submittedAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'N/A'}
               </p>
            </div>
            <span className={`inline-flex px-2.5 py-1 rounded-[4px] text-[8px] font-black uppercase tracking-widest border shadow-sm ${
               status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
               status === 'Assigned' ? 'bg-blue-50 text-blue-600 border-blue-100' :
               status === 'In Progress' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
               'bg-amber-50 text-amber-600 border-amber-100'
            }`}>{status}</span>
         </div>
         
         <div className="flex justify-between items-end">
            <div className="text-[10px] font-black text-slate-700 uppercase tracking-tighter max-w-[65%] truncate border-l-2 border-blue-500 pl-2 leading-none py-0.5">
               {c.treatmentName || c.treatment || 'Consultation Node'}
            </div>
            <div className="text-right">
               <span className="text-xl font-black text-slate-900 tracking-tighter">+{Number(c.points || 0).toFixed(1)}</span>
               <span className="text-[8px] text-blue-500 font-black ml-1 uppercase tracking-widest">Points</span>
            </div>
         </div>
         {isSelected && <div className="absolute inset-0 bg-blue-500/5 pointer-events-none rounded-r-[4px]" />}
      </div>

      {/* DESKTOP VIEW: Original Boxy Blue Design */}
      <Card 
        onClick={() => onSelect(c)}
        className={`hidden sm:flex group cursor-pointer transition-all border-2 relative overflow-hidden rounded-[4px] min-h-[190px] w-full max-w-[380px] mx-auto flex-col justify-between ${
          isSelected 
            ? `border-blue-600 shadow-xl bg-blue-50/30` 
            : `${isAssociate ? 'border-indigo-900' : 'border-pink-200'} hover:border-blue-400 bg-white hover:shadow-lg`
        }`}
      >
        <CardContent className="p-5 flex flex-col h-full gap-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-50 border border-blue-100 rounded-[4px] flex items-center justify-center font-black text-blue-600 text-lg shadow-inner">
                {firstLetter}
              </div>
              <div className="space-y-0.5">
                <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight leading-none group-hover:text-blue-600 transition-colors">
                  {!isAssociate && <span className="text-blue-600 mr-1">**</span>}
                  {c.patientName}
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">{c.treatmentName || c.treatment}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Rewards</p>
              <p className="text-lg font-black text-slate-900 tracking-tight">₹{(Number(c.points || 0) * 50).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex-1 py-2">
             <div className="flex items-center gap-2">
                 <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-black uppercase border ${
                  status === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 
                  status === 'Assigned' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                  status === 'In Progress' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' :
                  'bg-amber-50 border-amber-200 text-amber-600'
                }`}>
                   {status}
                </span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">#{c.customCaseId || (c.id || '').toUpperCase().slice(0, 8)}</span>
             </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-50">
             <div className="flex items-center gap-2 text-slate-400">
                <Calendar size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">
                   {c.submittedAt ? new Date(c.submittedAt.seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Recently'}
                </span>
             </div>
             <div className="flex items-center gap-1.5 text-blue-600 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                Open Review <ExternalLink size={12} />
             </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
 
function CaseReviewContent() {

  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Increased for full-width grid
  const [dataLoading, setDataLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'Pending' | 'Approved' | 'Assigned' | 'Submitted' | 'Rejected'>('Pending');
  const [clinicianPage, setClinicianPage] = useState(1);
  const [associatePage, setAssociatePage] = useState(1);
  const [effectivePageSize, setEffectivePageSize] = useState(8);

  useEffect(() => {
    if (window.innerWidth < 640) {
      setEffectivePageSize(4);
    }
  }, []);
  
  const [clinicians, setClinicians] = useState<any[]>([]);
  const [assignmentModal, setAssignmentModal] = useState<{ open: boolean; caseId: string; } | null>(null);
  const [selectedClinician, setSelectedClinician] = useState('');
  const [clinicianFee, setClinicianFee] = useState(500);
  const [showPreview, setShowPreview] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; title: string; message: string; type: 'success' | 'error' | 'warning' }>({
    open: false, title: '', message: '', type: 'info' as any
  });
  const [points, setPoints] = useState<string | number>(8);
  const [clinicianSearch, setClinicianSearch] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const filteredCases = cases.filter(c => {
    // Search Filter Logic
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
    setSelectedCase(null);
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
       setDataLoading(true);
       const data = await fetchAdminCases(filterStatus);
       if (data) {
          setCases(data);
       } else {
          setCases([]);
       }
    } catch (e) {
       console.error("Failed to load cases stream");
    } finally {
       setDataLoading(false);
    }
  };

  React.useEffect(() => {
    const loadClinicians = async () => {
      const data = await fetchClinicians();
      setClinicians(data);
    };
    loadClinicians();
  }, []);

  useEffect(() => {
    if (assignmentModal?.open && selectedCase?.doctorUid) {
      const isSubmitterAvailable = clinicians.some(c => c.id === selectedCase.doctorUid);
      if (isSubmitterAvailable) {
        setSelectedClinician(selectedCase.doctorUid);
      }
    } else if (!assignmentModal?.open) {
      setSelectedClinician('');
    }
  }, [assignmentModal, selectedCase, clinicians]);

  useEffect(() => {
    setImageError(false);
  }, [selectedCase]);

  const handleAssign = async () => {
    if (!assignmentModal || !selectedClinician) return;
    setLoading('assigning');
    
    const selectedClinicianData = clinicians.find(c => c.id === selectedClinician);
    const res = await assignClinician(
      assignmentModal.caseId, 
      selectedClinician, 
      clinicianFee,
      selectedClinicianData?.name,
      selectedClinicianData?.registrationNumber
    );
    if (res.success) {
      toast.success("Case assigned to Specialist!");
      setAssignmentModal(null);
      setSelectedCase(null); // Close main review modal to reflect changes
      loadData();
    } else {
      toast.error(res.error || "Assignment failed");
    }
    setLoading(null);
  };

  const handleDirectAssign = async (caseId: string, doctorUid: string) => {
    if (!doctorUid) return;
    setLoading('assigning');
    try {
      const clinicianData = clinicians.find(c => c.id === doctorUid);
      await assignClinician(
        caseId, 
        doctorUid, 
        clinicianFee,
        clinicianData?.name,
        clinicianData?.registrationNumber
      );
      const updated = await fetchAdminCases(filterStatus);
      setCases(updated);
      setSelectedCase(null);
      toast.success("Case assigned successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to assign");
    } finally {
      setLoading(null);
    }
  };

  const handleAction = async (caseId: string, action: 'approve' | 'reject' | 'revoke') => {
    const caseToProcess = cases.find(c => c.id === caseId) || selectedCase;
    const toastId = toast.loading(`Processing ${action}...`);

    try {
      let result;
      if (action === 'approve') {
        result = await approveCase(caseId, caseToProcess.doctorUid, points || caseToProcess.points);
      } else if (action === 'revoke') {
        result = await revokeCase(caseId, caseToProcess.doctorUid, caseToProcess.points);
      } else {
        result = await rejectCase(caseId);
      }

      if (result.success) {
        toast.success(`Case ${action}ed successfully.`, { id: toastId });
        setSelectedCase(null);
        loadData();
      } else {
        toast.error(`Failed to ${action} case.`, { id: toastId });
      }
    } catch (error) {
      toast.error("An error occurred.", { id: toastId });
    }
  };

  return (
    <DashboardLayout isAdminRoute={true}>
      <Suspense fallback={<div className="space-y-6 animate-pulse p-8"><div className="h-20 bg-slate-100 rounded-[4px]"/><div className="grid grid-cols-2 gap-6"><div className="h-48 bg-slate-100 rounded-[4px]"/><div className="h-48 bg-slate-100 rounded-[4px]"/></div></div>}>
        <div className="space-y-6 pb-2" suppressHydrationWarning>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-slate-50/80 backdrop-blur-md z-50 py-4 px-2 sm:px-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">Admin Case Hub</h1>
            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-[0.2em]">Clinical Verification Protocol • {filteredCases.length} Nodes Found</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative group flex-1 sm:flex-initial">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
               <Input 
                placeholder="SEARCH NODES..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 sm:h-10 w-full sm:w-[280px] bg-white border-slate-200 rounded-[4px] text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
               />
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 sm:gap-2 pb-2 overflow-x-auto no-scrollbar border-b border-slate-100 px-2 sm:px-0">
            {['Pending', 'Assigned', 'Submitted', 'Rejected'].map((status: any) => (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status);
                  setClinicianPage(1);
                  setAssociatePage(1);
                }}
                className={`px-4 py-2 rounded-[4px] text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shrink-0 ${filterStatus === status ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}
              >
                {status} {filterStatus === status ? `(${filteredCases.length})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full space-y-12">
          {dataLoading ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-40 bg-slate-100 animate-pulse rounded-[4px] border border-slate-200"></div>
               ))}
             </div>
          ) : (
            <div className="space-y-12">
              {/* Clinician Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                   <div className="flex items-center gap-3">
                      <div className="h-6 w-1 bg-blue-600 rounded-[4px]" />
                      <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Clinician Registry</h2>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-[4px] text-[9px] font-black">
                        {filteredCases.filter(c => c.doctorRole?.toLowerCase() !== 'associate').length} NODES
                      </span>
                   </div>
                    {/* DESKTOP PAGINATION: Original Ghost Style (NO TOUCH) */}
                    <div className="hidden sm:flex items-center gap-2">
                       <Button 
                         variant="ghost" size="sm" 
                         disabled={clinicianPage === 1}
                         onClick={() => setClinicianPage(p => p - 1)}
                         className="h-7 px-2 text-[9px] font-black uppercase tracking-widest border border-slate-100"
                       >
                         Prev
                       </Button>
                       <span className="text-[10px] font-black text-slate-400">{clinicianPage}</span>
                       <Button 
                         variant="ghost" size="sm"
                         disabled={clinicianPage * effectivePageSize >= filteredCases.filter(c => c.doctorRole?.toLowerCase() !== 'associate').length}
                         onClick={() => setClinicianPage(p => p + 1)}
                         className="h-7 px-2 text-[9px] font-black uppercase tracking-widest border border-slate-100"
                       >
                         Next
                       </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCases
                    .filter(c => c.doctorRole?.toLowerCase() !== 'associate')
                    .slice((clinicianPage - 1) * effectivePageSize, clinicianPage * effectivePageSize)
                    .map((c, idx) => (
                      <CaseCard key={c.id} c={c} idx={idx} onSelect={setSelectedCase} isSelected={selectedCase?.id === c.id} />
                    ))
                  }
                  {filteredCases.filter(c => c.doctorRole?.toLowerCase() !== 'associate').length === 0 && (
                    <div className="col-span-full py-10 bg-slate-50/50 rounded-[4px] border border-dashed border-slate-200 text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Clinician Submissions</p>
                    </div>
                  )}
                </div>
                {/* MOBILE PAGINATION: Bottom Elite Style */}
                <div className="sm:hidden flex items-center justify-center gap-2 pt-1">
                   <Button 
                     variant="outline" size="sm" 
                     disabled={clinicianPage === 1}
                     onClick={() => setClinicianPage(p => p - 1)}
                     className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border-slate-200 bg-white text-slate-600 rounded-[4px] hover:bg-slate-50"
                   >
                     PREV
                   </Button>
                   <div className="h-8 w-8 rounded-[4px] bg-blue-600 flex items-center justify-center">
                      <span className="text-[11px] font-black text-white">{clinicianPage}</span>
                   </div>
                   <Button 
                     variant="outline" size="sm"
                     disabled={clinicianPage * effectivePageSize >= filteredCases.filter(c => c.doctorRole?.toLowerCase() !== 'associate').length}
                     onClick={() => setClinicianPage(p => p + 1)}
                     className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border-slate-200 bg-white text-slate-600 rounded-[4px] hover:bg-slate-50"
                   >
                     NEXT
                   </Button>
                </div>
              </div>

              {/* Associate Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                   <div className="flex items-center gap-3">
                      <div className="h-6 w-1 bg-amber-600 rounded-[4px]" />
                      <h2 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Associate Registry</h2>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-[4px] text-[9px] font-black">
                        {filteredCases.filter(c => c.doctorRole?.toLowerCase() === 'associate').length} NODES
                      </span>
                   </div>
                    {/* DESKTOP PAGINATION: Original Ghost Style (NO TOUCH) */}
                    <div className="hidden sm:flex items-center gap-2">
                       <Button 
                         variant="ghost" size="sm" 
                         disabled={associatePage === 1}
                         onClick={() => setAssociatePage(p => p - 1)}
                         className="h-7 px-2 text-[9px] font-black uppercase tracking-widest border border-slate-100"
                       >
                         Prev
                       </Button>
                       <span className="text-[10px] font-black text-slate-400">{associatePage}</span>
                       <Button 
                         variant="ghost" size="sm"
                         disabled={associatePage * effectivePageSize >= filteredCases.filter(c => c.doctorRole?.toLowerCase() === 'associate').length}
                         onClick={() => setAssociatePage(p => p + 1)}
                         className="h-7 px-2 text-[9px] font-black uppercase tracking-widest border border-slate-100"
                       >
                         Next
                       </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCases
                    .filter(c => c.doctorRole?.toLowerCase() === 'associate')
                    .slice((associatePage - 1) * effectivePageSize, associatePage * effectivePageSize)
                    .map((c, idx) => (
                      <CaseCard key={c.id} c={c} idx={idx} onSelect={setSelectedCase} isSelected={selectedCase?.id === c.id} />
                    ))
                  }
                  {filteredCases.filter(c => c.doctorRole?.toLowerCase() === 'associate').length === 0 && (
                    <div className="col-span-full py-10 bg-slate-50/50 rounded-[4px] border border-dashed border-slate-200 text-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Associate Submissions</p>
                    </div>
                  )}
                </div>
                {/* MOBILE PAGINATION: Bottom Elite Style */}
                <div className="sm:hidden flex items-center justify-center gap-2 pt-1">
                   <Button 
                     variant="outline" size="sm" 
                     disabled={associatePage === 1}
                     onClick={() => setAssociatePage(p => p - 1)}
                     className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border-slate-200 bg-white text-slate-600 rounded-[4px] hover:bg-slate-50"
                   >
                     PREV
                   </Button>
                   <div className="h-8 w-8 rounded-[4px] bg-amber-600 flex items-center justify-center">
                      <span className="text-[11px] font-black text-white">{associatePage}</span>
                   </div>
                   <Button 
                     variant="outline" size="sm"
                     disabled={associatePage * effectivePageSize >= filteredCases.filter(c => c.doctorRole?.toLowerCase() === 'associate').length}
                     onClick={() => setAssociatePage(p => p + 1)}
                     className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border-slate-200 bg-white text-slate-600 rounded-[4px] hover:bg-slate-50"
                   >
                     NEXT
                   </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating Review Modal */}
        <AnimatePresence>
          {selectedCase && (
            <div className="fixed inset-0 z-[250] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto pt-12 sm:pt-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={() => setSelectedCase(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-lg rounded-[4px] shadow-2xl overflow-hidden border border-slate-100"
              >
                <div className="bg-slate-900 px-5 sm:px-6 py-4 sm:py-5 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="h-9 w-9 sm:h-10 sm:w-10 bg-blue-600 rounded-[4px] flex items-center justify-center shadow-lg shadow-blue-500/30">
                       <ClipboardList size={18} className="text-white" />
                     </div>
                     <div>
                       <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-tight leading-none">Case Audit Hub</h3>
                       <p className="text-[9px] font-black text-blue-400 mt-1 uppercase tracking-widest">ID: #{selectedCase.id.slice(0, 10)}</p>
                     </div>
                  </div>
                  <button
                    onClick={() => setSelectedCase(null)}
                    className="h-8 w-8 rounded-[4px] bg-slate-800 hover:bg-red-500 flex items-center justify-center transition-colors group"
                  >
                    <XCircle className="h-5 w-5 text-slate-400 group-hover:text-white" />
                  </button>
                </div>

                <CardContent className="p-5 space-y-4 max-h-[88vh] overflow-y-auto">
                  {/* High-Level Info Grid - Glassmorphism */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-blue-50/80 backdrop-blur-md rounded-[4px] border border-blue-200/50 shadow-sm">
                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Patient Detail</p>
                      <div className="flex items-center gap-2.5">
                         <div className="h-9 w-9 rounded-[4px] bg-blue-600 border border-blue-400 flex items-center justify-center text-white shadow-lg">
                           <User size={16} />
                         </div>
                         <div>
                            <p className="font-black text-slate-900 text-[12px] sm:text-[13px] leading-none">{selectedCase.patientName}</p>
                            <p className="text-[9px] font-bold text-slate-500 mt-1">{selectedCase.patientMobile}</p>
                         </div>
                      </div>
                    </div>
                    <div className={`p-3.5 backdrop-blur-md rounded-[4px] border shadow-sm ${selectedCase.doctorRole?.toLowerCase() === 'associate' ? 'bg-amber-50/80 border-amber-200/50' : 'bg-indigo-50/80 border-indigo-200/50'}`}>
                      <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${selectedCase.doctorRole?.toLowerCase() === 'associate' ? 'text-amber-600' : 'text-indigo-600'}`}>
                        {selectedCase.doctorRole?.toLowerCase() === 'associate' ? 'Source Associate' : 'Source Doctor'}
                      </p>
                      <div className="flex items-center gap-2.5">
                         <div className={`h-9 w-9 rounded-[4px] border flex items-center justify-center text-white shadow-lg ${selectedCase.doctorRole?.toLowerCase() === 'associate' ? 'bg-amber-600 border-amber-400' : 'bg-indigo-600 border-indigo-400'}`}>
                           {selectedCase.doctorRole?.toLowerCase() === 'associate' ? <User size={16} /> : <ShieldCheck size={16} />}
                         </div>
                         <div>
                            <p className="font-black text-slate-900 text-[12px] sm:text-[13px] leading-none">{selectedCase.doctorName || 'Practitioner'}</p>
                            <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase">
                              {selectedCase.doctorRole?.toLowerCase() === 'associate' ? 'Role: Associate' : `Reg: ${selectedCase.doctorRegNo || 'PENDING'}`}
                            </p>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Treatment Detail Section - Enhanced for Associate Cases */}
                  <div className="p-3 bg-slate-50 rounded-[4px] border border-slate-100 flex flex-col gap-2.5 shadow-inner">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-slate-900 rounded-[4px] flex items-center justify-center text-white">
                             <ClipboardList size={16} />
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Clinical Procedure</p>
                             <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">
                                {selectedCase.treatmentName || selectedCase.treatment || 'Consultation Node'}
                             </h4>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Standard Fee</p>
                          <p className="text-lg font-black text-slate-900 tracking-tighter leading-none">
                             ₹{(selectedCase.clinicianFee || 
                                // Fallback mapping for associate cases if fee is 0
                                {
                                  'Dental Implant': 1500, 'Root Canal (RCT)': 800, 'Prophylaxis': 400,
                                  'Crown & Bridge': 600, 'Orthodontics': 1200, 'Complete Denture': 1000,
                                  'Scaling & Polishing': 300, 'Tooth Extraction': 500, 'Teeth Whitening': 700,
                                  'Composite Filling': 400
                                }[selectedCase.treatmentName || selectedCase.treatment] || 0
                             ).toLocaleString()}
                          </p>
                       </div>
                    </div>

                    {selectedCase.doctorRole?.toLowerCase() === 'associate' && (
                       <div className="flex items-center justify-between pt-3 border-t border-slate-200 border-dashed">
                          <div className="flex items-center gap-2">
                             <Award size={14} className="text-amber-500" />
                             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Associate Reward Node</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-100">
                                Bonus: ₹{(Number(selectedCase.points || 0) * 50).toLocaleString()}
                             </span>
                          </div>
                       </div>
                    )}
                  </div>

                  {/* Evidence Display */}
                  <div className="space-y-2">
                     <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Clinical Evidence Attachment</h4>
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-[4px] border border-blue-100 uppercase tracking-widest">Secure Link</span>
                     </div>
                     <div 
                       onClick={() => {
                         const url = (selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl || selectedCase.url || selectedCase.evidenceUrls?.[0]);
                         if (!url || typeof url !== 'string') return;
                         
                         // Detect PDF for direct tab opening
                         const urlLower = url.toLowerCase();
                         const isPdf = urlLower.includes('.pdf') || urlLower.includes('%2fpdf') || (urlLower.includes('alt=media') && !urlLower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$|%)/i));
                         
                         // Handle Base64 PDF opening via Blob for stability
                         if (isPdf && url.startsWith('data:application/pdf')) {
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
                           } catch (e) {
                             window.open(url, '_blank');
                           }
                         } else if (isPdf) {
                           window.open(url, '_blank');
                         } else {
                           setShowPreview(true);
                         }
                       }}
                       className="group relative h-40 bg-slate-50 rounded-[4px] overflow-hidden cursor-pointer border-2 border-dashed border-slate-200 hover:border-blue-400 transition-all flex items-center justify-center"
                     >
                        {(() => {
                          const url = (selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl || selectedCase.url || selectedCase.evidenceUrls?.[0]);
                          if (!url || typeof url !== 'string') {
                            return (
                              <div className="text-center">
                                 <ImageIcon size={40} className="text-slate-300 mx-auto mb-2" />
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">No Proof Synced</p>
                              </div>
                            );
                          }
                          
                          // Smart file type detection for Firebase Storage URLs
                          // Firebase URLs look like: ...%2Ffilename.pdf?alt=media&token=...
                          const urlLower = url.toLowerCase();
                          const isImageFile = urlLower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$|%)/i) || 
                                             urlLower.includes('%2f') && urlLower.includes('jpg') ||
                                             urlLower.includes('%2f') && urlLower.includes('png') ||
                                             urlLower.includes('%2f') && urlLower.includes('jpeg') ||
                                             urlLower.includes('%2f') && urlLower.includes('webp');
                          const isDocument = urlLower.includes('.pdf') || 
                                            urlLower.includes('%2fpdf') ||
                                            (urlLower.includes('alt=media') && !isImageFile);

                          if (isDocument || imageError) {
                            return (
                              <div className="flex flex-col items-center justify-center p-6 text-center w-full h-full bg-slate-50 transition-all hover:bg-blue-50/50">
                                <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-3 text-blue-600 border border-blue-100 shadow-sm">
                                  <FileText size={32} />
                                </div>
                                <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-1">Clinical Attachment Found</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Click to View Document</p>
                              </div>
                            );
                          }

                          return (
                            <>
                              <img 
                                src={url} 
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                alt=""
                                onError={() => setImageError(true)}
                              />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                                 <div className="h-12 w-12 rounded-[4px] bg-white flex items-center justify-center text-slate-900 shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                                    <Eye size={20} />
                                 </div>
                              </div>
                            </>
                          );
                        })()}
                     </div>
                  </div>

                  {/* Procedural Data - Cyan Morphism */}
                  <div className="space-y-3">
                     <div className="flex items-center gap-3 p-2.5 bg-cyan-50/80 backdrop-blur-md rounded-[4px] border border-cyan-200/50 shadow-sm">
                        <MapPin className="text-cyan-600" size={16} />
                        <div>
                           <p className="text-[9px] font-black text-cyan-600 uppercase tracking-widest">Clinic Geographic Node</p>
                           <p className="text-xs font-black text-cyan-900">{selectedCase.location || 'Location Not Recorded'}</p>
                        </div>
                     </div>
                     
                     {selectedCase.status === 'Submitted' && (
                        <div className="p-4 bg-indigo-50 rounded-[4px] border border-indigo-100 space-y-3 shadow-inner">
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Specialist Feedback</p>
                              <div className="flex items-center gap-2">
                                 <div className="h-5 w-5 rounded-[4px] bg-white border border-indigo-200 flex items-center justify-center">
                                    <ShieldCheck size={10} className="text-indigo-600" />
                                 </div>
                                 <span className="text-[9px] font-black text-slate-900">{selectedCase.solvedByName || 'Verified Specialist'}</span>
                              </div>
                           </div>
                           <p className="text-xs text-slate-700 italic leading-relaxed font-medium">"{selectedCase.clinicianNotes || 'Standard procedural workflow completed without anomalies.'}"</p>
                        </div>
                     )}
                  </div>

                  {/* Decision & Assignment Deck */}
                  <div className="pt-4 border-t border-slate-100 space-y-6">
                     {['Approved', 'Assigned', 'In Progress', 'Submitted'].includes(selectedCase.status) ? (
                        <div className="space-y-4">
                           {/* Status Banner */}
                           <div className={`h-14 rounded-[4px] border flex flex-col items-center justify-center font-black uppercase text-[10px] tracking-[0.2em] shadow-sm ${
                             selectedCase.status === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 
                             selectedCase.status === 'In Progress' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 
                             'bg-blue-50 border-blue-200 text-blue-600'
                           }`}>
                              <div className="flex items-center gap-2">
                                {selectedCase.status === 'Approved' ? <CheckCircle size={16} /> : <Users size={16} />}
                                {selectedCase.status === 'Approved' ? 'Settlement Authorized' : `Assigned to: ${selectedCase.clinicianName || 'Specialist'}`}
                              </div>
                              {selectedCase.status === 'In Progress' && <span className="text-[8px] mt-1 text-indigo-500 animate-pulse font-black">Specialist Node: Work in Progress</span>}
                           </div>

                           {/* Lock Indicator */}
                           <div className="bg-slate-50 p-6 rounded-[4px] border border-slate-200 border-dashed flex flex-col items-center justify-center text-center gap-3">
                              <div className="h-12 w-12 bg-white rounded-[4px] flex items-center justify-center text-slate-300 shadow-sm border border-slate-100">
                                 <ShieldCheck size={24} />
                              </div>
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Clinical Node Locked</p>
                                 <p className="text-[9px] font-medium text-slate-400 mt-1 max-w-[220px] mx-auto">This record is under specialist review. Original submission data is preserved and cannot be altered.</p>
                              </div>
                           </div>
                        </div>
                     ) : (
                        <div className="space-y-4">
                           {/* Action Buttons for Pending cases */}
                           <div className="grid grid-cols-2 gap-3">
                              <Button 
                                onClick={() => handleAction(selectedCase.id, 'reject')}
                                variant="outline" 
                                className="h-12 rounded-[4px] border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200 font-black uppercase text-[10px] tracking-widest transition-all"
                              >
                                Reject Case
                              </Button>
                              <Button 
                                onClick={() => handleAction(selectedCase.id, 'approve')}
                                className="h-12 rounded-[4px] bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
                              >
                                Instant Approve
                              </Button>
                           </div>

                           {/* Assignment Block for Associates */}
                           {selectedCase.doctorRole?.toLowerCase() === 'associate' ? (
                             <div className="space-y-3 bg-blue-50/50 p-3 rounded-[4px] border border-blue-100">
                               <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-2">
                                  <Users size={12} /> Specialist Assignment Node
                               </p>
                               <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consultation Fee (₹)</label>
                                 <div className="relative">
                                    <input 
                                      type="number"
                                      placeholder="150"
                                      className="w-full h-11 bg-white border border-slate-200 rounded-[4px] pl-8 px-4 text-xs font-bold focus:ring-4 focus:ring-blue-100 outline-none"
                                      value={clinicianFee}
                                      onChange={(e) => setClinicianFee(e.target.value)}
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-blue-600 text-xs">₹</span>
                                 </div>
                               </div>
                               <Button 
                                 onClick={() => setAssignmentModal({ open: true, caseId: selectedCase.id })}
                                 className="w-full h-12 bg-slate-900 hover:bg-blue-600 text-white rounded-[4px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all"
                               >
                                  {assignmentModal?.clinicianId ? 'Specialist Linked' : 'Select Specialist'}
                               </Button>
                             </div>
                           ) : (
                             <div className="space-y-4 bg-emerald-50/50 p-4 rounded-[4px] border border-emerald-100">
                               <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                                  <Activity size={12} /> Direct Reward Protocol
                               </p>
                               <div className="space-y-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Allocation Points</label>
                                 <input 
                                   type="number"
                                   placeholder="Points (e.g. 8)"
                                   className="w-full h-11 bg-white border border-slate-200 rounded-[4px] px-4 text-xs font-bold focus:ring-4 focus:ring-emerald-100 outline-none"
                                   value={points}
                                   onChange={(e) => setPoints(e.target.value)}
                                 />
                               </div>
                             </div>
                           )}
                        </div>
                     )}
                  </div>
                </CardContent>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Specialist Assignment Overlay */}
        <AnimatePresence>
          {assignmentModal?.open && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
                <motion.div 
                  initial={{ scale: 0.9, y: 30 }} 
                  animate={{ scale: 1, y: 0 }} 
                  className="bg-white rounded-[4px] p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100 relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-6 opacity-5">
                      <Users size={80} />
                   </div>
                   
                   <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Assign Specialist</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Source Security Verification Required</p>
                   </div>

                   <div className="space-y-4">
                      <div className="space-y-2.5">
                         <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center justify-between">
                            Available Specialists
                            <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-[2px]">{clinicians.length} Nodes</span>
                         </label>
                         
                         {/* Premium Searchable List */}
                         <div className="border-2 border-slate-100 rounded-[4px] overflow-hidden bg-slate-50/30">
                            <div className="p-2 border-b border-slate-100 bg-white">
                               <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                  <input 
                                    type="text" 
                                    placeholder="Filter by name..." 
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border-none rounded-[2px] text-[10px] font-bold focus:ring-2 focus:ring-blue-100 outline-none uppercase tracking-widest"
                                    value={clinicianSearch}
                                    onChange={(e) => setClinicianSearch(e.target.value)}
                                  />
                               </div>
                            </div>
                            
                            <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                               {/* Primary Submitter (Auto-suggested) */}
                               {clinicians.find(c => c.id === selectedCase?.doctorUid) && (!clinicianSearch || clinicians.find(c => c.id === selectedCase?.doctorUid)?.name?.toLowerCase().includes(clinicianSearch.toLowerCase())) && (
                                  <div 
                                    onClick={() => setSelectedClinician(selectedCase?.doctorUid)}
                                    className={`py-2 px-3 flex items-center justify-between cursor-pointer transition-all border-b border-slate-100/50 ${selectedClinician === selectedCase?.doctorUid ? 'bg-blue-600 text-white' : 'bg-blue-50/50 hover:bg-blue-100/50 text-slate-900'}`}
                                  >
                                     <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-[4px] flex items-center justify-center font-black text-[10px] shadow-sm border-2 ${selectedClinician === selectedCase?.doctorUid ? 'bg-white/20 border-white/40 text-white' : 'bg-blue-600 border-white text-white'}`}>
                                           {(() => {
                                              const cli = clinicians.find(c => c.id === selectedCase?.doctorUid);
                                              return cli?.avatarUrl || cli?.profileImage ? (
                                                <img src={cli.avatarUrl || cli.profileImage} className="h-full w-full object-cover" alt="" />
                                              ) : (cli?.name?.charAt(0) || 'D');
                                           })()}
                                        </div>
                                        <div>
                                           <p className="text-[10px] font-black uppercase tracking-tight leading-none mb-0.5">
                                              {clinicians.find(c => c.id === selectedCase?.doctorUid)?.name}
                                           </p>
                                           <p className={`text-[7px] font-black uppercase tracking-widest flex items-center gap-1 ${selectedClinician === selectedCase?.doctorUid ? 'text-blue-100' : 'text-blue-600'}`}>
                                              <ShieldCheck size={7} /> Primary Submitter
                                           </p>
                                        </div>
                                     </div>
                                     {selectedClinician === selectedCase?.doctorUid && <CheckCircle size={12} className="animate-in zoom-in" />}
                                  </div>
                               )}

                               {/* Other Clinicians */}
                               {clinicians
                                 .filter(c => c.id !== selectedCase?.doctorUid)
                                 .filter(c => !clinicianSearch || c.name?.toLowerCase().includes(clinicianSearch.toLowerCase()))
                                 .map((cli, cIdx) => (
                                  <div 
                                    key={cli.id}
                                    onClick={() => setSelectedClinician(cli.id)}
                                    className={`py-2 px-3 flex items-center justify-between cursor-pointer transition-all border-b border-slate-100/50 ${selectedClinician === cli.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-700'}`}
                                  >
                                     <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-[4px] flex items-center justify-center font-black text-[10px] shadow-sm border-2 ${
                                          selectedClinician === cli.id ? 'bg-white/10 border-white/10 text-white' : 
                                          ['bg-indigo-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600'][cIdx % 4] + ' border-white text-white'
                                        }`}>
                                           {cli.avatarUrl || cli.profileImage ? (
                                             <img src={cli.avatarUrl || cli.profileImage} className="h-full w-full object-cover" alt="" />
                                           ) : (cli.name?.charAt(0) || 'S')}
                                        </div>
                                        <div>
                                           <p className="text-[10px] font-black uppercase tracking-tight leading-none">
                                              {cli.name || 'Anonymous Specialist'}
                                           </p>
                                           {cli.registrationNumber ? (
                                             <p className={`text-[6px] font-bold mt-0.5 uppercase ${selectedClinician === cli.id ? 'text-slate-400' : 'text-slate-400'}`}>
                                                Lic: {cli.registrationNumber}
                                             </p>
                                           ) : (
                                             <p className={`text-[6px] font-bold mt-0.5 uppercase opacity-30`}>No Registration Node</p>
                                           )}
                                        </div>
                                     </div>
                                     {selectedClinician === cli.id && <CheckCircle size={12} className="text-blue-400 animate-in zoom-in" />}
                                  </div>
                               ))}

                               {clinicians.filter(c => !clinicianSearch || c.name?.toLowerCase().includes(clinicianSearch.toLowerCase())).length === 0 && (
                                 <div className="py-8 px-6 text-center bg-slate-50">
                                    <Users className="h-6 w-6 text-slate-200 mx-auto mb-1" />
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No matching nodes</p>
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>

                      <div className="space-y-2.5">
                         <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Assignment Fee Allocation (₹)</label>
                         <div className="relative">
                            <Input 
                              type="number"
                              value={clinicianFee}
                              onChange={(e) => setClinicianFee(Number(e.target.value))}
                              style={{ paddingLeft: '44px' }}
                              className="h-12 rounded-[4px] border-2 border-slate-100 font-black text-sm focus:ring-4 focus:ring-blue-100"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-600 pointer-events-none">₹</div>
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 pt-2">
                      <Button variant="outline" onClick={() => setAssignmentModal(null)} className="h-12 rounded-[4px] text-[10px] font-black uppercase tracking-[0.2em] border-slate-200">Decline</Button>
                      <Button 
                        onClick={handleAssign} 
                        isLoading={loading === 'assigning'} 
                        className="h-12 rounded-[4px] bg-slate-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-300"
                      >
                        Confirm Assignment
                      </Button>
                   </div>
                </motion.div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Lightbox for Evidence Inspection */}
        <AnimatePresence>
          {showPreview && selectedCase && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] flex items-center justify-center p-8 bg-slate-950/95 backdrop-blur-2xl"
              onClick={() => setShowPreview(false)}
            >
              <Button 
                 onClick={() => setShowPreview(false)}
                 className="absolute top-8 right-8 h-12 w-12 rounded-[4px] bg-white/10 hover:bg-red-500 text-white backdrop-blur-md transition-all z-[510]"
              >
                 <XCircle size={24} />
              </Button>
              
              <div className="max-w-4xl w-full h-full flex items-center justify-center">
                {(() => {
                  const url = (selectedCase.evidenceUrl || selectedCase.proofUrl || selectedCase.imageUrl || selectedCase.url || selectedCase.evidenceUrls?.[0]);
                  const urlLower2 = url?.toLowerCase() || '';
                  const isImageFile2 = urlLower2.match(/\.(jpg|jpeg|png|gif|webp)(\?|$|%)/i) ||
                                      (urlLower2.includes('%2f') && (urlLower2.includes('jpg') || urlLower2.includes('png') || urlLower2.includes('jpeg') || urlLower2.includes('webp')));
                  const isPdf = urlLower2.includes('.pdf') || 
                               urlLower2.includes('%2fpdf') ||
                               (urlLower2.includes('alt=media') && !isImageFile2);

                  if (isPdf) {
                    const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
                    return (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-[4px] overflow-hidden relative shadow-2xl">
                        <iframe 
                          src={viewerUrl} 
                          className="w-full h-full border-none"
                          title="Clinical Document Preview"
                        />
                        <div className="absolute top-4 left-4 bg-blue-600 px-3 py-1.5 rounded-[4px] flex items-center gap-2 shadow-lg z-10 pointer-events-none">
                           <FileText size={14} className="text-white" />
                           <span className="text-[10px] font-black text-white uppercase tracking-widest">Enhanced PDF Node</span>
                        </div>
                        <div className="absolute bottom-6 right-6 flex gap-2">
                            <Button 
                             onClick={(e) => {
                               e.stopPropagation();
                               if (url.startsWith('data:application/pdf')) {
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
                                  } catch (err) {
                                    window.open(url, '_blank');
                                  }
                               } else {
                                 window.open(url, '_blank');
                               }
                             }}
                             className="h-10 px-6 rounded-[4px] bg-slate-900 hover:bg-black text-white font-black uppercase text-[9px] tracking-widest shadow-2xl border border-white/10"
                            >
                             <ExternalLink size={14} className="mr-2" /> Download Original
                            </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="max-w-4xl w-full h-full flex items-center justify-center">
                      {(isPdf || imageError) ? (
                        <div className="flex flex-col items-center gap-6 p-12 bg-white/5 rounded-[4px] border border-white/10 backdrop-blur-xl">
                          <div className="h-32 w-32 bg-blue-500/20 rounded-[4px] flex items-center justify-center text-blue-400 border border-blue-500/30 shadow-2xl">
                            <FileText size={64} />
                          </div>
                          <div className="text-center">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Clinical Document Node</h3>
                            <p className="text-sm text-slate-400 mt-2 font-medium">This file is a document or the image failed to load.</p>
                          </div>
                          <Button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (url.startsWith('data:application/pdf')) {
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
                                 } catch (err) {
                                   window.open(url, '_blank');
                                 }
                              } else {
                                window.open(url, '_blank');
                              }
                            }}
                            className="h-16 px-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-blue-500/40"
                          >
                            Open Document in New Tab
                          </Button>
                        </div>
                      ) : (
                        <motion.img 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          src={url} 
                          className="max-w-full max-h-full object-contain rounded-[4px] shadow-2xl border border-white/10"
                          onError={() => setImageError(true)}
                        />
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generic Response Modal */}
        <AnimatePresence>
          {modalState.open && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setModalState(prev => ({ ...prev, open: false }))}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} 
                animate={{ scale: 1, y: 0 }} 
                className="bg-white rounded-[4px] p-10 max-w-md w-full shadow-2xl text-center space-y-6"
                onClick={e => e.stopPropagation()}
              >
                <div className={`h-20 w-20 rounded-2xl mx-auto flex items-center justify-center ${
                  modalState.type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-600'
                }`}>
                   {modalState.type === 'warning' ? <Filter size={40} /> : <ShieldCheck size={40} />}
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{modalState.title}</h3>
                   <p className="text-sm font-medium text-slate-500 mt-4 leading-relaxed">{modalState.message}</p>
                </div>
                <Button 
                  onClick={() => setModalState(prev => ({ ...prev, open: false }))}
                  className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-transform"
                >
                  Confirm Awareness
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Suspense>
  </DashboardLayout>
);
}

export default function CaseReview() {
  return <CaseReviewContent />;
}

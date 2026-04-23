'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { 
  ShieldCheck, Loader2, Zap, CheckCircle2, ChevronRight,
  FileText, Trash2, ArrowLeft, Play,
  Image as ImageIcon, Eye, AlertCircle, Activity, Paperclip, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { fetchCaseById, submitClinicianWork, startCaseWork } from '@/lib/firestore';
import toast from 'react-hot-toast';

const EvidencePreview = ({ url }: { url: string }) => {
  const [isError, setIsError] = useState(false);
  const [processedUrl, setProcessedUrl] = useState<string>(url);
  const isPdf = url?.toLowerCase().includes('.pdf') || url?.toLowerCase().includes('application/pdf') || url?.toLowerCase().startsWith('data:application/pdf');

  useEffect(() => {
    if (url && url.startsWith('data:')) {
      try {
        const parts = url.split(';base64,');
        if (parts.length === 2) {
          const contentType = parts[0].split(':')[1];
          const byteCharacters = atob(parts[1]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: contentType });
          const bUrl = URL.createObjectURL(blob);
          setProcessedUrl(bUrl);
          return () => URL.revokeObjectURL(bUrl);
        }
      } catch (e) {
        setProcessedUrl(url);
      }
    } else {
      setProcessedUrl(url);
    }
  }, [url]);

  const handleOpen = () => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.opener = null;
      newWindow.location.href = processedUrl;
    }
  };

  if (isPdf) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded-[4px] gap-4 shadow-xl">
        <div className="h-12 w-12 bg-blue-500/10 rounded-[4px] flex items-center justify-center text-blue-400 border border-blue-500/20">
          <FileText size={24} />
        </div>
        <div className="text-center">
          <p className="text-[9px] font-black text-white uppercase tracking-[0.2em] leading-none">Diagnostic PDF Node</p>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-2">Document proof detected</p>
        </div>
        <Button onClick={handleOpen} className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] uppercase tracking-widest px-6 rounded-[4px] h-10 shadow-lg shadow-blue-500/20">Open Document <ChevronRight size={14} className="ml-2" /></Button>
      </div>
    );
  }

  return (
    <div className="relative group rounded-[4px] overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center">
      {!isError ? (
        <img src={url} alt="Proof" onError={() => setIsError(true)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      ) : (
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <AlertCircle size={40} strokeWidth={1} />
          <p className="text-[8px] font-black uppercase tracking-[0.3em]">Identity Proof Unavailable</p>
        </div>
      )}
      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3">
         <Button onClick={handleOpen} className="bg-white text-slate-900 font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 hover:text-white rounded-[4px] px-6 h-9"><Eye size={14} className="mr-2" /> Enlarge View</Button>
      </div>
    </div>
  );
};

export default function ClinicianWorkPage() {
  const params = useParams();
  const caseId = params.id as string;
  const router = useRouter();
  const { user, userData } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startingWork, setStartingWork] = useState(false);
  const [caseData, setCaseData] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const loadCase = async (silent = false) => {
    if (!silent) setLoading(true);
    const data = await fetchCaseById(caseId) as any;
    if (data) {
      setCaseData(data);
      setNotes(data.clinicianNotes || '');
    } else {
      toast.error("Case not found");
      router.push('/clinician/cases?status=Assigned');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const handleStartWork = async () => {
    setStartingWork(true);
    const res = await startCaseWork(caseId);
    if (res.success) {
      toast.success("Case Protocol Activated!");
      await loadCase(true);
    } else {
      toast.error("Failed to start work");
    }
    setStartingWork(false);
  };

  const processFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
              if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
        };
        reader.onerror = (error) => reject(error);
      } else {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !caseData.finalProof) {
      toast.error("Please attach Final Treatment Proof");
      return;
    }
    setSubmitting(true);
    const toastId = toast.loading("Processing Clinical Evidence...");
    try {
      let finalProofUrl = caseData.finalProof || '';
      if (selectedFile) {
        finalProofUrl = await processFile(selectedFile);
        toast.loading("Finalizing Global Registry...", { id: toastId });
      }
      const solvedDetails = { name: userData?.name || user?.displayName || 'Dr. Specialist', regNo: userData?.regNo || '' };
      const res = await submitClinicianWork(caseId, finalProofUrl, notes, solvedDetails);
      if (res.success) {
        toast.success("Clinical Node Resolved!", { id: toastId });
        router.push('/clinician/cases?status=Submitted');
      } else {
        toast.error(res.error || "Submission failed", { id: toastId });
      }
    } catch (err) {
      toast.error("Global Registry Error", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !caseData) {
    return (
      <DashboardLayout>
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-blue-600 h-10 w-10" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse italic">Accessing Workspace...</p>
        </div>
      </DashboardLayout>
    );
  }

  const isCompleted = caseData?.status === 'Submitted' || caseData?.status === 'Approved';
  const isInProgress = caseData?.status === 'In Progress';
  const isAssigned = caseData?.status === 'Assigned';
  const isPending = caseData?.status === 'Pending';
  
  // NEW: Hardened Security & Logic Lock
  // If the user is the SUBMITTER but NOT the assigned clinician, and it's already assigned, LOCK it.
  const isViewOnly = caseData?.doctorUid === user?.uid && 
                     caseData?.clinicianId !== user?.uid && 
                     caseData?.status !== 'Pending';

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6 pb-6 px-2 sm:px-0">
        
        {/* Compact Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 sm:gap-6 pb-6 px-1 sm:px-0">
           <div className="space-y-4 w-full lg:w-auto">
              <button onClick={() => router.back()} className="group hidden sm:flex items-center gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-all">
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Registry
              </button>
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 sm:h-12 sm:w-12 bg-slate-900 rounded-[4px] flex items-center justify-center text-white shadow-2xl shrink-0"><ShieldCheck size={20} /></div>
                 <div className="min-w-0">
                    <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase truncate leading-none mb-1.5">Patient: {caseData.patientName}</h1>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                       <span className={`px-2 py-0.5 rounded-[4px] text-[7px] sm:text-[8px] font-black uppercase tracking-widest border shadow-sm ${
                          isAssigned ? 'bg-amber-50 text-amber-600 border-amber-200' :
                          isInProgress ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-emerald-50 text-emerald-600 border-emerald-200'
                       }`}>{caseData.status}</span>
                       <span className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-[4px] border border-slate-100 shadow-inner">Node: {caseData.customCaseId || caseId.slice(0, 8).toUpperCase()}</span>
                       <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-600 rounded-[4px] shadow-lg shadow-blue-200 ring-1 ring-blue-400/20">
                          <span className="text-[7px] sm:text-[8px] font-black text-white uppercase tracking-widest">Fee: ₹{(caseData.clinicianFee || 0).toLocaleString()}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
 
           <div className="flex items-center gap-4 bg-white p-4 sm:p-5 rounded-[4px] border border-slate-100 shadow-2xl shadow-slate-200/50 w-full lg:w-auto justify-between lg:justify-start">
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-50 rounded-[4px] flex items-center justify-center text-blue-600 shadow-inner"><Activity size={20} /></div>
                 <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Settlement Potential</p>
                    <p className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-none">₹{caseData.clinicianFee?.toLocaleString()}</p>
                 </div>
              </div>
           </div>
        </div>
 
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* LEFT COLUMN: Dossier + Evidence Stack */}
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} className="p-[1px] rounded-[4px] bg-slate-200 shadow-2xl border-t-4 border-t-blue-600">
              <Card className="border-none rounded-[4px] overflow-hidden bg-white">
                <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
                   <h3 className="text-[9px] sm:text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-3">
                      <FileText size={16} className="text-blue-600" /> Case Dossier
                   </h3>
                </div>
                <div className="p-4 sm:p-8 space-y-5 sm:space-y-8">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                      <div className="flex flex-col gap-1">
                         <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Patient Identity</Label>
                         <p className="text-sm sm:text-lg font-black text-slate-900 uppercase leading-none">{caseData.patientName}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                         <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Assigned Protocol</Label>
                         <p className="text-sm sm:text-lg font-black text-slate-900 uppercase leading-none">{caseData.treatment}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                         <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Global Node ID</Label>
                         <div className="flex">
                            <span className="text-[9px] sm:text-[11px] font-black text-blue-400 uppercase tracking-widest bg-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-[4px] border border-slate-800 shadow-xl">
                               #{caseData.customCaseId || caseData.id.slice(0, 10).toUpperCase()}
                            </span>
                         </div>
                      </div>
                      <div className="flex flex-col gap-1">
                         <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Clinical Credentials</Label>
                         <p className="text-[9px] sm:text-[10px] font-black text-slate-700 uppercase tracking-tight truncate">{caseData.clinicianRegNo || userData?.regNo || 'PENDING AUTH'}</p>
                      </div>
                   </div>

                   <div className="space-y-3 pt-2">
                      <Label className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Diagnostic Narrative</Label>
                      <div className="p-3 sm:p-5 bg-slate-50 rounded-[4px] border border-slate-100 text-[10px] sm:text-[12px] font-bold text-slate-600 leading-relaxed italic shadow-inner">
                         "{caseData.notes || 'No specific clinical notes provided.'}"
                      </div>
                   </div>
                </div>
              </Card>
            </motion.div>


            <motion.div initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="p-[1px] rounded-[4px] bg-slate-900 shadow-2xl">
              <Card className="border-none rounded-[4px] overflow-hidden bg-white">
                 <div className="bg-slate-900 p-5 flex items-center justify-between">
                    <h3 className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] flex items-center gap-3">
                       <ImageIcon size={16} /> Diagnostic Evidence Node
                    </h3>
                 </div>
                 <div className="p-6 sm:p-8">
                    {caseData.initialProof || caseData.evidenceUrl ? (
                      <EvidencePreview url={caseData.initialProof || caseData.evidenceUrl} />
                    ) : (
                      <div className="h-32 sm:h-40 rounded-[4px] bg-slate-50 border-2 border-dashed border-slate-100 flex items-center justify-center italic text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] shadow-inner">
                         Evidence Missing in Registry
                      </div>
                    )}
                 </div>
              </Card>
            </motion.div>
          </div>

          {/* RIGHT COLUMN: Action Terminal */}
          <div className="space-y-6">
            {isViewOnly ? (
               <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="h-full">
                  <Card className="border border-slate-200 shadow-2xl p-8 sm:p-12 text-center space-y-6 bg-slate-50/50 backdrop-blur-sm border-dashed rounded-[4px]">
                     <div className="h-14 w-14 sm:h-16 sm:w-16 bg-white rounded-[4px] flex items-center justify-center text-slate-400 mx-auto shadow-inner">
                        <ShieldCheck size={28} />
                     </div>
                     <div className="space-y-3">
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">Registry Node Locked</h2>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-widest max-w-xs mx-auto leading-relaxed">Assigned to a specialist. updates are restricted to the assigned clinical node.</p>
                     </div>
                     <div className="pt-6 border-t border-slate-200/60">
                        <p className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">Node Status: {caseData.status}</p>
                     </div>
                  </Card>
               </motion.div>
            ) : isCompleted ? (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-[1px] rounded-[4px] bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl h-full">
                <Card className="border-none rounded-[4px] overflow-hidden bg-white h-full flex flex-col">
                  <div className="bg-emerald-600 p-5 flex items-center justify-between shadow-xl shadow-emerald-500/20">
                     <h3 className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                        <CheckCircle2 size={18} /> Resolution Secured
                     </h3>
                  </div>
                  <div className="p-8 sm:p-10 space-y-10 flex-grow">
                      <div className="p-6 bg-emerald-50 rounded-[4px] border border-emerald-100 flex items-center gap-4 shadow-inner">
                         <div className="h-10 w-10 bg-emerald-500 rounded-[4px] flex items-center justify-center text-white shadow-xl"><CheckCircle2 size={22} /></div>
                         <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight leading-relaxed">Technical resolution manifest has been synchronized with the master ledger.</p>
                      </div>
                      <div className="space-y-5">
                          <div className="flex items-center justify-between">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Resolved Technical Proof</Label>
                            <div className="text-right">
                               <p className="text-[8px] font-black text-slate-900 uppercase">{caseData.solvedByName || 'Specialist Verified'}</p>
                               {caseData.solvedByRegNo && <p className="text-[7px] font-bold text-blue-600 uppercase tracking-widest">Reg: {caseData.solvedByRegNo}</p>}
                            </div>
                          </div>
                          <EvidencePreview url={caseData.finalProof} />
                       </div>
                  </div>
                </Card>
              </motion.div>
            ) : isAssigned ? (
               <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex items-center justify-center">
                  <Card className="border border-slate-200 shadow-2xl p-8 sm:p-12 text-center space-y-8 bg-white/50 backdrop-blur-xl border-dashed rounded-[4px] w-full">
                     <div className="h-16 w-16 sm:h-20 sm:w-20 bg-amber-500/10 rounded-[4px] flex items-center justify-center text-amber-600 mx-auto animate-pulse">
                        <Play size={32} />
                     </div>
                     <div className="space-y-3">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Activate Protocol</h2>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium max-w-xs mx-auto leading-relaxed uppercase">Review the dossier and activate the clinical treatment protocol for this patient.</p>
                     </div>
                     <Button onClick={handleStartWork} disabled={startingWork} className="w-full h-14 sm:h-16 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs sm:text-sm uppercase tracking-[0.2em] shadow-xl shadow-amber-200 active:scale-95 transition-all">
                        {startingWork ? <Loader2 className="animate-spin mr-3" /> : <Play size={18} fill="currentColor" className="mr-3" />}
                        {startingWork ? 'Activating...' : 'Start Clinical Work'}
                     </Button>
                  </Card>
               </motion.div>
            ) : isPending ? (
               <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex items-center justify-center">
                  <Card className="border border-slate-200 shadow-2xl p-8 sm:p-12 text-center space-y-8 bg-slate-50/50 backdrop-blur-xl border-dashed rounded-[4px] w-full">
                     <div className="h-16 w-16 sm:h-20 sm:w-20 bg-slate-200 rounded-[4px] flex items-center justify-center text-slate-400 mx-auto">
                        <AlertCircle size={32} />
                     </div>
                     <div className="space-y-3">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Protocol Awaiting Assignment</h2>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium max-w-xs mx-auto leading-relaxed uppercase">This case is currently in the pending registry. Resolution terminal will be unlocked once assigned to a specialist.</p>
                     </div>
                     <div className="pt-6 border-t border-slate-200 w-full text-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Registry Status: PENDING</span>
                     </div>
                  </Card>
               </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} className="p-[1px] rounded-[4px] bg-blue-600 shadow-2xl h-full">
                <Card className="border-none rounded-[4px] overflow-hidden bg-white h-full flex flex-col">
                  <div className="bg-blue-600 p-5 flex items-center justify-between shadow-xl shadow-blue-500/20">
                     <h3 className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                        <Zap size={18} /> Resolution Terminal
                     </h3>
                     <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-[4px] bg-blue-200 animate-pulse" />
                        <span className="text-[8px] font-black text-blue-100 uppercase tracking-widest">Master Node</span>
                     </div>
                  </div>
                  <div className="p-6 sm:p-10 h-full flex flex-col">
                    <form onSubmit={handleSubmit} className="space-y-8 flex-grow">
                      <div className="space-y-4">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Treatment Resolution (Photo/PDF)</Label>
                        <div className="relative h-48 sm:h-64 rounded-[4px] border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center gap-4 p-5 overflow-hidden group shadow-inner">
                           {previewUrl ? (
                             <img src={previewUrl} className="w-full h-full object-contain rounded-[4px]" alt="Preview" />
                           ) : (
                             <>
                                <div className="h-12 w-12 bg-white rounded-[4px] flex items-center justify-center shadow-xl text-blue-600 group-hover:scale-110 transition-transform"><Paperclip size={24} /></div>
                                <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest text-center leading-tight">{fileName || 'Attach treatment proof node'}</p>
                             </>
                           )}
                           <input type="file" accept="image/*,application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 ml-1">Technical Dossier Remarks</Label>
                        <div className="relative">
                          <Textarea 
                            placeholder="Detailed treatment specifics for clinical audit..." 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)} 
                            className="h-32 sm:h-44 rounded-[4px] bg-slate-50 border-slate-200 focus:bg-white text-xs sm:text-sm shadow-inner p-5 font-bold" 
                          />
                        </div>
                      </div>

                      <Button type="submit" disabled={submitting} className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] sm:text-xs uppercase tracking-[0.3em] shadow-2xl shadow-blue-200 active:scale-[0.98] transition-all rounded-[4px]">
                        {submitting ? <Loader2 className="animate-spin mr-3" /> : <Zap className="mr-3 text-amber-400 size-5" />}
                        {submitting ? 'DISPATCHING NODE...' : 'Submit Resolution Report'}
                      </Button>
                    </form>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}

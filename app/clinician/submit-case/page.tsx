'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { 
  ShieldCheck, User, Phone, ClipboardList, Calendar, 
  Loader2, Zap, Info, CheckCircle2, ChevronRight, Calculator,
  Activity, MapPin, FileImage, Trash2, FileText, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { db } from '@/lib/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { submitNewCase } from '@/lib/firestore';
import toast from 'react-hot-toast';

const TREATMENTS = [
  { id: 'implant', name: 'Dental Implant', fee: 1500, value: '₹1,500.00' },
  { id: 'rct', name: 'Root Canal (RCT)', fee: 800, value: '₹800.00' },
  { id: 'prophylaxis', name: 'Prophylaxis', fee: 400, value: '₹400.00' },
  { id: 'crown', name: 'Crown & Bridge', fee: 600, value: '₹600.00' },
  { id: 'ortho', name: 'Orthodontics', fee: 1200, value: '₹1,200.00' },
  { id: 'denture', name: 'Complete Denture', fee: 1000, value: '₹1,000.00' },
  { id: 'scaling', name: 'Scaling & Polishing', fee: 300, value: '₹300.00' },
  { id: 'extraction', name: 'Tooth Extraction', fee: 500, value: '₹500.00' },
  { id: 'whitening', name: 'Teeth Whitening', fee: 700, value: '₹700.00' },
  { id: 'composite', name: 'Composite Filling', fee: 400, value: '₹400.00' }
];

const CLINICIAN_GUIDELINES = [
  "Use this portal for cases from your own practice list.",
  "Ensure all patient clinical records are accurately attached.",
  "Fee settlement is processed post-admin clinical audit.",
  "Self-submitted cases follow the standard approval workflow."
];

export default function ClinicianSubmitCase() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isTreatmentOpen, setIsTreatmentOpen] = useState(false);
  const [formData, setFormData] = useState({
    patientName: '',
    patientMobile: '',
    treatment: '',
    caseDate: '',
    notes: '',
    evidenceName: '',
    location: '',
    treatmentCharge: ''
  });

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      caseDate: new Date().toISOString().split('T')[0]
    }));
  }, []);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedEvidence, setProcessedEvidence] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const selectedTreatment = TREATMENTS.find(t => t.id === formData.treatment);
  const calculatedSettlement = Number(formData.treatmentCharge || 0);


  const processFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        if (file.type === 'application/pdf') {
            resolve(event.target?.result as string);
            return;
        }
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Session expired");
      return;
    }
    
    // --- STRICT VALIDATION ---
    if (!formData.patientName.trim()) {
      toast.error("Patient Name is required");
      return;
    }
    if (formData.patientName.trim().length < 3) {
      toast.error("Please enter a valid Full Name (min 3 letters)");
      return;
    }
    if (!formData.patientMobile) {
      toast.error("Mobile number is required");
      return;
    }
    if (formData.patientMobile.length !== 10) {
      toast.error("Mobile number must be exactly 10 digits");
      return;
    }
    if (!formData.treatment) {
      toast.error("Please select a Clinical Procedure");
      return;
    }
    if (!formData.caseDate) {
      toast.error("Please select an Observation Date");
      return;
    }
    if (!formData.location.trim()) {
      toast.error("Clinical Location is required");
      return;
    }
    if (!selectedFile) {
      toast.error("Please attach Diagnostic Evidence (X-Ray/Proof)");
      return;
    }
    if (!formData.notes.trim()) {
      toast.error("Please add some Clinical Remarks/Notes");
      return;
    }
    // --- END VALIDATION ---

    // 🚀 MICRO-SECOND OPTIMISTIC UI
    const toastId = toast.loading("SYNCING CLINICAL NODE...", {
      style: { background: '#0f172a', color: '#fff', borderLeft: '4px solid #3b82f6' }
    });
    setLoading(true);

    try {
      // ⚡ Use pre-processed evidence if available, otherwise process now (fallback)
      let evidenceUrl = processedEvidence;
      if (!evidenceUrl && selectedFile) {
        evidenceUrl = await processFile(selectedFile);
      }

      const caseData = {
        ...formData,
        treatmentCharge: Number(formData.treatmentCharge) || 0,
        doctorUid: user.uid,
        doctorName: userData?.displayName || userData?.name || 'Dr. Specialist',
        doctorRegNo: userData?.regNo || '',
        initialProof: evidenceUrl, // Correct field for firestore
        treatmentName: selectedTreatment?.name || formData.treatment,
        clinicianFee: 0, // Admin will assign this later
        status: 'Pending',
        submittedBy: 'clinician',
        clinicianSubmitted: true,
        clinicianId: user.uid, 
        location: formData.location || userData?.clinicName || 'Clinician Hub',
        submittedAt: serverTimestamp()
      };

      // ⚡ Instant form clear for "Micro-second" feel
      const resetForm = () => {
        setFormData({
            patientName: '',
            patientMobile: '',
            treatment: '',
            caseDate: new Date().toISOString().split('T')[0],
            notes: '',
            evidenceName: '',
            location: '',
            treatmentCharge: ''
        });
        setSelectedFile(null);
        setProcessedEvidence('');
      };

      // Execute submission
      const res = await submitNewCase(user.uid, caseData);
      
      if (!res.success) throw new Error(res.error || "Sync Failed");
      
      toast.success("CASE ARCHIVED SUCCESSFULLY", { id: toastId });
      resetForm();
      
    } catch (err: any) {
      toast.error(err.message || "Process aborted", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-6">
        
        {/* Professional Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 sm:gap-6 px-1 sm:px-0">
          <div className="space-y-1 sm:space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-slate-900 text-[8px] font-black uppercase tracking-widest text-blue-400 border border-slate-800">
               <Activity size={10} className="animate-pulse" /> Submission Node Active
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Submit <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Clinical Case</span>
            </h1>
            <p className="text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">
               Register personal practice outcomes directly
            </p>
          </div>
          
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-[4px] bg-white border border-slate-100 shadow-xl w-fit">
             <div className="h-1.5 w-1.5 rounded-[4px] bg-emerald-500 animate-pulse" />
             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Protocol Sync Ready</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
           <div className="xl:col-span-8 px-1 sm:px-0">
              <Card className="border-slate-200 shadow-2xl shadow-slate-200/50 rounded-[4px] overflow-hidden bg-white">
                <CardContent className="p-5 sm:p-10">
                  <form onSubmit={handleSubmit} className="space-y-10">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                      {/* Patient Name */}
                      <div className="space-y-3">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 ml-1">
                           <User size={12} className="text-blue-500" /> Patient Full Name
                        </Label>
                        <Input 
                          placeholder="ENTER FULL NAME" 
                          required 
                          value={formData.patientName}
                          onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                          className="h-12 rounded-[4px] bg-slate-50 border-slate-100 focus:bg-white transition-all text-sm font-bold shadow-inner"
                        />
                      </div>

                      {/* Patient Mobile */}
                      <div className="space-y-3">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 ml-1">
                           <Phone size={12} className="text-blue-500" /> Contact Number
                        </Label>
                        <Input 
                          placeholder="10-DIGIT MOBILE" 
                          required 
                          maxLength={10}
                          value={formData.patientMobile}
                          onChange={(e) => setFormData({...formData, patientMobile: e.target.value.replace(/\D/g, '')})}
                          className="h-12 rounded-[4px] bg-slate-50 border-slate-100 focus:bg-white transition-all text-sm font-bold shadow-inner"
                        />
                      </div>

                      {/* Treatment Selection - CUSTOM DROPDOWN */}
                      <div className="space-y-3 relative">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 ml-1">
                           <ClipboardList size={12} className="text-blue-500" /> Clinical Procedure
                        </Label>
                        <div className="relative">
                           <div 
                             onClick={() => setIsTreatmentOpen(!isTreatmentOpen)}
                             className={`h-12 w-full rounded-[4px] border flex items-center justify-between px-4 cursor-pointer transition-all font-bold text-sm shadow-inner ${
                               isTreatmentOpen ? 'border-blue-400 bg-white ring-4 ring-blue-100/50' : 'border-slate-100 bg-slate-50'
                             }`}
                           >
                             <span className={formData.treatment ? "text-slate-900" : "text-slate-400"}>
                               {formData.treatment ? TREATMENTS.find(t => t.id === formData.treatment)?.name : "SELECT PROTOCOL"}
                             </span>
                             <ChevronRight size={16} className={`text-slate-400 transition-transform duration-300 ${isTreatmentOpen ? 'rotate-90' : 'rotate-0'}`} />
                           </div>

                           <AnimatePresence mode="wait">
                            {isTreatmentOpen && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 8, scale: 1 }}
                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="absolute top-full left-0 right-0 z-[100] bg-white border border-slate-200 rounded-[4px] shadow-2xl overflow-hidden"
                              >
                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Select Procedure</p>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                  {TREATMENTS.map((t) => (
                                    <div 
                                      key={t.id}
                                      onClick={() => {
                                        setFormData({...formData, treatment: t.id});
                                        setIsTreatmentOpen(false);
                                      }}
                                      className={`px-4 py-3 text-xs font-bold cursor-pointer transition-all flex items-center justify-between hover:bg-blue-50 hover:text-blue-600 ${
                                        formData.treatment === t.id ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
                                      }`}
                                    >
                                      <span>{t.name}</span>
                                      {formData.treatment === t.id && <CheckCircle2 size={12} className="text-blue-600" />}
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Case Date */}
                      <div className="space-y-3">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 ml-1">
                           <Calendar size={12} className="text-blue-500" /> Observation Date
                        </Label>
                        <Input 
                          type="date" 
                          required 
                          value={formData.caseDate}
                          onChange={(e) => setFormData({...formData, caseDate: e.target.value})}
                          className="h-12 rounded-[4px] bg-slate-50 border-slate-100 focus:bg-white transition-all font-bold text-sm shadow-inner"
                        />
                      </div>

                      {/* Location */}
                      <div className="space-y-3">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 ml-1">
                           <MapPin size={12} className="text-blue-500" /> Clinical Node
                        </Label>
                        <Input 
                          placeholder="PRACTICE LOCATION" 
                          required 
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                          className="h-12 rounded-[4px] bg-slate-50 border-slate-100 focus:bg-white transition-all text-sm font-bold shadow-inner"
                        />
                      </div>

                      {/* Treatment Charge */}
                      <div className="space-y-3">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 ml-1">
                           <Zap size={12} className="text-emerald-500" /> Treatment Charge (₹)
                        </Label>
                        <Input 
                          type="number"
                          placeholder="e.g. 5000" 
                          required 
                          value={formData.treatmentCharge}
                          onChange={(e) => setFormData({...formData, treatmentCharge: e.target.value})}
                          className="h-12 rounded-[4px] bg-slate-50 border-slate-100 focus:bg-white transition-all text-sm font-bold shadow-inner"
                        />
                      </div>
                    </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                      {/* Evidence Upload */}
                      <div className="space-y-4">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                           Diagnostic Evidence (X-Ray / Proof)
                        </Label>
                        <div className="relative group">
                          <div className="w-full h-32 sm:h-40 rounded-[4px] border-2 border-dashed border-slate-100 bg-slate-50/80 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-white transition-all cursor-pointer overflow-hidden p-4 shadow-inner">
                             <div className="h-9 w-9 sm:h-10 sm:w-10 bg-white rounded-[4px] flex items-center justify-center shadow-lg text-blue-600 group-hover:scale-110 transition-transform">
                                <FileImage size={18} />
                             </div>
                             <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-tight">
                               {formData.evidenceName || "Dispatch File Node"} <br/>
                               <span className="text-[7px] opacity-60">X-RAY, PDF OR IMG</span>
                             </p>
                             <input 
                               type="file" 
                               accept="image/*,application/pdf"
                               className="absolute inset-0 opacity-0 cursor-pointer"
                               onChange={async (e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                    setSelectedFile(file);
                                    setFormData({...formData, evidenceName: file.name});
                                    // ⚡ Pre-process immediately for micro-second submission later
                                    setIsProcessingFile(true);
                                    try {
                                        const processed = await processFile(file);
                                        setProcessedEvidence(processed);
                                    } catch (err) {
                                        console.error("Pre-process error", err);
                                    } finally {
                                        setIsProcessingFile(false);
                                    }
                                 }
                               }}
                             />
                             {formData.evidenceName && (
                                <button type="button" onClick={() => { setSelectedFile(null); setFormData({...formData, evidenceName: ''}); }} className="mt-1 text-[8px] font-black text-red-500 uppercase flex items-center gap-1 bg-white px-2 py-1 rounded-[4px] shadow-sm border border-red-50"><Trash2 size={10} /> Delete</button>
                             )}
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-4">
                        <Label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                           Dossier Remarks
                        </Label>
                        <Textarea 
                          placeholder="MENTION CLINICAL SPECIFICS..." 
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          className="h-32 sm:h-40 rounded-[4px] bg-slate-50/80 border-slate-100 focus:bg-white transition-all font-bold p-5 text-sm shadow-inner"
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button 
                        disabled={loading}
                        className="w-full h-16 rounded-[4px] bg-slate-900 hover:bg-blue-700 text-white font-black text-xs transition-all shadow-2xl active:scale-[0.98] disabled:opacity-50 group overflow-hidden"
                      >
                        {loading ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <div className="flex items-center gap-3">
                             <span className="uppercase tracking-[0.2em]">Register Case to Master Ledger</span>
                             <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
           </div>

           {/* Professional Sidebar Summary */}
           <div className="xl:col-span-4 space-y-6 px-1 sm:px-0">
               <motion.div 
                key={formData.treatment}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 rounded-[4px] p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5"
              >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-[4px] blur-[80px] -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                  
                  <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-4">
                       <div className="h-11 w-11 bg-white/5 rounded-[4px] flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg">
                          <Calculator className="h-6 w-6 text-blue-400" />
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Submission Details</p>
                          <h3 className="text-lg sm:text-xl font-black tracking-tight uppercase text-white">Case Summary</h3>
                       </div>
                    </div>
 
                    <div className="space-y-4">
                       <div className="p-4 bg-white/5 rounded-[4px] border border-white/5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Procedure Type</p>
                          <p className="text-xs sm:text-sm font-black text-white leading-tight uppercase truncate">
                             {selectedTreatment?.name || 'AWAITING SELECTION...'}
                          </p>
                        <div className="p-6 sm:p-8 bg-white/5 rounded-[4px] border border-white/10 relative">
                           <div className="absolute top-4 right-4">
                              {formData.treatmentCharge ? (
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black uppercase rounded-[2px]">Active</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-500 text-[8px] font-black uppercase rounded-[2px]">Empty</span>
                              )}
                           </div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">Settlement Fee</p>
                           <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter">
                              ₹{calculatedSettlement.toLocaleString()}
                           </p>
                           <div className="mt-5 flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest">
                              <ShieldCheck size={14} className="text-blue-500" /> 
                              {formData.treatmentCharge ? 'Direct Settlement (1:1 Value)' : 'Awaiting Input'}
                           </div>
                        </div>
                       </div>
                    </div>
 
                    <div className="flex items-start gap-3 p-4 bg-white/5 rounded-[4px] border border-white/5">
                       <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                       <p className="text-[8px] sm:text-[9px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">
                          Settlement manifests in your wallet post-clinical verification.
                       </p>
                    </div>
                  </div>
               </motion.div>

              <div className="bg-white rounded-[4px] p-5 sm:p-6 border border-slate-100 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-3">
                   <div className="h-8 w-8 bg-blue-50 rounded-[4px] flex items-center justify-center">
                    <ShieldCheck size={18} className="text-blue-600" />
                   </div>
                   <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Clinical Protocol Rules</h3>
                </div>
                <ul className="space-y-2">
                   {CLINICIAN_GUIDELINES.map((guide, idx) => (
                     <li key={idx} className="flex gap-4 items-start group">
                        <div className="h-5 w-5 rounded-[4px] bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-blue-600 transition-colors">
                           <CheckCircle2 size={10} className="text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                        <span className="text-[9px] sm:text-[11px] font-black text-slate-500 leading-relaxed uppercase tracking-widest group-hover:text-slate-900 transition-colors">
                           {guide}
                         </span>
                     </li>
                   ))}
                </ul>
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

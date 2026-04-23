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
  TrendingUp, Award, DollarSign, Plus, MapPin, 
  FileImage, Paperclip, Trash2, FileText, X, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { db, storage } from '@/lib/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { submitNewCase } from '@/lib/firestore';
import toast from 'react-hot-toast';

const TREATMENTS = [
  { id: 'implant', name: 'Dental Implant', points: 10, value: '₹500.00' },
  { id: 'rct', name: 'Root Canal (RCT)', points: 5, value: '₹250.00' },
  { id: 'prophylaxis', name: 'Prophylaxis', points: 3, value: '₹150.00' },
  { id: 'crown', name: 'Crown & Bridge', points: 4, value: '₹200.00' },
  { id: 'ortho', name: 'Orthodontics', points: 8, value: '₹400.00' },
  { id: 'denture', name: 'Complete Denture', points: 6, value: '₹300.00' },
  { id: 'scaling', name: 'Scaling & Polishing', points: 2, value: '₹100.00' },
  { id: 'extraction', name: 'Tooth Extraction', points: 2, value: '₹100.00' },
  { id: 'whitening', name: 'Teeth Whitening', points: 3, value: '₹150.00' },
  { id: 'composite', name: 'Composite Filling', points: 1.5, value: '₹75.00' }
];

const ASSOCIATE_GUIDELINES = [
  "Add patient consent in the notes.",
  "Check mobile number for accuracy.",
  "Select the correct treatment type.",
  "Add case notes for faster approval."
];

export default function SubmitCase() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    patientName: '',
    patientMobile: '',
    treatment: '',
    caseDate: '', // Start empty for SSR consistency
    notes: '',
    evidenceName: '',
    location: ''
  });

  useEffect(() => {
    setMounted(true);
    setFormData(prev => ({
      ...prev,
      caseDate: new Date().toISOString().split('T')[0]
    }));
  }, []);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const selectedTreatment = TREATMENTS.find(t => t.id === formData.treatment);

  const processFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Auth session expired. Please re-login.");
      return;
    }
    
    if (!formData.treatment) {
      toast.error("Select Treatment Taken.");
      return;
    }

    const toastId = toast.loading("Processing Cloud Sync...");
    setLoading(true);

    try {
      let evidenceUrl = '';
      if (selectedFile) {
        evidenceUrl = await processFile(selectedFile);
      }

      const caseData = {
        ...formData,
        doctorUid: user.uid,
        doctorName: user.displayName || (userData as any)?.name || 'Practitioner',
        doctorRole: (userData as any)?.role || 'doctor', // Tag case with submitter's role
        evidenceUrl: evidenceUrl, 
        treatmentName: selectedTreatment?.name || formData.treatment,
        points: (selectedTreatment as any)?.points || 0,
        status: 'Pending',
        location: formData.location || 'Clinical Node',
        submittedAt: serverTimestamp()
      };

      // [HARDENED SYNC] Use Clinical Registry Hub for with-timeout resilience
      const res = await submitNewCase(user.uid, caseData);
      
      if (!res.success) {
        throw new Error(res.error || "Registry Sync Failed");
      }
      
      // Notify System for Dashboard Feed
      try {
        const { createNotification } = await import('@/lib/firestore');
        await createNotification(
          user.uid, 
          'New Case Submitted', 
          `Case for ${formData.patientName} (${selectedTreatment?.name}) registered successfully.`, 
          'success'
        );
      } catch (notifErr) { console.warn("Identity Notification Delayed"); }

      // Clear local caches to force fresh fetch in History/Dashboard
      localStorage.removeItem('blueteeth_cases_cache');
      localStorage.removeItem('clinical_cases_v2_cache');
      localStorage.removeItem(`doctor_stats_${user.uid}`);
      localStorage.removeItem(`clinical_stats_${user.uid}`);
      localStorage.removeItem(`clinical_cases_${user.uid}`);
      window.dispatchEvent(new Event('clinical-identity-update'));

      // INSTANT SUCCESS FEEDBACK
      toast.success("Case Registered in Cloud Registry!", { id: toastId });
      
      setFormData({
        patientName: '',
        patientMobile: '',
        treatment: '',
        caseDate: new Date().toISOString().split('T')[0],
        notes: '',
        evidenceName: '',
        location: ''
      });
      setSelectedFile(null);
      
    } catch (err: any) {
      console.error(">>> [SUBMISSION CORE ERROR]:", err);
      toast.error("Process aborted locally.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden" suppressHydrationWarning={true}>
        {/* Animated Background Elements */}
        <div className="fixed inset-0 z-0 pointer-events-none" suppressHydrationWarning={true}>
          <div className="absolute top-[-10%] left-[5%] w-[60rem] h-[60rem] bg-indigo-100/40 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[5%] w-[50rem] h-[50rem] bg-blue-100/40 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="max-w-6xl mx-auto space-y-4 pb-4" suppressHydrationWarning={true}>
          {/* Top Status & Header Section */}
          <div className="flex flex-col gap-4 sm:gap-0">
            {/* Status Badge - Fixed for mobile overflow */}
            <div className="flex items-center justify-start sm:justify-end h-auto sm:h-8 order-2 sm:order-1 mt-2 sm:mt-0 px-2 sm:px-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100 backdrop-blur-md shadow-sm">
                <ShieldCheck className="h-3 w-3 text-blue-600 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-700">Live Status: Active</span>
              </div>
            </div>

            {/* Title & Description */}
            <div className="sm:-mt-8 space-y-1 px-2 sm:px-0 order-1 sm:order-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                Submit New Case
              </h1>
              <p className="text-slate-600 font-bold text-[9px] sm:text-[11px] uppercase tracking-[0.2em] flex items-center gap-2">
                <Zap size={11} className="text-amber-500 fill-amber-500" />
                Cloud-Synced & Secure Status
              </p>
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-6">
           <div className="lg:col-span-9">
              <Card className="border border-slate-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] rounded-[4px] overflow-hidden bg-white relative">
                <CardContent className="p-8 sm:p-10">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-3 group transition-all">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 group-focus-within:text-blue-600">
                           <User size={18} className="text-blue-600" /> Full Patient Name
                        </Label>
                        <Input 
                          placeholder="John Doe" 
                          required 
                          value={formData.patientName}
                          onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                          className="h-14 rounded-[4px] bg-white border-slate-200 shadow-sm transition-all text-base font-bold placeholder:text-slate-600 focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400"
                        />
                      </div>

                      <div className="space-y-3 group transition-all">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 group-focus-within:text-emerald-600">
                           <Phone size={18} className="text-emerald-600" /> Patient Mobile Number
                        </Label>
                        <Input 
                          placeholder="10-digit number" 
                          required 
                          maxLength={10}
                          value={formData.patientMobile}
                          onChange={(e) => setFormData({...formData, patientMobile: e.target.value.replace(/\D/g, '')})}
                          className="h-14 rounded-[4px] bg-white border-slate-200 shadow-sm transition-all text-base font-bold placeholder:text-slate-600 focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400"
                        />
                      </div>

                      <div className="space-y-3 relative group transition-all">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 group-focus-within:text-indigo-600">
                           <ClipboardList size={18} className="text-indigo-600" /> Treatment Taken
                        </Label>
                        <div className="relative">
                          <select 
                            required
                            value={formData.treatment} 
                            onChange={(e) => setFormData({...formData, treatment: e.target.value})}
                            className="h-14 w-full rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400 transition-all font-bold text-slate-900 appearance-none cursor-pointer shadow-sm hover:bg-slate-100/30"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.25rem' }}
                          >
                            <option value="" disabled>Select Treatment</option>
                            {TREATMENTS.map(t => (
                              <option key={t.id} value={t.id} className="font-bold">
                                {t.name} ({t.points} Pts)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3 group transition-all">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 group-focus-within:text-amber-600">
                           <Calendar size={18} className="text-amber-600" /> Submission Date
                        </Label>
                        <Input 
                          type="date" 
                          required 
                          value={formData.caseDate}
                          onChange={(e) => setFormData({...formData, caseDate: e.target.value})}
                          className="h-14 rounded-[4px] bg-white border-slate-200 shadow-sm transition-all focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400"
                        />
                      </div>

                      <div className="space-y-3 group transition-all">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 group-focus-within:text-rose-600">
                           <MapPin size={18} className="text-rose-600" /> Case Location
                        </Label>
                        <Input 
                          placeholder="e.g. Mumbai Harbor" 
                          required 
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                          className="h-14 rounded-[4px] bg-white border-slate-200 shadow-sm transition-all text-base font-bold placeholder:text-slate-600 focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                           Attach Case Evidence / PDF Proof
                        </Label>
                        <div className="relative group">
                          <div className="w-full h-32 rounded-[4px] border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer overflow-hidden p-4">
                             <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                <Plus className="h-5 w-5" />
                             </div>
                             <p className="text-[10px] font-bold text-slate-600 group-hover:text-blue-600 text-center uppercase tracking-tight">Click to attach case proof <br/><span className="text-[8px] opacity-60">(X-ray, Photo, or PDF Record)</span></p>
                             <input 
                               type="file" 
                               accept="image/*,application/pdf"
                               className="absolute inset-0 opacity-0 cursor-pointer"
                               onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                    setSelectedFile(file);
                                    setFormData({...formData, evidenceName: file.name});
                                    toast.success(`${file.name} attached locally.`);
                                 }
                               }}
                             />
                             {formData.evidenceName && (
                                <div className="mt-2 flex flex-col items-center gap-2">
                                  <div className={`flex items-center gap-2 px-3 py-1 rounded-[4px] text-[10px] font-black border transition-all ${
                                    selectedFile?.type === 'application/pdf' 
                                      ? 'bg-red-50 text-red-700 border-red-100' 
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  }`}>
                                    {selectedFile?.type === 'application/pdf' ? <FileText size={12} /> : <CheckCircle2 size={12} />}
                                    <span className="truncate max-w-[150px]">{formData.evidenceName}</span>
                                    {selectedFile?.type === 'application/pdf' && <span className="ml-1 text-[8px] opacity-70">PDF</span>}
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFile(null);
                                      setFormData({...formData, evidenceName: ''});
                                    }}
                                    className="text-[9px] font-bold text-red-400 hover:text-red-600 flex items-center gap-1"
                                  >
                                    <Trash2 size={10} /> Remove
                                  </button>
                                </div>
                             )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 group transition-all">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 group-focus-within:text-blue-600">
                           Additional Case Notes
                        </Label>
                        <Textarea 
                          placeholder="Detail the case context for faster professional approval..." 
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          className="h-32 rounded-[4px] bg-white border-slate-200 shadow-sm transition-all focus:ring-4 focus:ring-blue-100/50 focus:border-blue-400"
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button 
                        disabled={loading}
                        className="w-full h-16 sm:h-20 rounded-[4px] bg-blue-600 hover:bg-blue-700 text-white font-black text-lg transition-all shadow-xl shadow-blue-500/30 active:scale-[0.98] disabled:opacity-70 group overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/10 to-blue-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        {loading ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-200" />
                            <span className="uppercase tracking-widest text-[11px] font-black">Syncing case data...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 relative z-10">
                             <span className="text-base sm:text-lg font-black uppercase tracking-[0.1em]">Confirm Case Submission</span>
                             <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                          </div>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
           </div>

           <div className="lg:col-span-3 space-y-4">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={formData.treatment || 'empty'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="min-h-[540px] sm:min-h-0 flex flex-col justify-between sm:justify-center bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 rounded-[4px] p-7 sm:p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5"
                >
                  <div className="absolute -right-4 -top-4 h-32 w-32 bg-blue-500/10 rounded-full blur-3xl" />
                  <div className="relative z-10 flex flex-col h-full space-y-8 sm:space-y-5">
                    <div className="flex items-center gap-3">
                       <div className="h-10 w-10 bg-white/10 rounded-[4px] flex items-center justify-center backdrop-blur-md border border-white/10">
                          <Calculator className="h-5 w-5 text-blue-300" />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Points Summary</p>
                          <h3 className="text-xl sm:text-lg font-black tracking-tight">Earnings Preview</h3>
                       </div>
                    </div>
 
                    <div className="flex-1 flex flex-col justify-center space-y-8 sm:space-y-4">
                       <div className="p-5 sm:p-3.5 bg-white/5 rounded-[4px] border border-white/10 backdrop-blur-sm transition-all">
                          <p className="text-[10px] sm:text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Selected Treatment</p>
                          <p className="text-sm sm:text-xs font-black text-white leading-tight">
                             {selectedTreatment?.name || 'Awaiting Selection...'}
                          </p>
                       </div>
 
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-4">
                          <div className="p-6 sm:p-4 bg-blue-500/10 rounded-[4px] border border-blue-500/20 shadow-inner">
                             <p className="text-[11px] sm:text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">B-Points</p>
                             <p className="text-3xl sm:text-2xl font-black text-white">+{selectedTreatment?.points || 0}</p>
                          </div>
                          <div className="p-6 sm:p-4 bg-emerald-500/10 rounded-[4px] border border-emerald-500/20 shadow-inner">
                             <p className="text-[11px] sm:text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Cash Value</p>
                             <p className="text-3xl sm:text-2xl font-black text-emerald-400">₹{selectedTreatment ? (selectedTreatment.points * 50).toFixed(0) : '0'}</p>
                          </div>
                       </div>
                    </div>
 
                    <div className="flex items-start gap-2 p-4 sm:p-3 bg-white/5 rounded-[4px] border border-white/5">
                       <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
                       <p className="text-[11px] sm:text-[9px] text-slate-300 leading-relaxed font-medium capitalize">
                          1 Point = ₹50.00.
                       </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="bg-white rounded-[4px] p-7 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden flex flex-col justify-start min-h-[310px] sm:min-h-[260px]">
                <div className="flex items-center gap-2 mb-5">
                   <ShieldCheck size={16} className="text-blue-600" />
                   <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Submission Guidelines</h3>
                </div>
                <ul className="space-y-5 sm:space-y-4 text-wrap leading-relaxed">
                   {ASSOCIATE_GUIDELINES.map((guide, idx) => (
                      <li key={idx} className="flex gap-4 items-center group p-1.5 rounded-[4px] hover:bg-blue-50/50 transition-colors">
                        <div className="h-5 w-8 rounded-[4px] bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-600 transition-all shadow-sm">
                           <CheckCircle2 size={10} className="text-blue-600 group-hover:text-white transition-colors" />
                        </div>
                        <span className="text-[11px] font-black text-slate-700 leading-tight group-hover:text-slate-900 transition-colors pt-0.5 uppercase tracking-tighter sm:truncate">
                           {guide}
                         </span>
                     </li>
                   ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        input[type="date"]::-webkit-calendar-picker-indicator {
          display: none !important;
          -webkit-appearance: none !important;
        }
        input[type="date"] {
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 1.25rem center !important;
          background-size: 1.1rem !important;
          padding-right: 3rem !important;
        }
      `}} />
    </DashboardLayout>
  );
}

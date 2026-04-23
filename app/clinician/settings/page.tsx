'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Mail, 
  MapPin, 
  Lock, 
  ShieldCheck, 
  UserCircle,
  Stethoscope,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Phone,
  Calendar,
  GraduationCap,
  Award,
  FileBadge,
  Camera,
  BadgeCheck,
  Edit2,
  X,
  Plus,
  Minus,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { updateUserProfile, uploadProfileImage } from '@/lib/firestore';

export default function ClinicianSettingsPage() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Crop System States
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    clinicName: '',
    email: '',
    location: '',
    specialization: 'Clinician Specialist',
    phone: '',
    regNo: '',
    qualification: '',
    experience: '',
    photoURL: ''
  });

  React.useEffect(() => {
    if (userData) {
      // Ensure 'Dr.' prefix is handled during sync
      const rawName = userData.name || user?.displayName || '';
      const formattedName = rawName.toLowerCase().startsWith('dr.') ? rawName : `Dr. ${rawName}`;

      let syncedData = {
        name: formattedName,
        clinicName: userData.clinicName || '',
        email: user?.email || userData.email || '',
        location: userData.location || '',
        specialization: userData.specialization || 'Clinician Specialist',
        phone: userData.phone || '',
        regNo: userData.regNo || '',
        qualification: userData.qualification || '',
        experience: userData.experience || '',
        bio: userData.bio || '',
        photoURL: userData.photoURL || ''
      };

      setFormData(syncedData);
    }
  }, [userData, user]);

  const baseInputClass = "w-full rounded-lg pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all ";
  const activeClass = "bg-slate-50 border-2 border-slate-50 focus:border-blue-500 focus:bg-white text-slate-700";
  const disabledClass = "bg-slate-100 border-2 border-slate-100 text-slate-500 cursor-not-allowed";
  
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawImage(reader.result as string);
        setIsCropModalOpen(true);
        setZoom(1); 
        setCropOffset({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const finalizeCrop = () => {
    if (!imgRef.current) return;
    setLoading(true);
    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    const size = 300; 
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(img, 0, 0, size, size); // Simplified for now
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      setFormData(prev => ({ ...prev, photoURL: croppedBase64 }));
      setIsEditing(true);
      setIsCropModalOpen(false);
      toast.success("Crop Success! Save to Cloud.");
    }
    setLoading(false);
  };

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    // OPTIMISTIC UI: Close edit mode immediately for micro-second feel
    setIsEditing(false);
    toast.success("Profile Node Updated Locally!", { duration: 1000 });

    // BACKGROUND SYNC: Heavy tasks run without blocking the user
    (async () => {
      try {
        let finalPhotoURL: string = formData.photoURL;
        
        // 1. Image Upload in Background
        if (formData.photoURL.startsWith('data:image')) {
          const photoResult = await uploadProfileImage(user.uid, formData.photoURL);
          if (photoResult.success && photoResult.url) finalPhotoURL = photoResult.url;
        }

        // 2. Cloud Database Sync
        await updateUserProfile(user.uid, { ...formData, photoURL: finalPhotoURL });
        
        // 3. Auth Profile Sync
        const { updateProfile } = await import('firebase/auth');
        await updateProfile(user, { 
          displayName: formData.name, 
          photoURL: finalPhotoURL.startsWith('http') ? finalPhotoURL : user.photoURL 
        });

        // 4. Update Local Snapshot for Instant Dashboard Hydration
        localStorage.setItem(`clinical_identity_snapshot_${user.uid}`, JSON.stringify({
           role: 'clinician',
           name: formData.name,
           photoURL: finalPhotoURL
        }));
        window.dispatchEvent(new Event('clinical-identity-update'));


      } catch (err) {
        
      }
    })();
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto space-y-8 pb-10 px-4 pt-4">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 px-1 sm:px-0">
          <div className="space-y-1 sm:space-y-1.5">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Profile Settings</h1>
            <p className="text-[9px] sm:text-[10px] font-black text-blue-600 uppercase tracking-widest">Node ID: {user?.uid.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="text-[8px] sm:text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-md uppercase tracking-widest border border-emerald-100 flex items-center gap-2 w-fit">
             <div className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-emerald-500 animate-pulse" /> 
             Registry Verified
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card className="py-6 sm:py-8 px-5 sm:px-6 bg-slate-900 border-0 rounded-xl text-white text-center shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
               <div className="relative z-10 space-y-4">
                  <div 
                    className="w-20 h-20 bg-white/5 rounded-lg flex items-center justify-center mx-auto border border-white/10 shadow-2xl relative overflow-hidden group/avatar cursor-pointer"
                    onClick={() => isEditing && document.getElementById('photoInput')?.click()}
                  >
                     {formData.photoURL ? (
                       <img src={formData.photoURL} alt="Dr." className="w-full h-full object-cover" />
                     ) : (
                       <UserCircle size={40} className="text-white/20 sm:size-[48px]" />
                     )}
                     {isEditing && (
                       <div className="absolute inset-0 bg-blue-600/60 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                          <Camera size={20} className="text-white" />
                       </div>
                     )}
                  </div>
                  <input id="photoInput" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  
                  <div>
                    <h3 className="text-lg sm:text-xl font-black tracking-tight uppercase leading-none">{formData.name || 'Specialist'}</h3>
                    <p className="text-blue-400 text-[8px] sm:text-[9px] font-black tracking-[0.2em] uppercase mt-2">{formData.specialization}</p>
                  </div>
               </div>
            </Card>

            <Card className="p-5 bg-white border border-slate-100 rounded-md shadow-lg shadow-slate-200/50">
               <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Status</p>
                     <p className="text-[9px] font-black text-emerald-600 uppercase">Active Node</p>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cloud Sync</p>
                     <p className="text-[9px] font-black text-blue-600 uppercase">Optimal</p>
                  </div>
               </div>
            </Card>
          </div>
 
          <div className="md:col-span-2">
             <Card className="p-5 sm:p-6 border-slate-200 rounded-xl shadow-2xl shadow-slate-200/40 bg-white">
               <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Specialist Name</label>
                       <div className="relative">
                         <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={14} />
                         <input type="text" required disabled={!isEditing} className={`w-full h-12 rounded-lg pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all ${isEditing ? activeClass : disabledClass}`} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                       </div>
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Clinic Center</label>
                       <div className="relative">
                         <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={14} />
                         <input type="text" required disabled={!isEditing} className={`w-full h-12 rounded-lg pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all ${isEditing ? activeClass : disabledClass}`} value={formData.clinicName} onChange={e => setFormData({...formData, clinicName: e.target.value})} />
                       </div>
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Node</label>
                       <div className="relative">
                         <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                         <input type="email" disabled className="w-full h-12 bg-slate-50 rounded-lg pl-10 pr-4 font-bold text-slate-400 text-sm italic border border-slate-100" value={formData.email} />
                       </div>
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Sync Mobile</label>
                       <div className="relative">
                         <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
                         <input type="tel" required disabled={!isEditing} className={`w-full h-12 rounded-lg pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all ${isEditing ? activeClass : disabledClass}`} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                       </div>
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-1">License No.</label>
                       <div className="relative">
                         <FileBadge className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={14} />
                         <input 
                           type="text" 
                           disabled 
                           className="w-full h-12 bg-slate-50 border border-slate-100 rounded-lg pl-10 pr-4 font-bold text-slate-400 text-sm shadow-inner cursor-not-allowed italic" 
                           value={formData.regNo} 
                         />
                       </div>
                     </div>

                     <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Specialization</label>
                       <div className="relative">
                         <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600" size={14} />
                         <input type="text" required disabled={!isEditing} className={`w-full h-12 rounded-lg pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all ${isEditing ? activeClass : disabledClass}`} value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})} />
                       </div>
                     </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Professional Dossier (Bio)</label>
                      <textarea 
                        disabled={!isEditing} className="w-full rounded-sm py-3 px-4 outline-none font-bold text-sm shadow-sm resize-none bg-slate-50 border border-slate-100 focus:border-blue-500 focus:bg-white text-slate-700 h-28"
                        placeholder="Briefly describe your clinical expertise..."
                        value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})}
                      />
                    </div>

                  <div className="sm:col-span-2 pt-4 flex flex-col sm:flex-row gap-4">
                    {!isEditing ? (
                      <Button type="button" onClick={() => setIsEditing(true)} className="w-full bg-slate-900 h-14 sm:h-12 rounded-md font-black text-white text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95"><Edit2 size={16} className="mr-3" /> Edit Profile</Button>
                    ) : (
                      <>
                        <Button type="button" onClick={() => setIsEditing(false)} variant="outline" className="w-full sm:w-1/3 h-14 sm:h-12 rounded-md text-slate-400 border-slate-200 bg-white hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest">Cancel</Button>
                        <Button type="submit" isLoading={loading} className="w-full sm:w-2/3 bg-blue-600 h-14 sm:h-12 rounded-md text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95">Save Changes</Button>
                      </>
                    )}
                  </div>
               </form>
              </Card>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isCropModalOpen && rawImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsCropModalOpen(false)} />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-8 flex flex-col items-center gap-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Adjust specialist Photo</h3>
                <div className="w-48 h-48 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner bg-slate-50">
                    <img ref={imgRef} src={rawImage} alt="Crop" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-4 w-full">
                   <Button variant="outline" onClick={() => setIsCropModalOpen(false)} className="flex-1">Cancel</Button>
                   <Button onClick={finalizeCrop} className="flex-1 bg-blue-600 text-white">Crop & Set</Button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

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
  Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { updateUserProfile, uploadProfileImage } from '@/lib/firestore';

export default function SettingsPage() {
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
    specialization: 'General Dentist',
    phone: '',
    qualification: '',
    experience: '',
    bio: '',
    photoURL: ''
  });

  React.useEffect(() => {
    if (userData) {
      let syncedData = {
        name: userData.name || user?.displayName || '',
        clinicName: userData.clinicName || '',
        email: user?.email || userData.email || '',
        location: userData.location || '',
        specialization: userData.specialization || 'General Dentist',
        phone: userData.phone || '',
        qualification: userData.qualification || '',
        experience: userData.experience || '',
        bio: userData.bio || '',
        photoURL: userData.photoURL || ''
      };

      const localBackup = user?.uid ? localStorage.getItem(`clinical_identity_v2_payload_${user.uid}`) : null;
      if (localBackup) {
        try {
          const parsed = JSON.parse(localBackup);
          if (!syncedData.clinicName && parsed.clinicName) syncedData.clinicName = parsed.clinicName;
          if (!syncedData.phone && parsed.phone) syncedData.phone = parsed.phone;
          if (!syncedData.qualification && parsed.qualification) syncedData.qualification = parsed.qualification;
          if (!syncedData.experience && parsed.experience) syncedData.experience = parsed.experience;
          if (!syncedData.location && parsed.location) syncedData.location = parsed.location;
          if (!syncedData.bio && parsed.bio) syncedData.bio = parsed.bio;
          if (!syncedData.photoURL && parsed.photoURL) syncedData.photoURL = parsed.photoURL;
        } catch (e) {}
      }
      
      setFormData(syncedData);
      if (user?.uid) {
        localStorage.setItem(`clinical_identity_v2_payload_${user.uid}`, JSON.stringify(syncedData));
      }
    } else if (user?.uid) {
      const localBackup = localStorage.getItem(`clinical_identity_v2_payload_${user.uid}`);
      if (localBackup) {
        try {
          const parsed = JSON.parse(localBackup);
          setFormData(prev => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
    }
  }, [userData, user]);

  const baseInputClass = "w-full rounded-[4px] pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all ";
  const activeClass = "bg-slate-50 border-2 border-slate-50 focus:border-blue-500 focus:bg-white text-slate-700";
  const disabledClass = "bg-slate-100 border-2 border-slate-100 text-slate-500 cursor-not-allowed";
  
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Clinical Profile: Max 10MB supported.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawImage(reader.result as string);
        setIsCropModalOpen(true);
        setZoom(1); 
        setCropOffset({ x: 0, y: 0 }); // Reset for new upload
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
      // Precise High-Fidelity Extraction based on Zoom and Panning Offset
      const rect = img.getBoundingClientRect();
      const parentRect = img.parentElement?.getBoundingClientRect();
      
      if (parentRect) {
        // Calculate relative coordinates of the visible circular view in the source image
        const scaleX = img.naturalWidth / rect.width;
        const scaleY = img.naturalHeight / rect.height;
        
        // Target is the center circle. We need to find its map on the original image.
        // For simplicity and stability, we'll extract the current visible frame
        const sourceSizeX = (parentRect.width / zoom) * scaleX;
        const sourceSizeY = (parentRect.height / zoom) * scaleY;
        
        const sourceX = (img.naturalWidth / 2) - (sourceSizeX / 2) - (cropOffset.x * scaleX / zoom);
        const sourceY = (img.naturalHeight / 2) - (sourceSizeY / 2) - (cropOffset.y * scaleY / zoom);

        ctx.drawImage(img, sourceX, sourceY, sourceSizeX, sourceSizeY, 0, 0, size, size);
      } else {
         // Fallback center-crop
         ctx.drawImage(img, 0, 0, size, size);
      }
      
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      
      setFormData(prev => ({ ...prev, photoURL: croppedBase64 }));
      setIsEditing(true);
      setIsCropModalOpen(false);
      
      if (user?.uid) {
        const updated = { ...formData, photoURL: croppedBase64 };
        localStorage.setItem(`clinical_identity_v2_payload_${user.uid}`, JSON.stringify(updated));
        window.dispatchEvent(new Event('clinical-identity-update'));
      }
      
      toast.success("Crop Success! Don't forget to Save Changes.");
    }
    setLoading(false);
  };

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      toast.error("Session Expired. Please login again.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Synchronizing Identity Node...");

    try {
      let finalPhotoURL: string = formData.photoURL;
      
      // 1. Photo Storage Sync
      if (formData.photoURL.startsWith('data:image')) {
        const photoResult = await uploadProfileImage(user.uid, formData.photoURL);
        if (photoResult.success && photoResult.url) {
          finalPhotoURL = photoResult.url;
        }
      }

      // 2. Filter Sensitive Fields
      const { email, ...safeData } = formData;

      // 3. Firestore Master Update
      const result = await updateUserProfile(user.uid, { 
        ...safeData, 
        photoURL: finalPhotoURL,
        role: userData?.role || 'doctor'
      });

      if (!result.success) throw new Error(result.error || "Firestore Sync Blocked");

      // 4. Auth Profile Update
      const { updateProfile } = await import('firebase/auth');
      await updateProfile(user, { 
        displayName: formData.name, 
        photoURL: finalPhotoURL.startsWith('http') ? finalPhotoURL : user.photoURL 
      });

      // 5. Local State & Cache Refresh
      localStorage.setItem(`clinical_identity_snapshot_${user.uid}`, JSON.stringify({
         role: userData?.role || 'doctor',
         name: formData.name,
         photoURL: finalPhotoURL
      }));
      localStorage.setItem(`clinical_identity_v2_payload_${user.uid}`, JSON.stringify({
        ...formData,
        photoURL: finalPhotoURL
      }));
      window.dispatchEvent(new Event('clinical-identity-update'));

      toast.success("Profile Node Secured!", { id: toastId });
      setIsEditing(false);
    } catch (err: any) {
      console.error("SYNC FAILURE:", err);
      toast.error(`Sync Failure: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] w-full space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-6 sm:pb-10 pt-0 sm:pt-1 px-2 sm:px-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-0">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">My Profile Settings</h1>
            <p className="text-slate-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest mt-1 opacity-80">Manage your profile and business details</p>
          </div>
          <div className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-[4px] uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Verified Identity
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-1 flex flex-col gap-4">
            <Card className="py-8 px-4 sm:px-8 bg-gradient-to-br from-blue-600 to-indigo-700 border-0 rounded-[4px] text-white text-center shadow-2xl shadow-blue-200 overflow-hidden relative flex flex-col justify-center group h-fit">
               <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-700" />
                    <div 
                     className={`w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/20 shadow-2xl relative overflow-hidden p-0 transition-all duration-500 ring-4 group/avatar-main ${isEditing ? 'cursor-pointer ring-blue-400/40' : 'cursor-not-allowed ring-white/5'}`}
                     onClick={() => isEditing && document.getElementById('photoInput')?.click()}
                   >
                      {formData.photoURL ? (
                        <img src={formData.photoURL} alt="Profile" className={`w-full h-full object-cover transition-transform duration-700 ${isEditing ? 'group-hover/avatar-main:scale-110' : ''}`} />
                      ) : (
                        <UserCircle size={50} className="text-white/40" />
                      )}
                      
                      {/* 🔒 LOCKED OVERLAY (Visible when Hovering in Locked Mode) */}
                      {!isEditing && (
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover/avatar-main:opacity-100 transition-all duration-300">
                           <Lock size={20} className="text-white/80 mb-1" />
                           <span className="text-[6px] font-black text-white/80 tracking-widest uppercase">Locked</span>
                        </div>
                      )}

                      {/* ⚡ UNLOCKED OVERLAY (Visible when Hovering in Edit Mode) */}
                      {isEditing && (
                        <div className="absolute inset-0 bg-blue-600/60 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover/avatar-main:opacity-100 transition-all duration-300">
                           <Camera size={24} className="text-white mb-1" />
                           <span className="text-[7px] font-black text-white tracking-[0.2em] uppercase">Change Photo</span>
                        </div>
                      )}
                   </div>

                   <p className="text-[8px] text-blue-300 font-black mb-6 tracking-widest uppercase opacity-80">Profile Photo</p>
                  <input id="photoInput" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  
                  <div className="h-7 min-w-[140px] flex flex-col justify-center">
                    <h3 className="text-xl font-black tracking-tight leading-none uppercase italic">{formData.name || 'Practitioner'}</h3>
                  </div>
                  <p className="text-blue-200 text-[9px] font-black tracking-[0.15em] uppercase italic opacity-80 mt-1">{formData.specialization || 'General Dentist'}</p>
                  
                  <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                    <div className="text-center group">
                      <p className="text-[8px] font-black uppercase mb-1 tracking-tighter text-white/70">Verified</p>
                      <BadgeCheck className="h-5 w-5 text-emerald-400 mx-auto" />
                    </div>
                    <div className="text-center group">
                      <p className="text-[8px] font-black uppercase mb-1 tracking-tighter text-white/70">Synced</p>
                      <ShieldCheck className="h-5 w-5 text-cyan-400 mx-auto" />
                    </div>
                  </div>
            </Card>

            <Card className="p-4 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md rounded-[4px] text-emerald-700">
               <div className="flex gap-3 items-center">
                  <BadgeCheck size={18} />
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Account Secure</p>
                     <p className="text-[9px] font-bold opacity-60">Identity is cloud-protected.</p>
                  </div>
               </div>
            </Card>

            <Card className="p-5 bg-white/40 border border-white/60 backdrop-blur-xl rounded-[4px] shadow-xl shadow-slate-200/20 group relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
               <div className="flex flex-col gap-4 relative z-10">
                  <div className="flex items-center justify-between">
                     <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] italic">Identity Vault</p>
                     {isEditing ? <Edit2 size={16} className="text-blue-500 animate-pulse" /> : <Lock size={16} className="text-slate-400" />}
                  </div>
                  <div className="space-y-3">
                     <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                        <p className="text-[10px] sm:text-[8px] font-black text-slate-400">ENCRYPTION</p>
                        <p className="text-[10px] sm:text-[8px] font-black text-emerald-600">AES-256 BIT</p>
                     </div>
                     <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                        <p className="text-[10px] sm:text-[8px] font-black text-slate-400">SESSION MODE</p>
                        <p className={`text-[10px] sm:text-[8px] font-black italic ${isEditing ? 'text-amber-600' : 'text-blue-600'}`}>{isEditing ? 'UNLOCKED / EDITING' : 'READ-ONLY LOCK'}</p>
                     </div>
                     <div className="flex items-center justify-between">
                        <p className="text-[10px] sm:text-[8px] font-black text-slate-400">STATUS</p>
                        <div className="flex items-center gap-1.5">
                           <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${isEditing ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                           <p className="text-[10px] sm:text-[8px] font-black text-slate-700">{isEditing ? 'ACTIVE SESSION' : 'PROTECTED'}</p>
                        </div>
                     </div>
                  </div>
               </div>
            </Card>
          </div>

          <div className="md:col-span-2">
             <Card className="p-4 sm:p-6 md:p-8 border-slate-100 rounded-[4px] shadow-2xl shadow-slate-200/40 bg-white">
               <form onSubmit={handleUpdate} className="flex flex-col md:grid md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Your Full Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-500"><UserCircle size={16} /></div>
                        <input type="text" required disabled={!isEditing} className={`w-full rounded-[4px] pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all py-3 ${isEditing ? activeClass : disabledClass}`} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Clinic Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-indigo-500"><Building2 size={16} /></div>
                        <input type="text" required disabled={!isEditing} className={`w-full rounded-[4px] pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all py-3 ${isEditing ? activeClass : disabledClass}`} value={formData.clinicName} onChange={e => setFormData({...formData, clinicName: e.target.value})} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Email Address</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-amber-500"><Mail size={16} /></div>
                        <input type="email" disabled className="w-full bg-slate-100 rounded-[4px] py-3 pl-10 pr-4 font-bold text-slate-500 text-xs italic" value={formData.email} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Mobile Number</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-emerald-500"><Phone size={16} /></div>
                        <input 
                          type="tel" 
                          required 
                          disabled={!isEditing} 
                          maxLength={10}
                          className={`w-full rounded-[4px] pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all py-3 ${isEditing ? activeClass : disabledClass}`} 
                          value={formData.phone} 
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setFormData({...formData, phone: val});
                          }} 
                        />
                      </div>
                    </div>



                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Professional Degree</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-cyan-600"><GraduationCap size={16} /></div>
                        <input type="text" required disabled={!isEditing} className={`w-full rounded-[4px] pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all py-3 ${isEditing ? activeClass : disabledClass}`} value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Your Location</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-rose-500"><MapPin size={16} /></div>
                        <input type="text" required disabled={!isEditing} className={`w-full rounded-[4px] pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all py-3 ${isEditing ? activeClass : disabledClass}`} value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">About Me</label>
                      <textarea 
                        disabled={!isEditing} className="w-full rounded-[4px] py-3 px-4 outline-none font-bold text-xs shadow-sm resize-none bg-slate-50 border-2 border-slate-50 focus:border-blue-500 focus:bg-white text-slate-700 h-24"
                        value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})}
                      />
                    </div>

                  <div className="mt-8 md:col-span-2 flex flex-col sm:flex-row gap-4">
                    {!isEditing ? (
                      <Button type="button" onClick={() => setIsEditing(true)} className="w-full bg-slate-900 h-14 rounded-[4px] font-black text-white text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-blue-600 hover:shadow-blue-500/30 transition-all duration-300 active:scale-95 group/editbtn">
                        <Edit2 size={16} className="mr-3 group-hover/editbtn:rotate-12 transition-transform" /> 
                        Edit My Profile
                      </Button>
                    ) : (
                      <>
                        <Button type="button" onClick={() => setIsEditing(false)} variant="outline" className="w-full sm:w-1/3 h-14 rounded-[4px] text-red-600 border-red-100 bg-red-50 hover:bg-red-100 font-black uppercase text-[10px] tracking-widest">Cancel</Button>
                        <Button type="submit" isLoading={loading} className="w-full sm:w-2/3 bg-blue-600 h-14 rounded-[4px] text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700">Update Profile</Button>
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
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
               onClick={() => setIsCropModalOpen(false)}
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
               className="relative bg-white rounded-[4px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
             >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Adjust Profile Photo</h3>
                   <button onClick={() => setIsCropModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                </div>
                
                <div className="p-8 flex flex-col items-center gap-6 bg-slate-50">
                   <div className="relative w-full max-w-[280px] aspect-square sm:w-72 sm:h-72 overflow-hidden border border-slate-200 shadow-xl bg-white flex items-center justify-center group/crop">
                      <motion.div 
                        drag
                        dragMomentum={false}
                        onDragEnd={(_, info) => setCropOffset(prev => ({ 
                           x: prev.x + info.offset.x, 
                           y: prev.y + info.offset.y 
                        }))}
                        animate={{ scale: zoom }}
                        whileTap={{ cursor: 'grabbing' }}
                        className="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center"
                      >
                         <img 
                           ref={imgRef} src={rawImage} alt="Crop zone" 
                           className="max-w-none w-full h-full object-contain pointer-events-none" 
                         />
                      </motion.div>
                      
                      {/* Professional Real Crop Overlay (Square-Round) */}
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                         {/* Semi-transparent surroundings */}
                         <div className="absolute inset-0 bg-slate-950/40" />
                         {/* Clear square-round viewport */}
                         <div className="w-56 h-56 sm:w-64 sm:h-64 bg-transparent border-2 border-white rounded-[4px] shadow-[0_0_0_1000px_rgba(15,23,42,0.6)] relative overflow-hidden">
                            <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(255,255,255,0.1)]" />
                         </div>
                      </div>
                   </div>

                   <div className="w-full max-w-xs space-y-4 pt-4">
                      <div className="flex items-center gap-4">
                         <Minus size={14} className="text-slate-400" />
                         <input 
                           type="range" min="1" max="4" step="0.01" 
                           value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
                           className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                         />
                         <Plus size={14} className="text-slate-400" />
                      </div>
                   </div>
                </div>

                 <div className="p-6 bg-slate-50 flex gap-4">
                    <Button variant="outline" onClick={() => setIsCropModalOpen(false)} className="flex-1 h-12 rounded-[4px] font-black uppercase text-[10px] tracking-widest border-slate-200 bg-white hover:bg-slate-50">Discard</Button>
                    <Button onClick={finalizeCrop} isLoading={loading} className="flex-1 h-12 rounded-[4px] bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700">Set Profile</Button>
                 </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

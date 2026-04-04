'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
  Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { updateUserProfile, uploadProfileImage } from '@/lib/firestore';

export default function SettingsPage() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    clinicName: '',
    email: '',
    location: '',
    specialization: 'General Dentist',
    phone: '',
    regNo: '',
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
        regNo: userData.regNo || '',
        qualification: userData.qualification || '',
        experience: userData.experience || '',
        bio: userData.bio || '',
        photoURL: userData.photoURL || ''
      };

      const localBackup = user?.uid ? localStorage.getItem(`clinical_profile_${user.uid}`) : null;
      if (localBackup) {
        try {
          const parsed = JSON.parse(localBackup);
          // If cloud sync failed but we have local offline edits, prioritize local edits over blank cloud fields
          if (!syncedData.clinicName && parsed.clinicName) syncedData.clinicName = parsed.clinicName;
          if (!syncedData.phone && parsed.phone) syncedData.phone = parsed.phone;
          if (!syncedData.regNo && parsed.regNo) syncedData.regNo = parsed.regNo;
          if (!syncedData.qualification && parsed.qualification) syncedData.qualification = parsed.qualification;
          if (!syncedData.experience && parsed.experience) syncedData.experience = parsed.experience;
          if (!syncedData.location && parsed.location) syncedData.location = parsed.location;
          if (!syncedData.bio && parsed.bio) syncedData.bio = parsed.bio;
          if (!syncedData.photoURL && parsed.photoURL) syncedData.photoURL = parsed.photoURL;
        } catch (e) {}
      }
      
      setFormData(syncedData);
      // Update local cache with the merged robust data
      if (user?.uid) {
        localStorage.setItem(`clinical_profile_${user.uid}`, JSON.stringify(syncedData));
      }
    } else if (user?.uid) {
      // Microsecond Hydration: Load from local cache if cloud is slow/offline
      const localBackup = localStorage.getItem(`clinical_profile_${user.uid}`);
      if (localBackup) {
        try {
          const parsed = JSON.parse(localBackup);
          setFormData(prev => ({ ...prev, ...parsed }));
          console.log("Practitioner Identity hydrated from local cache.");
        } catch (e) {
          console.error("Local cache hydration failed.");
        }
      }
    }
  }, [userData, user]);

  const baseInputClass = "w-full rounded-lg pl-10 pr-4 outline-none font-bold text-sm shadow-sm transition-all ";
  const activeClass = "bg-slate-50 border-2 border-slate-50 focus:border-blue-500 focus:bg-white text-slate-700";
  const disabledClass = "bg-slate-100 border-2 border-slate-100 text-slate-500 cursor-not-allowed";
  
  const getInputClass = () => baseInputClass + " py-2.5 " + (isEditing ? activeClass : disabledClass);
  const getSelectClass = () => baseInputClass + " py-2.5 pr-8 appearance-none " + (isEditing ? activeClass : disabledClass);
  const getTextAreaClass = () => "w-full rounded-lg py-2 px-4 outline-none font-bold text-xs shadow-sm resize-none transition-all " + (isEditing ? activeClass : disabledClass);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB High-Fidelity Support
        toast.error('Clinical Profile: Max 10MB supported.');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Practitioner Edge-Compression: Maintain high-fidelity but optimize for cloud
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800; // Optimized for high-speed clinical cloud sync
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height *= maxDim / width;
              width = maxDim;
            } else {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Optimized for Cloud Sync (JPEG 0.7 - Fast transmission baseline)
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          
          // CRITICAL: Force immediate global identity sync and broadcast with strictly fresh PREV state
          setFormData(prev => {
             const updatedState = { ...prev, photoURL: compressed };
             
             // Defer the external Broadcast Event to escape React's strict render phase locks (Prevents DashboardLayout setState error)
              setTimeout(() => {
                  if (user?.uid) {
                     localStorage.setItem(`clinical_profile_${user.uid}`, JSON.stringify(updatedState));
                     window.dispatchEvent(new Event('clinical-identity-update'));
                     console.log(">>> [IDENTITY BROADCAST] PROFILE ASSET SYNCHRONIZED.");
                  }
              }, 0);
             
             return updatedState;
          });
          
          // Force form into Editing mode so the user sees the 'Save & Sync' button 
          setIsEditing(true);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Identity Error: Authentication expired.");
      return;
    }
    
    // 1. OPTIMISTIC UPDATE: Deliver 'Microsecond' Experience
    // Commit to localStorage immediately for instant resilience
    if (user?.uid) {
      localStorage.setItem(`clinical_profile_${user.uid}`, JSON.stringify(formData));
      window.dispatchEvent(new Event('clinical-identity-update'));
    }
    
    toast.success("Identity Updated! Synchronizing in background...", { duration: 2000 });
    
    try {
      // Background Sync Task
      const syncTask = async () => {
        let finalPhotoURL = formData.photoURL;



        // Photo Sync (Background) - Wrapped in rigorous try/catch to ensure identity sync isn't destroyed by a Storage Timeout
        if (formData.photoURL && formData.photoURL.startsWith('data:image')) {
          try {
             // In case Firebase Storage isn't configured/enabled, or internet is strictly throttling
             const uploadResult = await uploadProfileImage(user.uid, formData.photoURL);
             if (uploadResult.success && uploadResult.url) {
               finalPhotoURL = uploadResult.url;
               // Update local storage with the new permanent URL over the temporary base64
               const updatedLoc = { ...formData, photoURL: finalPhotoURL };
               if (user?.uid) localStorage.setItem(`clinical_profile_${user.uid}`, JSON.stringify(updatedLoc));
             }
          } catch (storageErr) {
             console.warn("Storage upload timed out/failed. Falling back to inline Base64 Profile image.", storageErr);
             // finalPhotoURL remains the base64 string from formData.photoURL
          }
        }

        // Firestore Sync (Background)
        await updateUserProfile(user.uid, {
          ...formData,
          photoURL: finalPhotoURL
        });

        console.log("Cloud Synchronization Complete.");
      };

      // Fire and Forget - The UI is already 'updated' via formData and localStorage
      syncTask().catch(err => {
        console.error("Cloud Sync Delayed:", err);
        // Silent recovery - no interrupting toast for a smoother UX
      });

      setIsEditing(false); // Lock the form after update

    } catch (error: any) {
      console.error("Critical State Error:", error);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Practice Settings</h1>
          <p className="text-slate-500 font-medium">Manage your professional identity and clinical credentials.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          <div className="md:col-span-1 flex flex-col gap-4">
            <Card className="flex-1 py-8 px-8 bg-blue-600 border-0 rounded-2xl text-white text-center shadow-xl shadow-blue-100 overflow-hidden relative flex flex-col justify-center">
               <div className="absolute top-6 right-6 opacity-10">
                 <ShieldCheck size={70} />
               </div>
                <div className="relative z-10 group/avatar">
                   <div 
                     className="w-28 h-28 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border-2 border-white/30 shadow-2xl relative cursor-pointer overflow-hidden p-0"
                     onClick={() => document.getElementById('photoInput')?.click()}
                   >
                      {formData.photoURL ? (
                        <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover scale-105 transition-transform group-hover/avatar:scale-110" />
                      ) : (
                        <UserCircle size={56} className="text-white/40" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                         <Camera size={24} className="text-white" />
                      </div>
                   </div>
                   <p className="text-[10px] text-blue-100/60 font-black mb-6 tracking-widest uppercase">Clinical Identity Asset</p>
                  <input 
                    id="photoInput" type="file" accept="image/*" 
                    className="hidden" onChange={handlePhotoChange} 
                  />
                  
                  <div className="h-7 min-w-[140px] flex flex-col justify-center">
                    {formData.name ? (
                      <h3 className="text-xl font-black tracking-tight leading-none">{formData.name}</h3>
                    ) : (
                      <div className="h-5 w-32 bg-white/20 rounded-md animate-pulse" />
                    )}
                  </div>
                  <div className="h-4 mt-1 flex flex-col justify-center">
                    {formData.specialization ? (
                      <p className="text-blue-100 text-[9px] font-black tracking-[0.15em] uppercase italic opacity-80">{formData.specialization}</p>
                    ) : (
                      <div className="h-2 w-20 bg-white/10 rounded-sm animate-pulse" />
                    )}
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                    <div className="text-center group">
                      <p className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-tighter">Clinical Trust</p>
                      <BadgeCheck className="h-5 w-5 text-blue-200 mx-auto" />
                    </div>
                    <div className="text-center group">
                      <p className="text-[9px] font-black uppercase opacity-60 mb-2 tracking-tighter">Network ID</p>
                      <ShieldCheck className="h-5 w-5 text-blue-100 mx-auto" />
                    </div>
                  </div>
               </div>
            </Card>

            <Card className="p-4 bg-slate-900 border-0 rounded-xl text-white transform-gpu transition-all hover:scale-[1.02]">
               <div className="flex gap-3 items-center">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-white mb-0.5">Security Audit</p>
                     <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Identity edits require peer review.</p>
                  </div>
               </div>
            </Card>

             <Card className="p-4 border-slate-100 rounded-xl border-dashed border-2 flex items-center justify-between bg-slate-50 mt-0 flex-shrink-0">
                <div className="flex gap-3 items-center">
                   <div className="p-2 bg-white text-slate-900 rounded-lg shadow-sm border border-slate-100">
                     <Lock size={18} />
                   </div>
                   <div>
                      <p className="font-bold text-slate-900 text-xs leading-none mb-1">Security Vault</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">2FA ACTIVE</p>
                   </div>
                </div>
                <Button variant="outline" className="px-3 h-8 text-[9px] font-black uppercase tracking-widest text-blue-600 border-blue-100 hover:bg-blue-50 rounded-lg">MANAGE</Button>
             </Card>
          </div>

          <div className="md:col-span-2 flex flex-col h-full">
             <Card className="flex-1 p-6 border-slate-100 rounded-2xl shadow-lg shadow-slate-50 bg-white flex flex-col h-full">
               <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Name</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                          <UserCircle size={16} />
                        </div>
                        <input 
                          type="text" required disabled={!isEditing}
                          className={getInputClass()}
                          value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Practice Name</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                          <Building2 size={16} />
                        </div>
                        <input 
                          type="text" required disabled={!isEditing}
                          className={getInputClass()}
                          value={formData.clinicName} onChange={e => setFormData({...formData, clinicName: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Verified Clinical Email</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300">
                          <Mail size={16} />
                        </div>
                        <input 
                          type="email" disabled
                          className="w-full bg-slate-100 border-2 border-slate-100 rounded-lg py-2.5 pl-10 pr-4 outline-none font-bold text-slate-400 cursor-not-allowed text-xs overflow-hidden text-ellipsis"
                          value={user?.email || formData.email || ''}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Mobile No.</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                          <Phone size={16} />
                        </div>
                        <input 
                          type="tel" required disabled={!isEditing} placeholder="+91 XXXX XXX XXX"
                          className={getInputClass()}
                          value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Medical Registration No.</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                          <FileBadge size={16} />
                        </div>
                        <input 
                          type="text" required disabled={!isEditing} placeholder="Registration ID"
                          className={getInputClass()}
                          value={formData.regNo} onChange={e => setFormData({...formData, regNo: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Years of Experience</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                          <Award size={16} />
                        </div>
                        <input 
                          type="number" required disabled={!isEditing} placeholder="e.g. 10"
                          className={getInputClass()}
                          value={formData.experience} onChange={e => setFormData({...formData, experience: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Highest Qualification</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                          <GraduationCap size={16} />
                        </div>
                        <input 
                          type="text" required disabled={!isEditing} placeholder="e.g. MDS, BDS"
                          className={getInputClass()}
                          value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Experience & Location</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                          <MapPin size={16} />
                        </div>
                        <input 
                          type="text" required disabled={!isEditing} placeholder="City / Location"
                          className={getInputClass()}
                          value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Field of Expertise</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-blue-500 transition-colors">
                          <Stethoscope size={16} />
                        </div>
                        <select 
                          className={getSelectClass()} disabled={!isEditing}
                          value={formData.specialization} onChange={e => setFormData({...formData, specialization: e.target.value})}
                        >
                           <option value="General Dentist">General Dentist</option>
                           <option value="Implantologist">Implantologist</option>
                           <option value="Orthodontist">Orthodontist</option>
                           <option value="Endodontist">Endodontist</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bio / About</label>
                       <textarea 
                         className={getTextAreaClass()} disabled={!isEditing}
                         rows={2} placeholder="Brief highlight..."
                         value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})}
                       />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex gap-4">
                    {!isEditing ? (
                      <Button type="button" onClick={() => setIsEditing(true)} className="w-full bg-slate-900 h-12 rounded-lg font-bold shadow-lg shadow-slate-100 group gap-2 transition-all hover:bg-slate-800 text-sm">
                        <Edit2 size={16} /> Edit Identity Details
                      </Button>
                    ) : (
                      <>
                        <Button type="button" onClick={() => setIsEditing(false)} variant="outline" className="w-full sm:w-1/3 h-12 rounded-lg font-bold text-sm">
                          Cancel
                        </Button>
                        <Button type="submit" isLoading={loading} className="w-full sm:w-2/3 bg-blue-600 h-12 rounded-lg font-bold shadow-lg shadow-blue-100 group gap-2 transition-all hover:bg-blue-700 text-white text-sm">
                          Save & Sync Identity <Save size={16} />
                        </Button>
                      </>
                    )}
                  </div>
               </form>
             </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

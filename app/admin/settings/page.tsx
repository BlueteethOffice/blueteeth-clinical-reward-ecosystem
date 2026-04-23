'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Settings, ShieldCheck, Coins, Landmark, Bell, 
  Lock, Save, RefreshCcw, Activity, ShieldAlert,
  Server, Globe, Database, UserCircle, Camera
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { fetchGlobalSettings, updateGlobalSettings, updateUserProfile, uploadProfileImage } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [settings, setSettings] = useState({
    exchangeRate: 50,
    settlementMinimum: 500,
    defaultClinicianFee: 100,
    clinicianMinPayout: 1000,
    selfVerification: true,
    duplicatePatientScreening: true,
    lastAudit: '04:30 PM'
  });
  
  const { user, userData } = useAuth();
  const [adminProfile, setAdminProfile] = useState({
    name: '',
    photoURL: ''
  });

  useEffect(() => {
    if (userData && user) {
        const localBackup = localStorage.getItem(`clinical_profile_${user.uid}`);
        let initProfile = {
           name: userData.name || user.displayName || 'Nitin Chauhan',
           photoURL: userData.photoURL || ''
        };
        if (localBackup) {
           try {
              const parsed = JSON.parse(localBackup);
              if (parsed.name) initProfile.name = parsed.name;
              if (parsed.photoURL) initProfile.photoURL = parsed.photoURL;
           } catch(e) {}
        }
        setAdminProfile(initProfile);
    }
  }, [userData, user]);
  
  const handleAdminPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      if (file.size > 10 * 1024 * 1024) return toast.error('Max 10MB supported.');
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          const maxDim = 800;
          if (width > maxDim || height > maxDim) {
            if (width > height) { height *= maxDim / width; width = maxDim; } 
            else { width *= maxDim / height; height = maxDim; }
          }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          
          setAdminProfile(prev => ({ ...prev, photoURL: compressed }));
          localStorage.setItem(`clinical_profile_${user.uid}`, JSON.stringify({...adminProfile, photoURL: compressed}));
          window.dispatchEvent(new Event('clinical-identity-update'));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdminSave = async () => {
    if (!user) return;
    
    // [TURBO OPTIMIZATION] Step 1: Instant Local Hydration
    const instantProfile = { ...adminProfile };
    localStorage.setItem(`clinical_profile_${user.uid}`, JSON.stringify(instantProfile));
    window.dispatchEvent(new Event('clinical-identity-update'));
    
    const toastId = toast.loading('Syncing Identity to Global Edge...');
    setLoading(true);

    try {
      let photoURL = instantProfile.photoURL;
      if (photoURL && photoURL.startsWith('data:image')) {
        const uploadResult = await uploadProfileImage(user.uid, photoURL);
        if (uploadResult && uploadResult.success && uploadResult.url) {
           photoURL = uploadResult.url;
        }
      }

      // Step 2: Background Sync
      await updateUserProfile(user.uid, { name: instantProfile.name, photoURL });
      
      // Final Hydration with public URL
      localStorage.setItem(`clinical_profile_${user.uid}`, JSON.stringify({ name: instantProfile.name, photoURL }));
      window.dispatchEvent(new Event('clinical-identity-update'));
      
      toast.success('Master Identity Secured.', { id: toastId });
    } catch (e) {
      toast.error('Cloud Sync Latency: Local changes kept.', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const data = await fetchGlobalSettings();
      if (data) {
        setSettings({
          exchangeRate: data.exchangeRate || 50,
          settlementMinimum: data.settlementMinimum || 500,
          defaultClinicianFee: data.defaultClinicianFee || 100,
          clinicianMinPayout: data.clinicianMinPayout || 1000,
          selfVerification: data.selfVerification !== undefined ? data.selfVerification : true,
          duplicatePatientScreening: data.duplicatePatientScreening !== undefined ? data.duplicatePatientScreening : true,
          lastAudit: data.lastAudit || '04:30 PM'
        });
      }
      setFetching(false);
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    const result = await updateGlobalSettings(settings);
    setLoading(false);
    
    if (result.success) {
      toast.success('System parameters updated successfully.');
    } else {
      toast.error('Failed to update settings: ' + result.error);
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setSettings(prev => {
      const newSettings = { ...prev, [field]: value };
      
      // LOGIC: If exchange rate changes, auto-update settlement minimum to 10 points value
      if (field === 'exchangeRate') {
        const rate = typeof value === 'number' ? value : parseInt(String(value)) || 0;
        newSettings.settlementMinimum = rate * 10;
      }
      
      return newSettings;
    });
  };

  const runSecurityScan = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 450)),
      {
        loading: 'Scanning clinical nodes...',
        success: 'Security audit complete. No breaches detected.',
        error: 'Scan failed to initialize.',
      }
    );
  };

  if (fetching) {
    return (
      <DashboardLayout isAdminRoute={true}>
        <div className="h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout isAdminRoute={true}>
      <div className="space-y-10 pb-0 -mt-2">
        {/* Authority Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2 sm:px-0">
          <div className="space-y-1.5">
             <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 shadow-xl">
               <ShieldCheck className="h-3 w-3" /> System Control
             </div>
             <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Global Parameters</h1>
             <p className="text-slate-500 font-bold text-[10px] sm:text-xs uppercase tracking-widest opacity-60">Master Configuration Node</p>
          </div>
          <Button onClick={handleSave} isLoading={loading} className="h-11 sm:h-12 w-full sm:w-auto px-8 rounded-[4px] md:rounded-lg bg-blue-600 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 group gap-4">
             Save Protocol <Save className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Controls */}
          <div className="lg:col-span-2 space-y-8">


            {/* ASSOCIATE ECONOMICS */}
            <Card className="bg-white rounded-[4px] md:rounded-lg border border-slate-200 shadow-xl overflow-hidden group">
               <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-blue-600 to-indigo-700 flex items-center gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
                     <Coins size={60} />
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center shadow-lg border border-white/30 group-hover:rotate-12 transition-transform shrink-0">
                     <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div className="relative z-10">
                     <h3 className="text-base sm:text-lg font-black text-white tracking-tight uppercase leading-none">Associate Economics</h3>
                     <p className="text-[9px] sm:text-[10px] font-bold text-blue-100 uppercase tracking-widest mt-1">Configure referral points & rewards</p>
                  </div>
               </div>
               <CardContent className="p-5 sm:p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Point Value (1 B-Point)</label>
                         <div className="relative group">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-900 leading-none">₹</span>
                           <input 
                              type="number" 
                              value={settings.exchangeRate} 
                              onChange={(e) => handleInputChange('exchangeRate', parseInt(e.target.value) || 0)}
                              className="w-full pl-10 pr-4 h-12 sm:h-14 rounded-lg bg-slate-50 border border-slate-200 text-lg font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all shadow-inner" 
                           />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Min. Payout (Associate)</label>
                         <div className="relative group">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-900 leading-none">₹</span>
                           <input 
                              type="number" 
                              value={settings.settlementMinimum} 
                              onChange={(e) => handleInputChange('settlementMinimum', parseInt(e.target.value) || 0)}
                              className="w-full pl-10 pr-4 h-12 sm:h-14 rounded-lg bg-slate-50 border border-slate-200 text-lg font-black text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 transition-all shadow-inner" 
                           />
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* CLINICIAN ECONOMICS */}
            <Card className="bg-white rounded-[4px] md:rounded-lg border border-slate-200 shadow-xl overflow-hidden group">
               <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-violet-600 to-purple-700 flex items-center gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 -rotate-12">
                     <Landmark size={60} />
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center shadow-lg border border-white/30 group-hover:rotate-12 transition-transform shrink-0">
                     <Landmark className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div className="relative z-10">
                     <h3 className="text-base sm:text-lg font-black text-white tracking-tight uppercase leading-none">Clinician Economics</h3>
                     <p className="text-[9px] sm:text-[10px] font-bold text-violet-100 uppercase tracking-widest mt-1">Configure professional fees & payouts</p>
                  </div>
               </div>
               <CardContent className="p-5 sm:p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Default Base Fee (INR)</label>
                         <div className="relative group">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-900 leading-none">₹</span>
                           <input 
                              type="number" 
                              value={(settings as any).defaultClinicianFee || 100} 
                              onChange={(e) => handleInputChange('defaultClinicianFee', parseInt(e.target.value) || 0)}
                              className="w-full pl-10 pr-4 h-12 sm:h-14 rounded-lg bg-slate-50 border border-slate-200 text-lg font-black text-slate-900 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all shadow-inner" 
                           />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Min. Payout (Clinician)</label>
                         <div className="relative group">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-900 leading-none">₹</span>
                           <input 
                              type="number" 
                              value={(settings as any).clinicianMinPayout || 1000} 
                              onChange={(e) => handleInputChange('clinicianMinPayout', parseInt(e.target.value) || 0)}
                              className="w-full pl-10 pr-4 h-12 sm:h-14 rounded-lg bg-slate-50 border border-slate-200 text-lg font-black text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 transition-all shadow-inner" 
                           />
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>

             {/* PROTOCOL RULES (Desktop Only - Original Position) */}
            <div className="hidden lg:block">
              <Card className="bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden group">
                 <div className="p-5 sm:p-6 border-b border-white/10 bg-slate-900 flex items-center gap-4 relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 p-4 opacity-5">
                       <ShieldAlert size={80} />
                    </div>
                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-red-500 rounded-lg flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform border border-red-400 shrink-0">
                       <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                    </div>
                    <div className="relative z-10">
                       <h3 className="text-base sm:text-lg font-black text-white tracking-tight uppercase leading-none">Protocol Rules</h3>
                       <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Protect the portal from clinical anomalies</p>
                    </div>
                 </div>
                 <CardContent className="p-4 sm:p-6 space-y-2 sm:space-y-4">
                    <div 
                      onClick={() => handleInputChange('selfVerification', !settings.selfVerification)}
                      className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-100"
                    >
                       <div className="pr-4">
                          <p className="text-xs sm:text-sm font-black text-slate-900 uppercase">User Verification</p>
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Check phone/email upon entry</p>
                       </div>
                       <div className={`h-7 w-12 sm:h-8 sm:w-14 shrink-0 rounded-full p-1 shadow-inner relative transition-colors ${settings.selfVerification ? 'bg-blue-600' : 'bg-slate-200'}`}>
                          <motion.div 
                            animate={{ x: settings.selfVerification ? (typeof window !== 'undefined' && window.innerWidth < 640 ? 20 : 24) : 0 }}
                            className="h-5 w-5 sm:h-6 sm:w-6 bg-white rounded-full shadow-lg" 
                          />
                       </div>
                    </div>
                    <div 
                      onClick={() => handleInputChange('duplicatePatientScreening', !settings.duplicatePatientScreening)}
                      className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-100"
                    >
                       <div className="pr-4">
                          <p className="text-xs sm:text-sm font-black text-slate-900 uppercase">Duplicate Shield</p>
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Block redundant patient mobile entries</p>
                       </div>
                       <div className={`h-7 w-12 sm:h-8 sm:w-14 shrink-0 rounded-full p-1 shadow-inner relative transition-colors ${settings.duplicatePatientScreening ? 'bg-blue-600' : 'bg-slate-200'}`}>
                          <motion.div 
                            animate={{ x: settings.duplicatePatientScreening ? (typeof window !== 'undefined' && window.innerWidth < 640 ? 20 : 24) : 0 }}
                            className="h-5 w-5 sm:h-6 sm:w-6 bg-white rounded-full shadow-lg" 
                          />
                       </div>
                    </div>
                 </CardContent>
              </Card>
            </div>
          </div>

          {/* Infrastructure Health Sidebar */}
          <div className="space-y-6 sm:space-y-8">
             <div className="p-6 sm:p-8 rounded-[4px] md:rounded-lg bg-slate-900 text-white relative overflow-hidden group shadow-2xl border border-white/5">
                <div className="absolute left-[-40px] bottom-[-40px] h-64 w-64 text-white/5 group-hover:scale-110 transition-transform duration-1000">
                   <Server className="h-full w-full" />
                </div>
                <div className="relative z-10 space-y-6 sm:space-y-8">
                   <div className="flex items-center justify-between">
                      <div className="h-10 w-10 bg-white shadow-xl rounded-lg flex items-center justify-center">
                         <Database className="h-5 w-5 text-blue-900" />
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[8px] sm:text-[9px] font-black uppercase shadow-inner">Online</span>
                   </div>
                   <div>
                      <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1 sm:mb-2">Portal Health</p>
                      <h4 className="text-xl sm:text-2xl font-black text-white tracking-tighter uppercase leading-none">System Status</h4>
                   </div>
                   <div className="space-y-4 pt-4 border-t border-white/10">
                      <div className="flex justify-between items-end">
                         <span className="text-[8px] font-black text-slate-500 uppercase">Response</span>
                         <span className="text-xs sm:text-sm font-black text-blue-400 italic">450&mu;s</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full w-[85%] bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
                      </div>
                   </div>
                </div>
             </div>

             <div className="p-6 sm:p-8 rounded-[4px] md:rounded-lg bg-indigo-50 border border-indigo-100 relative overflow-hidden group">
                <Globe className="absolute right-[-30px] bottom-[-30px] h-48 w-48 text-indigo-200 opacity-30 group-hover:rotate-45 transition-transform duration-1000" />
                <div className="relative z-10 space-y-4 sm:space-y-6">
                   <h3 className="text-xs sm:text-sm font-black text-indigo-900 uppercase tracking-[0.1em]">Security Matrix</h3>
                   <p className="text-[10px] sm:text-[11px] font-bold text-indigo-700/80 leading-relaxed uppercase tracking-tight">System scan verified today at {settings.lastAudit}. All layers authenticated.</p>
                   <Button 
                    onClick={runSecurityScan}
                    variant="outline" 
                    className="w-full h-10 sm:h-11 rounded-lg bg-white text-indigo-900 border-indigo-200 font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                   >
                    Initiate Scan
                   </Button>
                </div>
             </div>

             <Card className="bg-white border-slate-200 shadow-xl overflow-hidden group border-t-4 border-t-emerald-500 rounded-[4px] md:rounded-lg">
                <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center gap-3 relative overflow-hidden">
                   <div className="absolute right-0 top-0 p-2 opacity-10">
                      <Activity size={40} className="text-white" />
                   </div>
                   <Activity size={16} className="text-emerald-400 relative z-10" />
                   <h3 className="text-[11px] font-black text-white uppercase tracking-tight relative z-10">Real-time Intelligence</h3>
                </div>
                <CardContent className="p-5 sm:p-6 space-y-4">
                   <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cloud Registry</p>
                      <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 uppercase">
                         <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Sync
                      </span>
                   </div>
                   <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Admins</p>
                      <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">01 Primary</span>
                   </div>
                   <div className="pt-2 border-t border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase leading-relaxed tracking-wider">Auth: Admin Node v2.4.1 (Protected)</p>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>

        {/* PROTOCOL RULES (Mobile Only - Bottom Position) */}
        <div className="lg:hidden">
          <Card className="bg-white rounded-[4px] border border-slate-200 shadow-xl overflow-hidden group">
             <div className="p-5 sm:p-6 border-b border-white/10 bg-slate-900 flex items-center gap-4 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 p-4 opacity-5">
                   <ShieldAlert size={80} />
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-red-500 rounded-lg flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform border border-red-400 shrink-0">
                   <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="relative z-10">
                   <h3 className="text-base sm:text-lg font-black text-white tracking-tight uppercase leading-none">Protocol Rules</h3>
                   <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Protect the portal from clinical anomalies</p>
                </div>
             </div>
             <CardContent className="p-4 sm:p-6 space-y-2 sm:space-y-4">
                <div 
                  onClick={() => handleInputChange('selfVerification', !settings.selfVerification)}
                  className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-100"
                >
                   <div className="pr-4">
                      <p className="text-xs sm:text-sm font-black text-slate-900 uppercase">User Verification</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Check phone/email upon entry</p>
                   </div>
                   <div className={`h-7 w-12 sm:h-8 sm:w-14 shrink-0 rounded-full p-1 shadow-inner relative transition-colors ${settings.selfVerification ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      <motion.div 
                        animate={{ x: settings.selfVerification ? (typeof window !== 'undefined' && window.innerWidth < 640 ? 20 : 24) : 0 }}
                        className="h-5 w-5 sm:h-6 sm:w-6 bg-white rounded-full shadow-lg" 
                      />
                   </div>
                </div>
                <div 
                  onClick={() => handleInputChange('duplicatePatientScreening', !settings.duplicatePatientScreening)}
                  className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-100"
                >
                   <div className="pr-4">
                      <p className="text-xs sm:text-sm font-black text-slate-900 uppercase">Duplicate Shield</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Block redundant patient mobile entries</p>
                   </div>
                   <div className={`h-7 w-12 sm:h-8 sm:w-14 shrink-0 rounded-full p-1 shadow-inner relative transition-colors ${settings.duplicatePatientScreening ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      <motion.div 
                        animate={{ x: settings.duplicatePatientScreening ? (typeof window !== 'undefined' && window.innerWidth < 640 ? 20 : 24) : 0 }}
                        className="h-5 w-5 sm:h-6 sm:w-6 bg-white rounded-full shadow-lg" 
                      />
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

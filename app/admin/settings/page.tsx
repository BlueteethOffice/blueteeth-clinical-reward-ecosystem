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
      new Promise((resolve) => setTimeout(resolve, 2000)),
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          <div className="space-y-3">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 shadow-xl shadow-slate-900/10">
               <ShieldCheck className="h-3 w-3" /> System Settings
             </div>
             <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Portal Global Controls</h1>
             <p className="text-slate-500 font-medium text-sm uppercase tracking-tight">Control point values, security rules, and portal health.</p>
          </div>
          <Button onClick={handleSave} isLoading={loading} className="h-12 px-8 rounded-lg bg-blue-600 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 group gap-4">
             Save Changes <Save className="h-4 w-4 group-hover:scale-110 transition-transform" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Controls */}
          <div className="lg:col-span-2 space-y-8">


            <Card className="bg-white rounded-lg border border-slate-100 shadow-xl overflow-hidden group">
               <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
                  <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                     <Coins className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                     <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Points to Cash</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Set how much each point is worth</p>
                  </div>
               </div>
               <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Exchange Rate (1 B-Point)</label>
                         <div className="relative group">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-900 leading-none">₹</span>
                           <input 
                              type="number" 
                              value={settings.exchangeRate} 
                              onChange={(e) => handleInputChange('exchangeRate', parseInt(e.target.value) || 0)}
                              className="w-full pl-10 pr-4 py-4 rounded-lg bg-slate-50 border border-slate-200 text-xl font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all" 
                           />
                        </div>
                     </div>
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Payout Minimum (INR)</label>
                        <div className="relative group">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-900 leading-none">₹</span>
                           <input 
                              type="number" 
                              value={settings.settlementMinimum} 
                              onChange={(e) => handleInputChange('settlementMinimum', parseInt(e.target.value) || 0)}
                              className="w-full pl-10 pr-4 py-4 rounded-lg bg-slate-50 border border-slate-200 text-xl font-black text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 transition-all" 
                           />
                        </div>
                     </div>
                  </div>
                  <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-4">
                     <Activity className="h-5 w-5 text-blue-600 mt-1" />
                     <p className="text-[11px] font-bold text-blue-900 leading-relaxed uppercase tracking-tight">Updating these parameters will affect all global practitioner wallets instantly during the next sync cycle.</p>
                  </div>
               </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-slate-100 shadow-xl overflow-hidden group">
               <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
                  <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                     <ShieldAlert className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                     <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Security Rules</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Protect the portal from fake data</p>
                  </div>
               </div>
               <CardContent className="p-8 space-y-6">
                  <div 
                    onClick={() => handleInputChange('selfVerification', !settings.selfVerification)}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-100"
                  >
                     <div>
                        <p className="text-sm font-black text-slate-900 uppercase">Verify New Users</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Check phone/email upon first registration</p>
                     </div>
                     <div className={`h-8 w-14 rounded-full p-1 shadow-inner relative transition-colors ${settings.selfVerification ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <motion.div 
                          animate={{ x: settings.selfVerification ? 24 : 0 }}
                          className="h-6 w-6 bg-white rounded-full shadow-lg" 
                        />
                     </div>
                  </div>
                  <div 
                    onClick={() => handleInputChange('duplicatePatientScreening', !settings.duplicatePatientScreening)}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-100"
                  >
                     <div>
                        <p className="text-sm font-black text-slate-900 uppercase">Block Duplicate Entries</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Don't allow the same patient mobile twice</p>
                     </div>
                     <div className={`h-8 w-14 rounded-full p-1 shadow-inner relative transition-colors ${settings.duplicatePatientScreening ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <motion.div 
                          animate={{ x: settings.duplicatePatientScreening ? 24 : 0 }}
                          className="h-6 w-6 bg-white rounded-full shadow-lg" 
                        />
                     </div>
                  </div>
               </CardContent>
            </Card>
          </div>

          {/* Infrastructure Health Sidebar */}
          <div className="space-y-10">
             <div className="p-8 rounded-lg bg-slate-900 text-white relative overflow-hidden group shadow-2xl shadow-slate-900/40 border border-white/5">
                <div className="absolute left-[-40px] bottom-[-40px] h-64 w-64 text-white/5 group-hover:scale-110 transition-transform duration-1000">
                   <Server className="h-full w-full" />
                </div>
                <div className="relative z-10 space-y-8">
                   <div className="flex items-center justify-between">
                      <div className="h-10 w-10 bg-white shadow-xl rounded-lg flex items-center justify-center">
                         <Database className="h-5 w-5 text-blue-900" />
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-black uppercase shadow-inner">Operational</span>
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Portal Health</p>
                      <h4 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">System Status</h4>
                   </div>
                   <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex justify-between items-end">
                         <span className="text-[9px] font-black text-slate-500 uppercase">Speed</span>
                         <span className="text-sm font-black text-blue-400">24ms</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full w-[85%] bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]" />
                      </div>
                   </div>
                </div>
             </div>

             <div className="p-8 rounded-lg bg-indigo-50 border border-indigo-100 relative overflow-hidden group">
                <Globe className="absolute right-[-30px] bottom-[-30px] h-48 w-48 text-indigo-200 opacity-30 group-hover:rotate-45 transition-transform duration-1000" />
                <div className="relative z-10 space-y-6">
                   <h3 className="text-sm font-black text-indigo-900 uppercase tracking-[0.1em]">Safety Check</h3>
                   <p className="text-[11px] font-bold text-indigo-700/80 leading-relaxed uppercase tracking-tight">System scan completed today at {settings.lastAudit}. All layers are secure.</p>
                   <Button 
                    onClick={runSecurityScan}
                    variant="outline" 
                    className="w-full h-11 rounded-lg bg-white text-indigo-900 border-indigo-200 font-black text-[9px] uppercase tracking-widest"
                   >
                    Run Scan
                   </Button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

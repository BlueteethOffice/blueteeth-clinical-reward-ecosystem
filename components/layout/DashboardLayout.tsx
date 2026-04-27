'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  Menu, X, LayoutDashboard, FilePlus, ListTodo, Wallet, 
  Users, Settings, LogOut, Bell, Search, UserCircle, Lock, ShieldCheck, Mail, Activity, CheckCircle2,
  ClipboardCheck, UserCheck, Coins, BadgeCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadProfileImage, updateUserProfile } from '@/lib/firestore';
import toast from 'react-hot-toast';

interface SidebarItem {
  name: string;
  href: string;
  icon: any;
}

const associateLinks: SidebarItem[] = [
  { name: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
  { name: 'Submit New Case', href: '/doctor/submit-case', icon: FilePlus },
  { name: 'Case History', href: '/doctor/cases', icon: ListTodo },
  { name: 'My Earnings', href: '/doctor/earnings', icon: Wallet },
  { name: 'Settings', href: '/doctor/settings', icon: Settings },
];

const adminLinks: SidebarItem[] = [
  { name: 'Admin Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Review Cases', href: '/admin/review', icon: ClipboardCheck },
  { name: 'Final Approvals', href: '/admin/approvals', icon: BadgeCheck },
  { name: 'Associates List', href: '/admin/doctors', icon: Users },
  { name: 'Clinicians List', href: '/admin/clinicians', icon: UserCheck },
  { name: 'Earning Records', href: '/admin/earnings', icon: Coins },
  { name: 'Portal Settings', href: '/admin/settings', icon: Settings },
];

const clinicianLinks: SidebarItem[] = [
  { name: 'Dashboard', href: '/clinician', icon: LayoutDashboard },
  { name: 'Submit New Case', href: '/clinician/submit-case', icon: FilePlus },
  { name: 'My Submissions', href: '/clinician/my-cases', icon: FilePlus },
  { name: 'Assigned Cases', href: '/clinician/cases', icon: ListTodo },
  { name: 'My Earnings', href: '/clinician/earnings', icon: Wallet },
  { name: 'Settings', href: '/clinician/settings', icon: Settings },
];

export default function DashboardLayout({ 
  children, 
  isAdminRoute = false 
}: { 
  children: React.ReactNode; 
  isAdminRoute?: boolean;
}) {
  const { user, userData, loading: authLoading, logout, isAdmin: isUserAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);

  const isClinicianPath = pathname?.startsWith('/clinician');
  const isClinician = userData?.role === 'clinician' || (isClinicianPath && !isAdminRoute);

  const navigation = isAdminRoute 
    ? adminLinks 
    : (isClinician ? clinicianLinks : associateLinks);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // [UX OPTIMIZATION] Global Scroll Lock for Mobile Sidebar
  React.useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }, [sidebarOpen]);

  // Identity is now derived safely with hydration-aware guard + Admin Persistent Fallback
  const [localProfile, setLocalProfile] = useState<any>(null);

  React.useEffect(() => {
    if (mounted) {
       const uid = user?.uid || 'admin';
       const cached = localStorage.getItem(`clinical_identity_snapshot_${uid}`);
       if (cached) setLocalProfile(JSON.parse(cached));
    }
  }, [mounted, user?.uid]);

  const rawName = userData?.name || user?.displayName || localProfile?.name || 'Partner';
  const displayName = mounted ? (
    isClinician 
      ? (rawName.toLowerCase().startsWith('dr.') ? rawName : `Dr. ${rawName}`)
      : rawName.replace(/^Dr\.\s*/i, '')
  ) : 'Partner';

  const displayPhoto = mounted ? (userData?.photoURL || localProfile?.photoURL || user?.photoURL || '') : '';
  const displaySpec = mounted ? (
    (userData?.role === 'admin' || isUserAdmin) 
      ? 'Main Admin' 
      : (isClinician ? 'Clinician' : 'Associate Partner')
  ) : '';

  // Listen for internal identity updates
  React.useEffect(() => {
    const handleUpdate = () => {
       const uid = user?.uid || 'admin';
       const cached = localStorage.getItem(`clinical_identity_snapshot_${uid}`);
       if (cached) setLocalProfile(JSON.parse(cached));
    };
    window.addEventListener('clinical-identity-update', handleUpdate);
    return () => window.removeEventListener('clinical-identity-update', handleUpdate);
  }, [user?.uid]);

  React.useEffect(() => {
    if (!user || !db) return;
    const q = isAdminRoute 
      ? query(collection(db, 'notifications'), where('userId', '==', 'admin'))
      : query(collection(db, 'notifications'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.read === true) return;
        let timeLabel = 'Just now';
        if (data.createdAt) {
          const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          const diff = Math.floor((new Date().getTime() - date.getTime()) / 60000);
          if (diff > 0 && diff < 60) timeLabel = `${diff}m ago`;
          else if (diff >= 60 && diff < 1440) timeLabel = `${Math.floor(diff/60)}h ago`;
          else if (diff >= 1440) timeLabel = date.toLocaleDateString();
        }
        notifs.push({ id: docSnap.id, ...data, time: timeLabel, rawDate: data.createdAt?.toDate ? data.createdAt.toDate() : new Date() });
      });
      const sortedNotifs = notifs.sort((a, b) => (b.rawDate?.getTime() || 0) - (a.rawDate?.getTime() || 0));
      setNotifications(sortedNotifs);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Notifications sync paused (logged out)");
      } else {
        console.error("Notifications sync error:", error);
      }
    });
    return () => unsubscribe();
  }, [user, isAdminRoute]);

  React.useEffect(() => {
    if (mounted && !authLoading) {
      if (!user) {
        setLoading(false);
        router.replace('/auth/login');
        return;
      }

      const userRole = userData?.role;
      const hasAdminRole = userRole === 'admin' || isUserAdmin;

      // 1. Admin Route Protection
      if (isAdminRoute) {
        if (!hasAdminRole) {
          toast.error("SECURITY: Administrative access denied.");
          router.replace(userRole === 'clinician' ? '/clinician' : '/doctor');
          return;
        }
      } 
      // 2. Clinician Route Protection
      else if (isClinicianPath) {
        if (userRole !== 'clinician' && !hasAdminRole) {
          toast.error("SECURITY: Specialist access restricted.");
          router.replace('/doctor');
          return;
        }
      }
      // 3. Associate (Doctor) Route Protection - Standard for default /doctor
      else if (pathname?.startsWith('/doctor')) {
        if (userRole === 'clinician' && !hasAdminRole) {
          router.replace('/clinician');
          return;
        }
      }

      setLoading(false);
    }
  }, [mounted, authLoading, isAdminRoute, userData, user, router, isUserAdmin, isClinicianPath, pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/login');
      toast.success('Logged out successfully');
    } catch (error) { console.error("Logout failed:", error); }
  };

  const copySupportEmail = () => {
    navigator.clipboard.writeText('support@blueteeth.in');
    toast.success('Support email copied!');
  };

  const isActive = (path: string) => {
    if (path === pathname) return true;
    
    if (path.includes('?')) {
      const [basePath, queryString] = path.split('?');
      if (basePath === pathname) {
        const expectedParams = new URLSearchParams(queryString);
        for (const [key, value] of Array.from(expectedParams.entries())) {
           if (searchParams?.get(key) !== value) return false;
        }
        return true;
      }
    }
    return false;
  };
  const avatarName = displayName;
  const initials = avatarName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'A';

  // [SMOOTHNESS OPTIMIZATION] Global Loading Overlay for Refresh/Auth
  if (!mounted || (authLoading && !localProfile)) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full animate-pulse" />
          <div className="relative h-20 w-20 bg-white rounded-[4px] flex items-center justify-center p-3 shadow-2xl mb-8">
            <img src="/logo.png" className="h-full w-full object-contain" alt="Logo" />
          </div>
        </motion.div>
        <div className="space-y-4">
          <div className="flex flex-col">
            <span className="text-2xl font-black text-white tracking-tighter uppercase mb-1">Blueteeth Clinical</span>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Identity Hub Syncing...</span>
          </div>
          <div className="h-1 w-48 bg-white/10 rounded-full overflow-hidden mx-auto border border-white/5">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="h-full w-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative" suppressHydrationWarning>
      {/* Background Decor - Optimized for Performance */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" suppressHydrationWarning>
        <div className="absolute top-[-5%] left-[5%] w-[45rem] h-[45rem] bg-indigo-400/20 rounded-[4px] blur-[90px]" />
        <div className="absolute bottom-[-5%] right-[5%] w-[35rem] h-[35rem] bg-blue-500/20 rounded-[4px] blur-[90px]" />
        <div className="absolute top-[40%] left-[40%] w-[25rem] h-[25rem] bg-violet-300/10 rounded-[4px] blur-[80px]" />
      </div>

      {/* Desktop Sidebar - Final Balanced Full-Height Version */}
      <div className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:top-4 lg:left-4 lg:bottom-4 lg:z-50" suppressHydrationWarning>
        <div className="flex flex-col h-full bg-blue-900 border border-white/10 rounded-[4px] p-5 pb-4 shadow-2xl overflow-y-auto no-scrollbar space-y-3 overflow-x-hidden" suppressHydrationWarning>
          
          {/* Top Group: Logo + Navigation */}
          <div className="flex flex-col">
            <div className="flex items-center px-2 mb-6 shrink-0">
              <div className="h-9 w-9 bg-white rounded-[4px] flex items-center justify-center p-1.5 shadow-lg shadow-white/5">
                <img src="/logo.png" className="h-full w-full object-contain" alt="Logo" />
              </div>
              <span className="ml-3 text-lg font-black text-white tracking-tight">Blueteeth</span>
            </div>
            
            <nav className="space-y-2">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <div className={`flex items-center px-4 py-3 text-[12px] font-bold uppercase tracking-widest rounded-[4px] transition-all duration-300 ${
                    isActive(item.href) 
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 ring-1 ring-white/10' 
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}>
                    <item.icon className="mr-4 h-5 w-5" />
                    {item.name}
                  </div>
                </Link>
              ))}
            </nav>
          </div>

          {/* Bottom Group: Support + Profile + Sign Out */}
          <div className="mt-auto flex flex-col gap-4">
            {isAdminRoute ? (
              <div className="p-5 rounded-[4px] bg-gradient-to-br from-indigo-500/20 to-transparent border border-white/10 relative overflow-hidden group">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" /> ADMIN CONTROL
                </p>
                <div className="flex flex-col gap-1.5 mb-4">
                   <div className="flex items-center gap-2 text-[8px] font-black text-white/40 uppercase tracking-tighter bg-black/20 px-2 py-1 rounded w-fit italic">
                      ID: SYSTEM-001
                   </div>
                   <div className="flex items-center gap-2 text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] animate-pulse">
                      <Activity size={10} className="shrink-0" /> SYSTEM ONLINE & SECURE
                   </div>
                </div>
                <div className="py-2.5 bg-indigo-600/20 text-white text-[8px] font-black uppercase tracking-widest rounded-[4px] border border-indigo-400/20 text-center shadow-inner">
                  STATUS: WORKING WELL
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-[4px] bg-slate-900 border border-white/10 relative overflow-hidden group shadow-xl">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-500/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                <div className="absolute -bottom-4 -left-4 w-14 h-14 bg-indigo-500/20 rounded-full blur-xl" />
                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1.5 relative z-10">Help & Support</p>
                <p className="text-[11px] text-white font-bold leading-relaxed mb-3 relative z-10">Questions? Our support team is here 24/7 to help you.</p>
                <div className="flex flex-col gap-2 relative z-10">
                  <div className="flex items-center justify-between gap-2 bg-white/10 px-2.5 py-2 rounded-[4px] border border-white/10">
                    <a href="mailto:support@blueteeth.in"
                       className="flex items-center gap-2 text-[10px] text-sky-400 hover:text-white font-black transition-colors underline underline-offset-2 group/mail truncate">
                      <Mail className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                      support@blueteeth.in
                    </a>
                    <button onClick={copySupportEmail} className="p-1 hover:bg-white/10 rounded transition-colors shrink-0" title="Copy Email">
                       <svg className="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                    </button>
                  </div>
                  <Link href="https://wa.me/919311997440" target="_blank">
                    <button className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-[4px] transition-all shadow-lg shadow-green-500/30">
                      Connect on WhatsApp
                    </button>
                  </Link>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Link href={isAdminRoute ? "/admin/settings" : (isClinician ? "/clinician/settings" : "/doctor/settings")}>
                <div className="p-4 rounded-[4px] bg-gradient-to-br from-indigo-600/60 via-blue-600/40 to-blue-700/50 border border-indigo-400/20 flex items-center gap-4 transition-all relative overflow-hidden group cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/20 active:scale-[0.98]">
                  <div className="absolute -top-4 -right-4 w-20 h-20 bg-indigo-400/20 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                  <div className="h-10 w-10 bg-white/90 rounded-[4px] flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 p-0.5 overflow-hidden relative z-10">
                    {displayPhoto ? <img src={displayPhoto} alt="P" className="h-full w-full object-cover rounded-sm" /> : <span className="text-indigo-900 font-black text-xs">{initials}</span>}
                  </div>
                  <div className="flex flex-col min-w-0 relative z-10">
                    <p className="text-[11px] font-black text-white truncate leading-none">
                      {displayName}
                    </p>
                    <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-tight mt-1 truncate">
                      {displaySpec}
                    </p>
                  </div>
                </div>
              </Link>

              <Button variant="ghost" onClick={handleLogout} className="w-full h-10 px-6 justify-start text-red-100 font-black bg-red-500/10 border border-red-500/20 hover:bg-red-600 hover:text-white rounded-[4px] transition-all">
                  <LogOut className="h-4 w-4 mr-4" />
                  <span className="tracking-widest uppercase text-[10px]">Sign Out Portal</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 lg:ml-80 min-w-0 pb-0 lg:pb-0 px-2 sm:px-6 lg:px-8">
        <header className="pt-3 pb-3">
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-[4px] px-3 sm:px-4 py-2.5 shadow-lg shadow-slate-200/10">
            <button className="lg:hidden p-2 text-slate-700 bg-slate-50 border border-slate-200 rounded-[4px]" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
            </button>
            <div className="hidden lg:flex relative group ml-2 items-center">
               <Suspense fallback={<div className="w-80 h-10 bg-slate-100 rounded-[4px] animate-pulse" />}>
                 <SearchInput />
               </Suspense>
            </div>
             <div className="flex items-center gap-x-3 sm:gap-x-5 ml-auto relative">
               <Suspense fallback={<div className="w-40 h-10 bg-slate-100 rounded-[4px] animate-pulse" />}>
                 <HeaderActions isAdminRoute={isAdminRoute} isUserAdmin={isUserAdmin} user={user} displayName={displayName} displaySpec={displaySpec} displayPhoto={displayPhoto} notifications={notifications} showNotifications={showNotifications} setShowNotifications={setShowNotifications} mounted={mounted} isClinician={isClinician} />
               </Suspense>
            </div>
          </div>
        </header>
        <AnimatePresence>
          <motion.main
            key={pathname}
            className="mt-2 sm:mt-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-[150] lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div 
              initial={{ x: '-100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '-100%' }} 
              transition={{ type: 'tween', duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed inset-y-0 left-0 z-[160] w-[280px] bg-white flex flex-col shadow-2xl overflow-hidden will-change-transform"
            >
              <div className="p-4 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white relative overflow-hidden">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-[4px] flex items-center justify-center overflow-hidden p-1.5 transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-blue-500/20 bg-gradient-to-br from-blue-600 to-indigo-700 ring-2 ring-blue-400/30">
                     <img src="/logo.png" className="h-full w-full object-contain" alt="Logo" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Blueteeth</span>
                    <span className="text-[7.5px] font-black text-blue-600 uppercase tracking-widest mt-1">{isClinician ? 'Clinician Panel' : 'Associate Portal'}</span>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="h-10 w-10 flex items-center justify-center bg-red-50 rounded-[4px] text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-200 shadow-md shadow-red-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-6 space-y-6 flex flex-col no-scrollbar">
                {/* Profile Overview (Mobile - Vibrant) */}
                <Link href={isAdminRoute ? "/admin/settings" : (isClinician ? "/clinician/settings" : "/doctor/settings")} onClick={() => setSidebarOpen(false)}>
                  <div className="p-4 rounded-[4px] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 border border-indigo-400/30 flex items-center gap-4 transition-all shrink-0 relative overflow-hidden shadow-xl shadow-indigo-500/20 cursor-pointer active:scale-95">
                    <div className="absolute -top-3 -right-3 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="absolute -bottom-3 -left-3 w-12 h-12 bg-violet-400/20 rounded-full blur-lg" />
                    <div className="h-11 w-11 bg-white rounded-[4px] flex items-center justify-center shrink-0 shadow-lg shadow-indigo-700/40 p-0.5 overflow-hidden border-2 border-white/80 relative z-10">
                      {displayPhoto ? <img src={displayPhoto} alt="P" className="h-full w-full object-cover rounded-sm" /> : <span className="text-indigo-700 font-black text-sm">{initials}</span>}
                    </div>
                    <div className="flex flex-col min-w-0 relative z-10">
                      <p className="text-[13px] font-black text-white truncate leading-none drop-shadow-sm">
                        {displayName}
                      </p>
                      <span className="mt-1.5 inline-flex w-fit items-center px-2 py-0.5 rounded-[4px] bg-white/20 border border-white/30 text-[8px] font-black text-white/90 uppercase tracking-widest backdrop-blur-sm">
                        {displaySpec}
                      </span>
                    </div>
                  </div>
                </Link>
 
                <nav className="space-y-1.5">
                  {navigation.map((item) => (
                    <Link key={item.name} href={item.href} onClick={() => setSidebarOpen(false)}>
                      <div className={`flex items-center px-4 py-3.5 text-[12px] font-bold uppercase tracking-[0.15em] rounded-[4px] transition-all ${
                        isActive(item.href) 
                          ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' 
                          : 'text-slate-900 hover:bg-slate-50 hover:text-blue-600'
                      }`}>
                        <item.icon className="mr-4 h-5.5 w-5.5" />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  ))}
                </nav>

                {/* Mobile Specific Clinical Support Node (Dark High-Contrast) */}
                {!isAdminRoute && (
                  <div className="mt-2 p-5 rounded-[4px] bg-slate-900 border border-white/10 relative overflow-hidden group shrink-0 shadow-xl">
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl" />
                    <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-indigo-500/20 rounded-full blur-xl" />
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 relative z-10">Help & Support</p>
                    <p className="text-[11px] text-white font-bold leading-relaxed mb-4 relative z-10">Questions? Our support team is here 24/7 to help you.</p>
                    <div className="flex flex-col gap-2 relative z-10">
                       <div className="flex items-center gap-2 justify-between bg-white/10 p-2.5 rounded-[4px] border border-white/10">
                         <a href="mailto:support@blueteeth.in" className="text-[9px] text-sky-400 hover:text-white font-black truncate underline underline-offset-2">support@blueteeth.in</a>
                         <button onClick={copySupportEmail} className="p-1.5 bg-white/10 border border-white/20 rounded hover:bg-white/20 transition-all">
                           <svg className="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                         </button>
                       </div>
                       <Link href="https://wa.me/919311997440" target="_blank" className="block">
                        <button className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-[4px] transition-all shadow-lg shadow-green-500/30">
                          WhatsApp Sync
                        </button>
                       </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-slate-100 mt-auto shrink-0 bg-slate-50 space-y-1">
                 <Button variant="ghost" onClick={handleLogout} className="w-full h-11 rounded-[4px] text-red-600 bg-white border border-red-100 hover:bg-red-500 hover:text-white justify-start font-black text-[10px] uppercase tracking-widest transition-all shadow-sm">
                    <LogOut className="mr-3 h-4 w-4" /> Sign Out Portal
                 </Button>
                  <div className="pb-1 text-center">
                    {/* Identity Disclaimer Removed - Minimized padding to shift button down */}
                  </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchInput() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (searchValue) params.set('q', searchValue); else params.delete('q');
      const newQuery = params.toString();
      const newUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
      router.replace(newUrl, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, pathname, router]);
  return (
    <div className="relative group flex items-center">
      <input type="text" placeholder="Search cases..." className="pl-11 pr-4 py-2 bg-white border border-slate-200 rounded-[4px] text-sm font-semibold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 w-full sm:w-80 h-10 transition-all shadow-sm" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
      <Search className="absolute left-4 h-4 w-4 text-slate-400" />
    </div>
  );
}

function HeaderActions({ isAdminRoute, isUserAdmin, user, displayName, displaySpec, displayPhoto, notifications, showNotifications, setShowNotifications, mounted, isClinician }: any) {
  const handleAdminPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isAdminRoute) {
      const toastId = toast.loading('Syncing...');
      const uid = user?.uid || 'admin';
      const processFile = () => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
             const img = new Image();
             img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                const m = 400;
                if (w > m || h > m) { if (w > h) { h *= m/w; w = m; } else { w *= m/h; h = m; } }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
             };
             img.src = reader.result as string;
          };
          reader.readAsDataURL(file);
      });
      try {
          const compressed = await processFile();
          localStorage.setItem(`clinical_identity_snapshot_${uid}`, JSON.stringify({ name: displayName, photoURL: compressed }));
          window.dispatchEvent(new Event('clinical-identity-update'));
          if (user?.uid) {
             const res = await uploadProfileImage(uid, compressed);
             if (res?.success) await updateUserProfile(uid, { photoURL: res.url });
          }
          toast.success('Done.', { id: toastId });
      } catch (err) { toast.error('Error'); }
    }
  };
  return (
    <>
      <div className="relative">
        <button onClick={() => setShowNotifications(!showNotifications)} className={`p-2 rounded-[4px] border transition-all shadow-sm ${showNotifications ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-700 bg-slate-50 border-slate-200'}`}>
          <Bell className="h-4.5 w-4.5" />
          {notifications.length > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-rose-500 rounded-[4px] border-2 border-white animate-pulse"></span>}
        </button>
        <AnimatePresence>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute right-[-60px] sm:right-0 mt-3 w-[calc(100vw-32px)] sm:w-80 bg-white rounded-[4px] shadow-2xl border border-slate-100 overflow-hidden z-[70] origin-top-right">
                <div className="h-1 w-full bg-blue-600" />
                <div className="p-4 border-b border-white/5 bg-slate-900 flex justify-between items-center relative overflow-hidden">
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] relative z-10 text-white">Notifications Center</span>
                   <span className="bg-blue-600/20 text-blue-400 text-[9px] px-3 py-1 border border-blue-500/20 rounded-[4px] font-black relative z-10">{notifications.length} New</span>
                </div>
                <div className="max-h-80 overflow-y-auto no-scrollbar">
                  {notifications.length > 0 ? notifications.map((notif: any) => (
                    <div 
                      key={notif.id} 
                      onClick={async () => {
                         const { doc, updateDoc } = await import('firebase/firestore');
                         await updateDoc(doc(db, 'notifications', notif.id), { read: true });
                         toast.success("Marked as read", { id: 'notif-read', duration: 1000 });
                      }}
                      className={`relative m-2 overflow-hidden rounded-[4px] border-2 transition-all cursor-pointer group shadow-sm hover:shadow-md ${
                        notif.type === 'success' ? 'border-emerald-500/20 hover:border-emerald-500/40 bg-white' :
                        notif.type === 'error' ? 'border-rose-500/20 hover:border-rose-500/40 bg-white' :
                        'border-blue-600/20 hover:border-blue-600/40 bg-white'
                      }`}
                    >
                      {/* Top Status Patti */}
                      <div className={`h-1 w-full ${
                        notif.type === 'success' ? 'bg-emerald-500' :
                        notif.type === 'error' ? 'bg-rose-500' :
                        'bg-blue-600'
                      }`} />

                      <div className="p-4 relative z-10">
                        <div className="flex justify-between items-start mb-1">
                           <p className="text-[10px] font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{notif.title}</p>
                           <span className="text-[8px] font-bold text-slate-400 uppercase">{notif.time || 'NEW'}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-bold leading-relaxed line-clamp-2">{notif.msg}</p>
                        <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                           <div className={`w-1 h-1 rounded-[4px] ${notif.type === 'success' ? 'bg-emerald-500' : notif.type === 'error' ? 'bg-rose-500' : 'bg-blue-600'}`} />
                           <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Mark Resolved</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-16 text-center space-y-4">
                       <div className="h-12 w-12 bg-slate-50 rounded-[4px] flex items-center justify-center mx-auto border border-slate-100">
                          <Bell size={20} className="text-slate-200" />
                       </div>
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">All Systems Clear</p>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-slate-50 border-t border-slate-100">
                   <Link href="/notifications" onClick={() => setShowNotifications(false)}>
                      <button className="w-full py-2.5 bg-white border border-slate-200 rounded-[4px] text-[9px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95">
                         View All Notifications Center
                      </button>
                   </Link>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <div className="h-8 w-px bg-slate-200" />
      {isAdminRoute ? (
        <Link href="/admin/settings">
          <div className="relative flex items-center gap-2 sm:gap-3 cursor-pointer group">
            <div className="text-right hidden md:block">
              <p className="text-[13px] font-black text-blue-600 leading-none group-hover:text-blue-700 transition-colors uppercase tracking-tight">{displayName || 'Admin'}</p>
              <p className="text-[8px] text-slate-400 uppercase mt-1 font-black tracking-widest">Administrator</p>
            </div>
            <div className="h-9 w-9 sm:h-10 sm:w-10 bg-slate-50 rounded-[4px] border border-slate-200 overflow-hidden flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              {displayPhoto ? <img src={displayPhoto} className="h-full w-full object-cover" /> : <UserCircle className="h-full w-full text-slate-300" />}
            </div>
            <input type="file" accept="image/*" onChange={handleAdminPhotoChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
          </div>
        </Link>
      ) : (
        <Link href={isClinician ? "/clinician/settings" : "/doctor/settings"}>
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group">
            <div className="text-right hidden md:block">
              <p className="text-[13px] font-black text-blue-600 leading-none group-hover:text-blue-700 transition-colors uppercase tracking-tight">{displayName}</p>
              <p className="text-[8px] text-slate-400 uppercase mt-1 font-black tracking-widest">{displaySpec}</p>
            </div>
            <div className="h-9 w-9 sm:h-10 sm:w-10 bg-slate-50 rounded-[4px] border border-slate-200 overflow-hidden flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              {displayPhoto ? <img src={displayPhoto} className="h-full w-full object-cover" /> : <UserCircle className="h-full w-full text-slate-300" />}
            </div>
          </div>
        </Link>
      )}
    </>
  );
}

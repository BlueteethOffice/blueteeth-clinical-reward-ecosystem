'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  Menu, X, LayoutDashboard, FilePlus, ListTodo, Wallet, 
  Users, Settings, LogOut, Bell, Search, UserCircle, Lock, ShieldCheck, Mail, Activity
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

const doctorLinks: SidebarItem[] = [
  { name: 'Dashboard', href: '/doctor', icon: LayoutDashboard },
  { name: 'Submit New Case', href: '/doctor/submit-case', icon: FilePlus },
  { name: 'Case History', href: '/doctor/cases', icon: ListTodo },
  { name: 'My Earnings', href: '/doctor/earnings', icon: Wallet },
  { name: 'Settings', href: '/doctor/settings', icon: Settings },
];

const adminLinks: SidebarItem[] = [
  { name: 'Admin Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Review Cases', href: '/admin/review', icon: ListTodo },
  { name: 'Doctors List', href: '/admin/doctors', icon: Users },
  { name: 'Earning Records', href: '/admin/earnings', icon: Wallet },
  { name: 'Portal Settings', href: '/admin/settings', icon: Settings },
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
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [displaySpec, setDisplaySpec] = useState('Clinical Practitioner');
  const [displayPhoto, setDisplayPhoto] = useState('');

  const navigation = isAdminRoute ? adminLinks : doctorLinks;

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

  React.useEffect(() => {
    const updateProfile = () => {
      if (!user) return;
      if (userData?.name || userData?.photoURL) {
          if (userData.name) setDisplayName(userData.name);
          if (userData.photoURL) setDisplayPhoto(userData.photoURL);
      } else {
          const localProfile = localStorage.getItem(`clinical_identity_snapshot_${user.uid}`);
          if (localProfile) {
            try {
              const parsed = JSON.parse(localProfile);
              if (parsed.name) setDisplayName(parsed.name);
              if (parsed.photoURL) setDisplayPhoto(parsed.photoURL);
            } catch (e) {}
          } else {
            setDisplayName(user.displayName || '');
            setDisplayPhoto(user.photoURL || '');
          }
      }
      if (userData?.role === 'admin' || isUserAdmin) setDisplaySpec('Master Admin');
    };
    updateProfile();
    window.addEventListener('clinical-identity-update', updateProfile);
    window.addEventListener('focus', updateProfile);
    return () => {
      window.removeEventListener('clinical-identity-update', updateProfile);
      window.removeEventListener('focus', updateProfile);
    };
  }, [user, userData, isUserAdmin]);

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
      if (isAdminRoute) {
         if (!userData) return; 
          const masterEmails = ['admin@blueteeth.in', 'nitinchauhan378@gmail.com', 'niteen02@gmail.com', 'niteen02', 'support@blueteeth.in'];
          const userEmailRaw = user.email?.toLowerCase();
          const isRootEmail = userEmailRaw && masterEmails.map(e => e.toLowerCase()).includes(userEmailRaw);
          const hasAdminRole = userData?.role === 'admin' || isUserAdmin;
         if (!isRootEmail && !hasAdminRole) {
            toast.error("SECURITY LOCK: Administrative privileges required.");
            router.replace('/doctor');
            return;
         }
      }
      setLoading(false);
    }
  }, [mounted, authLoading, isAdminRoute, userData, user, router, isUserAdmin]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/login');
    } catch (error) { console.error("Logout failed:", error); }
  };

  const isActive = (path: string) => pathname === path;
  const avatarName = displayName.startsWith('Dr. ') ? displayName.slice(4) : displayName;
  const initials = avatarName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'D';

  if (mounted && !authLoading && loading) {
    return (
      <div className="min-h-[100svh] bg-slate-50 flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative">
      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[5%] w-[60rem] h-[60rem] bg-indigo-100/40 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[50rem] h-[50rem] bg-blue-100/40 rounded-full blur-[140px]" />
      </div>

      {/* Desktop Sidebar - Final Balanced Full-Height Version */}
      <div className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:top-4 lg:left-4 lg:bottom-4 lg:z-50">
        <div className="flex flex-col h-full bg-blue-900 border border-white/10 rounded-xl p-6 shadow-2xl overflow-hidden space-y-6">
          
          {/* Top Group: Logo + Navigation */}
          <div className="flex flex-col">
            <div className="flex items-center px-2 mb-8 shrink-0">
              <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg shadow-white/5">
                <img src="/logo.png" className="h-full w-full object-contain" alt="Logo" />
              </div>
              <span className="ml-4 text-xl font-black text-white tracking-tight">Blueteeth</span>
            </div>
            
            <nav className="space-y-3">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <div className={`flex items-center px-5 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
                    isActive(item.href) 
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 ring-1 ring-white/10' 
                      : 'text-blue-100/60 hover:bg-white/5 hover:text-white'
                  }`}>
                    <item.icon className="mr-4 h-5 w-5" />
                    {item.name}
                  </div>
                </Link>
              ))}
            </nav>
          </div>

          {/* Bottom Group: Support + Profile + Sign Out */}
          <div className="mt-auto flex flex-col gap-6">
            {isAdminRoute ? (
              <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-transparent border border-white/10 relative overflow-hidden group">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" /> MASTER AUDIT NODE
                </p>
                <div className="flex flex-col gap-1.5 mb-4">
                   <div className="flex items-center gap-2 text-[8px] font-black text-white/40 uppercase tracking-tighter bg-black/20 px-2 py-1 rounded w-fit italic">
                      ID: SECURITY-NODE-001
                   </div>
                   <div className="flex items-center gap-2 text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] animate-pulse">
                      <Activity size={10} className="shrink-0" /> SECURITY SYNC ACTIVE
                   </div>
                </div>
                <div className="py-2.5 bg-indigo-600/20 text-white text-[8px] font-black uppercase tracking-widest rounded-lg border border-indigo-400/20 text-center shadow-inner">
                  SYSTEM STATUS: OPTIMAL
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-400/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1.5">Clinical Support</p>
                <p className="text-[11px] text-white font-bold leading-relaxed mb-2">Our clinical experts are here for you 24/7.</p>
                <a href="mailto:support@blueteeth.in" className="flex items-center gap-2 text-[10px] text-blue-300 hover:text-blue-100 font-black transition-colors block mb-4 underline underline-offset-2 group/mail">
                  <Mail className="h-3.5 w-3.5 text-blue-400 group-hover/mail:text-white transition-colors" />
                  support@blueteeth.in
                </a>
                <Link href="https://wa.me/919311997440" target="_blank">
                  <button className="w-full py-2 bg-white/20 hover:bg-white/30 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border border-white/20">
                    Connect on WhatsApp
                  </button>
                </Link>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-lg bg-blue-600/50 border border-white/10 flex items-center gap-4 transition-all">
                <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-lg p-0.5 overflow-hidden">
                  {displayPhoto ? <img src={displayPhoto} alt="P" className="h-full w-full object-cover rounded-sm" /> : <span className="text-blue-900 font-black text-xs">{initials}</span>}
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-[11px] font-black text-white truncate leading-none">
                    {displayName ? (displayName.startsWith('Dr.') ? displayName : `Dr. ${displayName}`) : 'Doctor'}
                  </p>
                  <p className="text-[9px] font-bold text-blue-200/80 uppercase tracking-tight mt-1 truncate">
                    {isAdminRoute ? 'Admin' : 'Practice Doctor'}
                  </p>
                </div>
              </div>

              <Button variant="ghost" onClick={handleLogout} className="w-full h-12 px-6 justify-start text-red-100 font-black bg-red-500/10 border border-red-500/20 hover:bg-red-600 hover:text-white rounded-lg transition-all">
                  <LogOut className="h-4 w-4 mr-4" />
                  <span className="tracking-widest uppercase text-[10px]">Sign Out Portal</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 lg:ml-80 min-w-0 pb-10 px-4 sm:px-8">
        <header className="py-4 sm:py-5">
          <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg px-4 py-3 shadow-xl shadow-slate-200/20">
            <button className="lg:hidden p-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-6 w-6" />
            </button>
            <div className="hidden lg:flex relative group ml-2 items-center">
               <Suspense fallback={<div className="w-80 h-11 bg-slate-100 rounded-lg animate-pulse" />}>
                 <SearchInput />
               </Suspense>
            </div>
             <div className="flex items-center gap-x-5 ml-auto relative">
               <Suspense fallback={<div className="w-40 h-10 bg-slate-100 rounded-xl animate-pulse" />}>
                 <HeaderActions isAdminRoute={isAdminRoute} user={user} displayName={displayName} displaySpec={displaySpec} displayPhoto={displayPhoto} notifications={notifications} showNotifications={showNotifications} setShowNotifications={setShowNotifications} mounted={mounted} />
               </Suspense>
            </div>
          </div>
        </header>
        <main className="lg:pt-2">{children}</main>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-[150] lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div 
              initial={{ x: '-100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '-100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-[160] w-[280px] bg-white flex flex-col shadow-2xl overflow-hidden will-change-transform"
            >
              <div className="p-6 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white relative overflow-hidden">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-xl shadow-blue-500/10 overflow-hidden p-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-slate-50">
                     <img src="/logo.png" className="h-full w-full object-contain" alt="Logo" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Blueteeth</span>
                    <span className="text-[7.5px] font-black text-blue-600 uppercase tracking-widest mt-1">Clinical Portal</span>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="h-10 w-10 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-200/50">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-6 space-y-6 flex flex-col no-scrollbar">
                {/* Profile Overview (Mobile Light Mode) */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-4 transition-all shrink-0">
                  <div className="h-10 w-10 bg-white rounded-md flex items-center justify-center shrink-0 shadow-sm p-0.5 overflow-hidden border border-slate-100">
                    {displayPhoto ? <img src={displayPhoto} alt="P" className="h-full w-full object-cover rounded-sm" /> : <span className="text-blue-900 font-black text-xs">{initials}</span>}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-[11px] font-black text-slate-900 truncate leading-none">
                      {displayName ? (displayName.startsWith('Dr.') ? displayName : `Dr. ${displayName}`) : 'Doctor'}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 border border-slate-100 bg-white px-1.5 py-0.5 rounded-md w-fit uppercase tracking-tighter mt-1 truncate">
                      {isAdminRoute ? 'Admin' : 'Practice Doctor'}
                    </p>
                  </div>
                </div>
 
                <nav className="space-y-1.5">
                  {navigation.map((item) => (
                    <Link key={item.name} href={item.href} onClick={() => setSidebarOpen(false)}>
                      <div className={`flex items-center px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] rounded-md transition-all ${
                        isActive(item.href) 
                          ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}>
                        <item.icon className="mr-4 h-5 w-5" />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  ))}
                </nav>

                {/* Mobile Specific Clinical Support Node (Light) */}
                {!isAdminRoute && (
                  <div className="mt-2 p-5 rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 relative overflow-hidden group shrink-0 shadow-sm">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-100 rounded-full blur-2xl" />
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5 leading-none">Clinical Support</p>
                    <p className="text-[10px] text-slate-700 font-bold leading-relaxed mb-4">Experts are live 24/7 for you.</p>
                    <Link href="https://wa.me/919311997440" target="_blank" className="block">
                      <button className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-900 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all border border-slate-200 shadow-sm">
                        WhatsApp Sync
                      </button>
                    </Link>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-slate-100 mt-auto shrink-0 bg-slate-50 space-y-4">
                 <Button variant="ghost" onClick={handleLogout} className="w-full h-11 rounded-md text-red-600 bg-white border border-red-100 hover:bg-red-500 hover:text-white justify-start font-black text-[10px] uppercase tracking-widest transition-all shadow-sm">
                    <LogOut className="mr-3 h-4 w-4" /> Sign Out Portal
                 </Button>
                 <div className="pb-2 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] leading-loose">Identity Protected by <br/> Blueteeth Clinical Encryption</p>
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
      <input type="text" placeholder="Search cases..." className="pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 w-80 h-11 transition-all shadow-sm" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
      <Search className="absolute left-4 h-5 w-5 text-slate-500" />
    </div>
  );
}

function HeaderActions({ isAdminRoute, user, displayName, displaySpec, displayPhoto, notifications, showNotifications, setShowNotifications, mounted }: any) {
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
          localStorage.setItem(`clinical_profile_${uid}`, JSON.stringify({ name: displayName, photoURL: compressed }));
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
        <button onClick={() => setShowNotifications(!showNotifications)} className={`p-2.5 rounded-lg border transition-all shadow-sm ${showNotifications ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-700 bg-slate-50 border-slate-200'}`}>
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>}
        </button>
        <AnimatePresence>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 mt-3 w-80 bg-white rounded-lg shadow-2xl border border-slate-100 overflow-hidden z-[70] origin-top-right">
                <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase tracking-widest">Global Alerts</span>
                   <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black">{notifications.length} New</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? notifications.map((notif: any) => (
                    <div key={notif.id} className="p-5 border-b border-slate-50 hover:bg-blue-50/20 transition-all cursor-pointer group">
                      <p className="text-xs font-black text-slate-800 group-hover:text-blue-600 transition-colors">{notif.title}</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-bold leading-relaxed">{notif.msg}</p>
                    </div>
                  )) : <div className="p-10 text-center text-xs font-bold text-slate-300 uppercase tracking-widest">No Alerts Recieved</div>}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <div className="h-8 w-px bg-slate-200" />
      {isAdminRoute ? (
        <div className="relative flex items-center gap-3 cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-slate-900 leading-none group-hover:text-blue-600 transition-colors uppercase tracking-tight">{displayName || 'Admin'}</p>
            <p className="text-[8px] text-slate-500 uppercase mt-1 font-black tracking-widest">Administrator</p>
          </div>
          <div className="h-10 w-10 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
            {displayPhoto ? <img src={displayPhoto} className="h-full w-full object-cover" /> : <UserCircle className="h-full w-full text-slate-400" />}
          </div>
          <input type="file" accept="image/*" onChange={handleAdminPhotoChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
        </div>
      ) : (
        <Link href="/doctor/settings">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-900 leading-none group-hover:text-blue-600 transition-colors uppercase tracking-tight">{displayName ? (displayName.startsWith('Dr.') ? displayName : `Dr. ${displayName}`) : 'Doctor'}</p>
              <p className="text-[8px] text-slate-500 uppercase mt-1 font-black tracking-widest">{displaySpec}</p>
            </div>
            <div className="h-10 w-10 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
              {displayPhoto ? <img src={displayPhoto} className="h-full w-full object-cover" /> : <UserCircle className="h-full w-full text-slate-400" />}
            </div>
          </div>
        </Link>
      )}
    </>
  );
}

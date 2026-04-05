'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  Menu, X, LayoutDashboard, FilePlus, ListTodo, Wallet, 
  Users, Settings, LogOut, Bell, Search, UserCircle, Lock, ShieldCheck
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
  color: string;
  lightBg: string;
}

const doctorLinks: SidebarItem[] = [
  { name: 'Dashboard', href: '/doctor', icon: LayoutDashboard, color: 'text-blue-600', lightBg: 'bg-blue-50' },
  { name: 'Submit New Case', href: '/doctor/submit-case', icon: FilePlus, color: 'text-emerald-600', lightBg: 'bg-emerald-50' },
  { name: 'Case History', href: '/doctor/cases', icon: ListTodo, color: 'text-amber-600', lightBg: 'bg-amber-50' },
  { name: 'My Earnings', href: '/doctor/earnings', icon: Wallet, color: 'text-indigo-600', lightBg: 'bg-indigo-50' },
  { name: 'Settings', href: '/doctor/settings', icon: Settings, color: 'text-slate-600', lightBg: 'bg-slate-50' },
];

const adminLinks: SidebarItem[] = [
  { name: 'Admin Overview', href: '/admin', icon: LayoutDashboard, color: 'text-blue-600', lightBg: 'bg-blue-50' },
  { name: 'Review Cases', href: '/admin/review', icon: ListTodo, color: 'text-emerald-600', lightBg: 'bg-emerald-50' },
  { name: 'Doctors List', href: '/admin/doctors', icon: Users, color: 'text-indigo-600', lightBg: 'bg-indigo-50' },
  { name: 'Earning Records', href: '/admin/earnings', icon: Wallet, color: 'text-amber-600', lightBg: 'bg-amber-50' },
  { name: 'Portal Settings', href: '/admin/settings', icon: Settings, color: 'text-slate-600', lightBg: 'bg-slate-50' },
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

  // Listen for profile updates
  React.useEffect(() => {
    const updateProfile = () => {
      if (!user) return;
      
      // Use Firebase userData if available, fallback to local storage only if offline
      if (userData?.name || userData?.photoURL) {
          if (userData.name) setDisplayName(userData.name);
          if (userData.photoURL) setDisplayPhoto(userData.photoURL);
      } else {
          const localProfile = localStorage.getItem(`clinical_profile_${user.uid}`);
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
    return () => window.removeEventListener('clinical-identity-update', updateProfile);
  }, [user, userData]);

  // Notifications Listener
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

        notifs.push({ 
          id: docSnap.id, 
          ...data,
          time: timeLabel,
          rawDate: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
        });
      });

      const sortedNotifs = notifs.sort((a, b) => (b.rawDate?.getTime() || 0) - (a.rawDate?.getTime() || 0));
      setNotifications(sortedNotifs);
    });

    return () => unsubscribe();
  }, [user, isAdminRoute]);

  const sendSecurityAlert = async (type: string) => {
    try {
      const emailjs = (await import('@emailjs/browser')).default;
      const templateParams = {
        to_email: 'nitinchauhan378@gmail.com',
        user_email: user?.email || 'Unknown',
        timestamp: new Date().toISOString(),
        alert_type: type,
        path: pathname,
        user_id: user?.uid || 'Unknown'
      };

      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        templateParams,
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
      );
    } catch (error) {
      console.warn("Security notification system offline.");
    }
  };

  React.useEffect(() => {
    if (mounted && !authLoading) {
      if (!user) {
        setLoading(false);
        router.replace('/auth/login');
        return;
      }

      // If user exists but userData is still fetching from Firestore, WAIT.
      if (!userData && !isAdminRoute) {
        // We can allow doctor routes mostly, but safer to wait or skip if it's taking too long
        // But for Admin, it's CRITICAL.
      }

      // SECURITY ENFORCEMENT for Admin Routes
      if (isAdminRoute) {
         // WAIT for userData to verify role
         if (!userData) return; 

         const masterEmails = ['admin@blueteeth.in', 'nitinchauhan378@gmail.com', 'niteen02@gmail.com', 'niteen02'];
         const userEmailRaw = user.email?.toLowerCase();
         const isRootEmail = userEmailRaw && masterEmails.includes(userEmailRaw);
         const hasAdminRole = userData?.role === 'admin' || isUserAdmin;

         if (!isRootEmail && !hasAdminRole) {
            toast.error("SECURITY LOCK: Administrative privileges required.");
            router.replace('/doctor');
            return;
         }
      }
      
      setLoading(false);
    }
  }, [mounted, authLoading, isAdminRoute, userData, user, pathname, router, isUserAdmin]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/auth/login');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isActive = (path: string) => pathname === path;

  // Derive initials for avatar
  const avatarName = displayName.startsWith('Dr. ') ? displayName.slice(4) : displayName;
  const initials = avatarName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'D';

  // OPTIMISTIC UI: Eliminate white flash by showing the shell if we have identity snapshot
  const isOptimisticReady = mounted && !!userData;
  const shouldShowLoader = (loading || !mounted) && !isOptimisticReady;

  if (shouldShowLoader) {
    return (
      <div className="min-h-[100svh] bg-slate-50 flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative overflow-visible">
      {/* Premium Background Layers */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[5%] w-[60rem] h-[60rem] bg-indigo-100/40 rounded-full blur-[140px] animate-pulse-soft" />
        <div className="absolute bottom-[-10%] right-[5%] w-[50rem] h-[50rem] bg-blue-100/40 rounded-full blur-[140px] animate-pulse-soft-delayed" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] contrast-150 brightness-100"></div>
      </div>

      {/* Premium Dark Sidebar for Desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0 lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 m-4">
        <div className="flex flex-col flex-1 min-h-0 bg-blue-900 border border-white/10 rounded-xl p-5 shadow-2xl">
          <div className="flex items-center flex-shrink-0 mb-10 px-2">
            <div className="h-10 w-10 bg-white rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-white/5 p-1.5">
              <img src="/logo.png" className="h-full w-full object-contain" alt="Blueteeth Logo" />
            </div>
            <span className="ml-4 text-xl font-black text-white tracking-tight">Blueteeth</span>
          </div>
          
          <nav className="flex-1 space-y-2 overflow-y-auto pr-2 no-scrollbar">
            {navigation.map((item) => (
              <Link key={item.name} href={item.href}>
                <motion.div 
                  whileHover={{ x: 5 }}
                  className={`group flex items-center px-6 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${
                    isActive(item.href) 
                      ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' 
                      : 'text-blue-100/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <item.icon className={`mr-4 h-5 w-5 flex-shrink-0 transition-colors ${
                    isActive(item.href) ? 'text-white' : 'text-blue-200/50 group-hover:text-blue-200'
                  }`} />
                  {item.name}
                </motion.div>
              </Link>
            ))}
          </nav>

          <div className="mt-auto mb-6 p-4 rounded-lg bg-white/5 border border-white/10 group overflow-hidden transition-all hover:bg-white/[0.08]">
             <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white rounded-md flex items-center justify-center shrink-0 shadow-lg shadow-white/5 overflow-hidden transition-all group-hover:scale-105">
                  {displayPhoto ? (
                    <img src={displayPhoto} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-blue-900 font-black text-xs italic">{initials}</span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-[11px] font-black text-white truncate leading-none">
                    {displayName ? (displayName.startsWith('Dr.') ? displayName : `Dr. ${displayName}`) : 'Doctor'}
                  </p>
                  <p className="text-[9px] font-bold text-blue-300/80 uppercase tracking-tight mt-1 truncate">
                    {isAdminRoute ? 'Admin' : 'Practice Doctor'}
                  </p>
                </div>
             </div>
          </div>
          
          <div className="pt-6 border-t border-white/5 flex justify-start">
            <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="w-fit h-10 px-5 justify-start text-red-100 font-black bg-red-500/10 border border-red-500/20 hover:bg-red-600 hover:text-white rounded-xl transition-all duration-500 group overflow-hidden relative"
            >
                <div className="relative flex items-center gap-3">
                  <LogOut className="h-4 w-4" />
                  <span className="tracking-widest uppercase text-[9px]">Sign Out</span>
                </div>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 lg:ml-80 min-w-0 bg-transparent pb-10 px-3.5 sm:px-8 w-full items-stretch overflow-visible">
        <header className="relative z-[100] py-4 sm:py-5">
          <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg px-3 sm:px-6 py-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)]">
            <div className="flex items-center lg:hidden">
              <button
                type="button"
                className="p-2.5 text-slate-700 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg shadow-sm transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
            <div className="hidden lg:flex relative group ml-2 items-center">
               <Suspense fallback={<div className="w-80 h-11 bg-slate-100 rounded-lg animate-pulse" />}>
                 <SearchInput />
               </Suspense>
            </div>
            
             <div className="flex items-center gap-x-5 ml-auto relative">
               <Suspense fallback={<div className="w-40 h-10 bg-slate-100 rounded-xl animate-pulse" />}>
                 <HeaderActions 
                   isAdminRoute={isAdminRoute}
                   user={user}
                   displayName={displayName}
                   displaySpec={displaySpec}
                   displayPhoto={displayPhoto}
                   notifications={notifications}
                   showNotifications={showNotifications}
                   setShowNotifications={setShowNotifications}
                   mounted={mounted}
                 />
               </Suspense>
            </div>
          </div>
        </header>

        <main className="lg:pt-2 flex flex-col overflow-visible">
          {children}
        </main>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-[150] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200, bounce: 0 }}
              className="fixed inset-y-0 left-0 z-[160] w-full max-w-[280px] bg-white p-0 shadow-2xl lg:hidden flex flex-col"
            >
              <div className="p-7 pt-8 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center px-1">
                  <div className="h-10 w-10 bg-white rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-blue-200/50 p-1.5">
                    <img src="/logo.png" className="h-full w-full object-contain" alt="Blueteeth Logo" />
                  </div>
                  <div className="ml-3">
                    <span className="block text-base font-black text-slate-900 tracking-tight leading-none">Blueteeth</span>
                    <span className="block text-[8px] font-bold text-blue-500 uppercase tracking-[0.2em] mt-1">Clinical Hub</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-100/50 text-slate-600 hover:text-red-500 transition-colors border border-slate-200/30"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 py-6 space-y-1.5 custom-scrollbar">
                {navigation.map((item) => (
                  <Link key={item.name} href={item.href} onClick={() => setSidebarOpen(false)}>
                    <div className={`flex items-center px-4 py-3 text-sm font-black rounded-lg transition-all duration-300 ${
                      isActive(item.href) 
                        ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 ring-1 ring-white/10 scale-[1.02]' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                    }`}>
                      <item.icon className={`mr-4 h-5 w-5 flex-shrink-0 transition-colors ${isActive(item.href) ? 'text-white' : 'text-slate-600 group-hover:text-blue-500'}`} />
                      <span className="tracking-tight uppercase text-[10px]">{item.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="p-6 border-t border-slate-50 mb-safe">
                 <Button 
                    variant="ghost" 
                    onClick={() => {
                        handleLogout();
                        setSidebarOpen(false);
                    }}
                    className="w-full h-12 rounded-xl text-red-600 bg-red-50/50 hover:bg-red-50 justify-start font-bold"
                 >
                    <LogOut className="mr-3 h-5 w-5" /> Sign Out
                 </Button>
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
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (searchValue) {
        params.set('q', searchValue);
      } else {
        params.delete('q');
      }
      const newQuery = params.toString();
      const newUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
      router.replace(newUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, pathname, router]);

  return (
    <>
      <input 
        ref={searchInputRef}
        type="text" 
        placeholder="Search cases..." 
        className="relative z-0 pl-11 pr-24 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 placeholder:text-slate-600 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all w-80 h-11 shadow-sm"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />
      <Search 
        className="absolute left-4 h-5 w-5 text-slate-500 transition-colors z-10" 
      />
    </>
  );
}

function HeaderActions({ 
  isAdminRoute, user, displayName, displaySpec, displayPhoto, 
  notifications, showNotifications, setShowNotifications, mounted 
}: any) {
  const handleAdminPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isAdminRoute) {
      if (file.size > 10 * 1024 * 1024) return toast.error('Max 10MB supported.');
      
      const toastId = toast.loading('Synchronizing Profile Picture...');
      const uid = user?.uid || 'admin_sys_local';
      
      const processFile = () => new Promise<string>((resolve, reject) => {
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
                resolve(canvas.toDataURL('image/jpeg', 0.7));
             };
             img.onerror = reject;
             img.src = reader.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });

      try {
          const compressed = await processFile();
          localStorage.setItem(`clinical_profile_${uid}`, JSON.stringify({ name: displayName, photoURL: compressed }));
          window.dispatchEvent(new Event('clinical-identity-update'));
          
          if (user?.uid) {
             const uploadResult = await uploadProfileImage(uid, compressed);
             if (uploadResult?.success) {
                await updateUserProfile(uid, { photoURL: uploadResult.url });
             }
          }
          toast.success('Identity Securely Updated.', { id: toastId });
          e.target.value = '';
      } catch (err: any) {
          toast.error('Sync failed.');
          e.target.value = '';
      }
    }
  };

  return (
    <>
      <div className="relative">
        <button 
         onClick={() => setShowNotifications(!showNotifications)}
         className={`relative p-2.5 rounded-lg transition-all shadow-sm ${
           showNotifications ? 'bg-slate-800 text-white' : 'text-slate-700 border border-slate-200 bg-slate-50 hover:bg-slate-100'
         }`}
        >
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <span className="absolute top-2.5 right-2.5 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
          )}
        </button>

        <AnimatePresence>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setShowNotifications(false)} />
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[70] origin-top-right"
              >
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                   <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Notifications</h3>
                   <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{notifications.length} New</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? notifications.map((notif: any) => (
                    <div key={notif.id} className="p-5 border-b border-slate-50 hover:bg-blue-50/30 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-black text-slate-800">{notif.title}</p>
                        <span className="text-[9px] font-bold text-slate-600">{notif.time}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{notif.msg}</p>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-slate-600 text-xs font-bold">No new alerts.</div>
                  )}
                </div>
                <Link href={isAdminRoute ? "/admin/notifications" : "/doctor/notifications"}>
                  <div onClick={() => setShowNotifications(false)} className="w-full block text-center p-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-blue-600 transition-colors border-t border-slate-50 bg-slate-50/30">
                    View All
                  </div>
                </Link>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
     
      <div className="h-8 w-px bg-slate-200 mx-2" />

      {isAdminRoute ? (
        <div className="relative group flex items-center gap-3 cursor-pointer">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-slate-900 leading-none">{displayName || 'Admin'}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Administrator</p>
          </div>
          <div className="h-10 w-10 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-sm p-0.5 flex items-center justify-center">
            {displayPhoto ? <img src={displayPhoto} className="h-full w-full object-cover rounded-sm" /> : <UserCircle className="h-full w-full text-slate-400" />}
          </div>
          <input type="file" accept="image/*" onChange={handleAdminPhotoChange} className="absolute inset-0 opacity-0 cursor-pointer z-50" />
        </div>
      ) : (
        <Link href="/doctor/settings">
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black text-slate-900 leading-none">{displayName ? (displayName.startsWith('Dr.') ? displayName : `Dr. ${displayName}`) : 'Doctor'}</p>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">{displaySpec}</p>
            </div>
            <div className="h-10 w-10 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-sm p-0.5 flex items-center justify-center">
              {displayPhoto ? <img src={displayPhoto} className="h-full w-full object-cover rounded-sm" /> : <UserCircle className="h-full w-full text-slate-400" />}
            </div>
          </div>
        </Link>
      )}
    </>
  );
}

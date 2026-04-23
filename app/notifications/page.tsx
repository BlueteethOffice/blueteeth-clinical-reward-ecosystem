'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/Card';
import { Bell, CheckCircle2, Trash2, Clock, ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
  const { user, userData, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user || !db) return;

    // Determine identity node
    const isActuallyAdmin = userData?.role === 'admin' || isAdmin;
    const targetUid = isActuallyAdmin ? 'admin' : user.uid;

    const q = query(collection(db, 'notifications'), where('userId', '==', targetUid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        let timeLabel = 'Recently';
        if (data.createdAt) {
          const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          timeLabel = date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
        notifs.push({ 
          id: docSnap.id, 
          ...data, 
          time: timeLabel, 
          rawDate: data.createdAt?.toDate ? data.createdAt.toDate() : new Date() 
        });
      });

      const sorted = notifs.sort((a, b) => (b.rawDate?.getTime() || 0) - (a.rawDate?.getTime() || 0));
      setNotifications(sorted);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userData, isAdmin]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    const tid = toast.loading("Clearing all notifications...");
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
      toast.success("All notifications marked as read", { id: tid });
    } catch (err) { toast.error("Sync Failure", { id: tid }); }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success("Notification removed");
    } catch (err) { toast.error("Delete failed"); }
  };

  return (
    <DashboardLayout isAdminRoute={userData?.role === 'admin' || isAdmin}>
      <div className="max-w-3xl mx-auto space-y-4 pb-20 px-2">
        {/* Header Section - Clean & Balanced */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-2">
          <div className="space-y-1">
             <button 
                onClick={() => router.back()}
                className="group flex items-center gap-2 px-3 py-1.5 bg-blue-600 border border-blue-500 rounded-[4px] text-[8px] font-black text-white uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-[0_4px_10px_rgba(37,99,235,0.2)] active:scale-95 -mt-2 mb-1"
             >
                <ArrowLeft size={10} className="group-hover:-translate-x-1 transition-transform" /> Clinical Dashboard
             </button>
             <h1 className="text-2xl font-bold text-slate-900 tracking-tighter uppercase">Notification Hub</h1>
          </div>
          
          {notifications.some(n => !n.read) && (
            <button 
               onClick={markAllRead}
               className="px-4 py-2 bg-slate-900 text-white rounded-[4px] text-[8px] font-black uppercase tracking-[0.2em] hover:bg-black shadow-lg transition-all active:scale-95 flex items-center gap-2 border border-white/10"
            >
               <CheckCircle2 size={11} className="text-emerald-400" /> Purge Logs
            </button>
          )}
        </div>

        {/* Notifications List Container */}
        <div className="space-y-3">
           {/* Activity Stream Compact Header */}
           <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between rounded-[4px] border border-white/10 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 relative z-10">
                 <div className="h-7 w-7 bg-blue-600 rounded-[3px] flex items-center justify-center text-white shadow-lg border border-blue-400/20">
                    <Bell size={14} />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] leading-none">Activity Stream</p>
                    <div className="text-[7px] font-bold text-blue-300 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                       <div className="w-1 h-1 rounded-full bg-emerald-500" />
                       {notifications.length} Logs Sequenced
                    </div>
                 </div>
              </div>
              <div className="hidden sm:block">
                 <span className="px-2 py-0.5 bg-white/5 text-white/40 text-[6px] font-black uppercase rounded-[2px] tracking-[0.2em] border border-white/5">Secured Node</span>
              </div>
           </div>

           {/* List of Notifications */}
           <div className="space-y-3">
              {loading ? (
                [...Array(5)].map((_, i) => (
                   <div key={i} className="h-24 bg-white border border-slate-100 rounded-[4px] animate-pulse" />
                ))
              ) : notifications.length > 0 ? (
                <AnimatePresence mode="popLayout">
                   {notifications.map((notif) => (
                      <motion.div 
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`group relative bg-white transition-all hover:shadow-2xl hover:-translate-y-0.5 overflow-hidden rounded-[4px] border-2 ${
                           notif.type === 'success' ? 'border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]' :
                           notif.type === 'error' ? 'border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]' :
                           'border-blue-600/20 shadow-[0_0_15px_rgba(37,99,235,0.05)]'
                        }`}
                      >
                         {/* Top Status Patti */}
                         <div className={`h-1 w-full ${
                            notif.type === 'success' ? 'bg-emerald-500' :
                            notif.type === 'error' ? 'bg-rose-500' :
                            'bg-blue-600'
                         }`} />

                         {/* Status Boundry Node - Left */}
                         <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5 ${
                            notif.type === 'success' ? 'bg-emerald-500' :
                            notif.type === 'error' ? 'bg-rose-500' :
                            'bg-blue-600'
                         }`} />

                         {/* Status Boundry Node - Right */}
                         <div className={`absolute right-0 top-0 bottom-0 w-1 transition-all group-hover:w-1.5 ${
                            notif.type === 'success' ? 'bg-emerald-500' :
                            notif.type === 'error' ? 'bg-rose-500' :
                            'bg-blue-600'
                         }`} />

                         <div className={`p-5 sm:p-6 flex items-start gap-5 transition-colors ${!notif.read ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'}`}>
                            {/* Icon Node */}
                            <div className={`h-11 w-11 rounded-[4px] flex items-center justify-center shrink-0 border transition-all group-hover:scale-110 ${
                               notif.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm' :
                               notif.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm' :
                               'bg-blue-50 border-blue-200 text-blue-600 shadow-sm'
                            }`}>
                               {notif.type === 'success' ? <ShieldCheck size={18} /> : notif.type === 'error' ? <Mail size={18} /> : <Bell size={18} />}
                            </div>

                            {/* Content Node */}
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between gap-4 mb-1.5">
                                  <h3 className={`text-[13px] font-black uppercase tracking-tight transition-colors ${
                                     !notif.read ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'
                                  }`}>
                                     {notif.title}
                                  </h3>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-[2px] border border-slate-100">
                                     <Clock size={8} /> {notif.time}
                                  </span>
                               </div>
                               <p className={`text-[12px] leading-relaxed font-bold tracking-tight mb-4 ${
                                  !notif.read ? 'text-slate-700' : 'text-slate-500'
                               }`}>
                                  {notif.msg}
                               </p>
                               
                               <div className="flex items-center gap-6 opacity-0 group-hover:opacity-100 transition-all">
                                  {!notif.read && (
                                     <button 
                                        onClick={() => markAsRead(notif.id)}
                                        className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-1.5 hover:text-blue-800"
                                     >
                                        <CheckCircle2 size={10} /> Mark Resolved
                                     </button>
                                  )}
                                  <button 
                                     onClick={() => deleteNotification(notif.id)}
                                     className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5 hover:text-rose-600"
                                  >
                                     <Trash2 size={10} /> Delete Node
                                  </button>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                   ))}
                </AnimatePresence>
              ) : (
                <div className="p-32 text-center bg-white border border-dashed border-slate-200 rounded-[4px] space-y-6">
                   <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 text-slate-200">
                      <Bell size={32} />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Identity Stream Clear</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No active clinical alerts identified at this node</p>
                   </div>
                </div>
              )}
           </div>
        </div>

        {/* Audit Disclaimer Footer */}
        <div className="p-4 bg-slate-900 rounded-[4px] flex items-center gap-4 border border-white/10 shadow-xl">
           <div className="h-8 w-8 bg-blue-600/20 text-blue-400 rounded-[2px] flex items-center justify-center shrink-0 border border-blue-500/20">
              <ShieldCheck size={14} />
           </div>
           <div>
              <p className="text-[8px] font-black text-white uppercase tracking-[0.3em] mb-0.5">Secure Encryption Node</p>
              <p className="text-[9px] font-bold text-blue-100/60 uppercase tracking-tight leading-none">
                 Audit logs are end-to-end encrypted and purged automatically after clinical lifecycle.
              </p>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, onSnapshot, orderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Bell, CheckCircle2, AlertCircle, Info, Clock, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';

export default function NotificationsPage() {
  const { user, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    
    // Subscribe to real-time notification collection
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: any[] = [];
      snapshot.forEach(docSnap => {
        notifs.push({ id: docSnap.id, ...docSnap.data() });
      });
      
      // Client-side sorting: newest notifications first
      const sortedNotifs = notifs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setNotifications(sortedNotifs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (e) { console.error(e); }
  };

  const clearAll = async () => {
    try {
      const { getDocs } = await import('firebase/firestore');
      const q = query(collection(db, 'notifications'), where('userId', '==', user?.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (e) { console.error(e); }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-rose-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-amber-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout isAdminRoute={isAdmin}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notification Center</h1>
            <p className="text-slate-500 font-medium">Real-time alerts and updates for your clinical profile.</p>
          </div>
          {notifications.length > 0 && (
            <Button onClick={clearAll} variant="outline" className="text-red-500 hover:bg-red-50 border-red-100">
              <Trash2 className="h-4 w-4 mr-2" /> Clear All Alerts
            </Button>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
          {loading ? (
            <div className="p-8 space-y-4">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-24 bg-slate-50 rounded-2xl animate-pulse"></div>
               ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-slate-400">
              <div className="bg-slate-50 p-6 rounded-full mb-4">
                 <Bell className="h-12 w-12 text-slate-300" />
              </div>
              <p className="font-bold text-lg text-slate-800">No New Notifications</p>
              <p className="text-sm">You are all caught up on your alerts.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
               <AnimatePresence>
                 {notifications.map((notif) => (
                   <motion.div
                     key={notif.id}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     onClick={() => !notif.read && markAsRead(notif.id)}
                     className={`p-6 flex gap-4 transition-colors cursor-pointer group ${notif.read ? 'bg-white opacity-70' : 'bg-blue-50/30'}`}
                   >
                     <div className="mt-1 flex-shrink-0">
                       <div className={`p-2 rounded-xl bg-white shadow-sm border ${notif.read ? 'border-slate-100' : 'border-blue-100'}`}>
                         {getIcon(notif.type)}
                       </div>
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center justify-between mb-1">
                          <h3 className={`text-base font-bold truncate ${notif.read ? 'text-slate-700' : 'text-blue-900'}`}>{notif.title}</h3>
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                            <Clock className="h-3 w-3" />
                            {getTime(notif.createdAt)}
                          </div>
                       </div>
                       <p className={`text-sm leading-relaxed ${notif.read ? 'text-slate-500' : 'text-blue-800/80 font-medium'}`}>{notif.msg}</p>
                     </div>
                     {!notif.read && (
                       <div className="flex items-center xl:opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-100">
                           <CheckCircle className="h-4 w-4 mr-2" /> Mark Read
                         </Button>
                       </div>
                     )}
                   </motion.div>
                 ))}
               </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

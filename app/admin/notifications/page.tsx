'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Bell, CheckCircle2, AlertTriangle, UserPlus, Wallet, 
  ShieldCheck, Trash2, Filter, Search, ArrowRight,
  Info, Activity, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const mockSystemNotifs = [
  { id: '1', title: 'New Practitioner Registered', msg: 'Dr. Anita Roy has successfully joined the network.', type: 'registration', date: 'Just now', priority: 'high' },
  { id: '2', title: 'Withdrawal Threshold Alert', msg: 'Dr. Vivek Garg requested ₹5,000 disbursement.', type: 'finance', date: '12m ago', priority: 'medium' },
  { id: '3', title: 'Integrity Check Required', msg: 'Multiple patient entries detected from clinical node 402.', type: 'security', date: '1h ago', priority: 'critical' },
  { id: '4', title: 'System Engine Sync', msg: 'Cloud Firestore synchronization completed for the last 24h ledger.', type: 'system', date: '5h ago', priority: 'low' },
];

export default function AdminNotifications() {
  const [notifs, setNotifs] = useState(mockSystemNotifs);
  const [filter, setFilter] = useState('All');

  const handleDelete = (id: string) => {
    setNotifs(notifs.filter(n => n.id !== id));
    toast.success('Alert archive updated.');
  };

  const filtered = notifs.filter(n => filter === 'All' || n.priority === filter.toLowerCase());

  return (
    <DashboardLayout isAdminRoute={true}>
      <div className="space-y-10 pb-12">
        {/* Elite Command Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 shadow-xl shadow-slate-900/10">
               <Bell className="h-3 w-3" /> Global Alert Synchronization
             </div>
             <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Administrative Intelligence Hub</h1>
             <p className="text-slate-500 font-medium text-base">Monitoring clinical operations and systemic security alerts in real-time.</p>
          </div>
          
          <div className="flex bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-1 min-w-[350px] overflow-hidden">
             {['All', 'Critical', 'Medium', 'Low'].map(f => (
               <button 
                 key={f}
                 onClick={() => setFilter(f)}
                 className={`flex-1 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                   filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
                 }`}
               >
                 {f}
               </button>
             ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Notification Feed */}
          <div className="lg:col-span-8 space-y-6">
             <div className="flex items-center justify-between px-2 mb-4">
               <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                 <Activity className="h-4 w-4 text-blue-600" /> Administrative Feed
               </h2>
               <Button variant="ghost" className="text-[10px] font-black text-red-500 uppercase tracking-widest">Clear Archive</Button>
             </div>

             <div className="space-y-4">
                <AnimatePresence>
                  {filtered.map((n, idx) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className={`group bg-white border border-slate-100 rounded-[2rem] overflow-hidden transition-all hover:translate-x-1 ${
                        n.priority === 'critical' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-600'
                      } shadow-xl shadow-slate-200/30`}>
                        <CardContent className="p-8 flex items-center gap-8">
                           <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border border-slate-50 shadow-inner group-hover:rotate-12 transition-transform ${
                             n.priority === 'critical' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                           }`}>
                              {n.type === 'registration' ? <UserPlus className="h-7 w-7" /> : 
                               n.type === 'finance' ? <Wallet className="h-7 w-7" /> : 
                               n.type === 'security' ? <ShieldCheck className="h-7 w-7 text-red-500" /> : <Settings className="h-7 w-7" />}
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors">{n.title}</h4>
                                <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${
                                  n.priority === 'critical' ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-500'
                                } tracking-[0.2em]`}>{n.priority.toUpperCase()} AUDIT</span>
                              </div>
                              <p className="text-slate-400 font-bold text-sm leading-relaxed mb-4">{n.msg}</p>
                              <div className="flex items-center gap-6">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> IDSync: {n.date}</span>
                                <span className="h-4 w-px bg-slate-100" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> System: Admin Console Root</span>
                              </div>
                           </div>
                           <div className="flex flex-col gap-3">
                              <Button variant="ghost" onClick={() => handleDelete(n.id)} className="h-12 w-12 rounded-xl group-hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all border border-transparent hover:border-red-100">
                                 <Trash2 className="h-5 w-5" />
                              </Button>
                              <Button className="h-12 w-12 rounded-xl bg-slate-50 text-slate-900 border border-slate-100 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                 <ArrowRight className="h-5 w-5" />
                              </Button>
                           </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
             </div>
          </div>

          {/* System Integrity Map */}
          <div className="lg:col-span-4 space-y-10">
             <div className="p-8 rounded-[2rem] bg-indigo-900 text-white relative overflow-hidden group shadow-2xl shadow-indigo-900/40 border border-white/5">
                <AlertTriangle className="absolute right-[-40px] top-[-40px] h-64 w-64 text-white/5 group-hover:scale-105 transition-transform duration-1000 rotate-12" />
                <div className="relative z-10 space-y-8">
                   <div className="h-14 w-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20">
                     <ShieldCheck className="h-7 w-7 text-white" />
                   </div>
                   <div>
                      <h4 className="text-2xl font-black tracking-tight leading-none uppercase">Global Audit Snapshot</h4>
                      <p className="text-indigo-300 text-[11px] font-bold mt-4 leading-relaxed uppercase tracking-widest">No unauthorized clinical intrusion identified in the last 72 hours protocol cycle.</p>
                   </div>
                   <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
                      <div>
                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active Alerts</p>
                         <p className="text-2xl font-black mt-1">04</p>
                      </div>
                      <div>
                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Global Risk</p>
                         <p className="text-2xl font-black mt-1 text-emerald-400">LOW</p>
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden group">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Security Node Update</h3>
                <div className="space-y-8">
                   <div className="flex items-center gap-5">
                      <div className="h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
                      <div>
                         <p className="text-xs font-black text-slate-900 uppercase">Cloud Database Sync</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Connectivity: Stable</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-5">
                      <div className="h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                      <div>
                         <p className="text-xs font-black text-slate-900 uppercase">Reward Distro Engine</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">B-Points Engine: Operational</p>
                      </div>
                   </div>
                </div>
                <div className="mt-10 pt-10 border-t border-slate-50 flex flex-col gap-4">
                   <Button variant="outline" className="w-full h-12 rounded-xl text-[9px] font-black uppercase tracking-widest border-slate-200">Re-Initialize Nodes</Button>
                   <Button className="w-full h-12 rounded-xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest shadow-xl shadow-slate-900/10">Full System Diagnostics</Button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

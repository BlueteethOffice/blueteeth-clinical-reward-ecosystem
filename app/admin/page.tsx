'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  Users, ClipboardCheck, Wallet, Activity, ArrowUpRight, 
  Clock, AlertTriangle, ArrowRight, UserPlus, FileSearch, Bell, ShieldCheck,
  UserCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { fetchAdminStats, fetchWithdrawals } from '@/lib/firestore';

export default function AdminDashboard() {
  const [stats, setStats] = React.useState({ totalDoctors: 0, totalClinicians: 0, pendingReviews: 0, totalRewarded: 0, totalPoints: 0, approvedCases: 0 });
  const [loading, setLoading] = React.useState(true);
  const [isMounted, setIsMounted] = React.useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = React.useState<any[]>([]);

  React.useEffect(() => {
    setIsMounted(true);
    const loadStats = async () => {
      try {
        const data = await fetchAdminStats();
        if (data) setStats(data);
      } catch (e) { 
        console.error("Stats latency identified."); 
      } finally { 
        setLoading(false); 
      }
    };

    const loadWithdrawals = async () => {
      try {
        const data = await fetchWithdrawals();
        if (data && Array.isArray(data)) setPendingWithdrawals(data.slice(0, 3));
      } catch (e) {}
    };

    // Fire both in parallel for faster initial load
    Promise.all([loadStats(), loadWithdrawals()]);

    const interval = setInterval(() => {
      loadStats();
      loadWithdrawals();
    }, 60000);
    return () => clearInterval(interval);
  }, []);


  const adminStats = [
    { name: 'Total Associates', value: loading ? '...' : (stats?.totalDoctors?.toString() || '0'), icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: 'Active Doctors', gradient: 'from-indigo-200 via-indigo-100 to-indigo-200' },
    { name: 'Total Clinicians', value: loading ? '...' : (stats?.totalClinicians?.toString() || '0'), icon: UserCircle, color: 'text-blue-600', bg: 'bg-blue-50', trend: 'Active Specialists', gradient: 'from-blue-200 via-blue-100 to-blue-200' },
    { name: 'Pending Cases', value: loading ? '...' : (stats?.pendingReviews?.toString() || '0'), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', trend: (stats?.pendingReviews || 0) > 0 ? 'Needs Action' : 'All Clear', gradient: 'from-amber-200 via-amber-100 to-amber-200' },
    { name: 'Total Paid out', value: loading ? '...' : `₹${(stats?.totalRewarded || 0).toLocaleString()}`, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: `${stats?.totalPoints || 0} pts given`, gradient: 'from-emerald-200 via-emerald-100 to-emerald-200' },
    { name: 'Website Status', value: loading ? '...' : 'Running Well', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Everything OK', gradient: 'from-emerald-200 via-emerald-100 to-emerald-200' },
  ];

  return (
    <DashboardLayout isAdminRoute={true}>
      <div className="space-y-12 pb-2 relative" suppressHydrationWarning>
        {/* Elite Ambient Glow */}
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10 pointer-events-none" />
               {/* Elite Admin Header - Compact & Professional Refined */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pt-0 px-2 sm:px-0">
          <div className="space-y-4 max-w-xl">
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2.5 px-4 py-1.5 sm:px-5 sm:py-2 rounded-[4px] bg-slate-900 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 shadow-xl shadow-blue-900/10 ring-1 ring-white/10"
              >
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                Admin Dashboard
              </motion.div>
             
             <div className="space-y-4">
               <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-tight">
                 Admin <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Workspace.</span>
               </h1>
               <div className="h-1.5 w-16 bg-gradient-to-r from-blue-600 to-indigo-500 rounded-[4px]" />
               <p className="text-slate-500 font-medium text-xs sm:text-sm leading-relaxed max-w-lg">
                  Manage doctors, review pending cases, check earnings, and keep an eye on everything from one simple dashboard.
               </p>
             </div>
          </div>
          
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4">
             <motion.div 
               whileHover={{ scale: 1.02 }}
               className="h-16 sm:h-20 w-full sm:w-28 bg-white rounded-[4px] shadow-lg shadow-slate-200/40 border border-slate-100 flex flex-col items-center justify-center gap-0.5 sm:gap-1 relative overflow-hidden group"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Server</span>
                <span className="text-lg sm:text-xl font-black text-blue-900 tracking-tight">Online</span>
                <div className="flex items-center gap-1 mt-0.5">
                   <div className="h-1 w-1 rounded-full bg-blue-500" />
                   <span className="text-[7px] sm:text-[8px] font-bold text-blue-600 uppercase">Awesome</span>
                </div>
             </motion.div>

             <motion.div 
               whileHover={{ scale: 1.02 }}
               className="h-16 sm:h-20 px-4 sm:px-6 bg-slate-900 rounded-[4px] shadow-xl shadow-slate-900/20 flex items-center gap-3 sm:gap-4 text-white border border-white/5 relative overflow-hidden group"
             >
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
                <div className="h-8 w-8 sm:h-10 sm:w-10 bg-white/10 rounded-[4px] flex items-center justify-center backdrop-blur-md border border-white/10 group-hover:bg-blue-600 transition-colors duration-500">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 group-hover:text-white" />
                </div>
                <div>
                   <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-0.5">Website Speed</p>
                   <p className="text-sm sm:text-lg font-black tracking-tight">Super Fast</p>
                </div>
             </motion.div>
          </div>
        </div>

        {/* Global Stats Grid - Refined Glass Icons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-5">
          {adminStats.map((item, idx) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ scale: 1.01, translateY: -4 }}
              className={`p-[1px] rounded-[4px] bg-gradient-to-br ${item.gradient} hover:shadow-lg transition-all duration-500 shadow-xl`}
            >
              <Card className="h-full bg-white p-4 rounded-[4px] border-none relative overflow-hidden group transition-all duration-300">
                <div className="relative z-10 flex flex-col h-full justify-between gap-5">
                  <div className={`h-11 w-11 rounded-[4px] flex items-center justify-center ${item.bg} ring-1 ring-inset ${item.bg.replace('bg-', 'ring-')}/40 shadow-sm transition-all duration-500 group-hover:scale-110`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{item.name}</p>
                     <div className="flex items-end gap-1.5">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{item.value}</h3>
                     </div>
                     <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] mt-4 shadow-sm border ${
                       item.trend.includes('Pending') || item.trend.includes('Needs') ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                     }`}>
                        {item.trend.includes('+') ? <ArrowUpRight className="h-3 w-3" /> : item.trend.includes('Needs') ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        <span className="text-[9px] font-black uppercase tracking-widest">{item.trend}</span>
                     </div>
                  </div>
                </div>
                <div className={`absolute top-0 right-0 w-24 h-24 ${item.bg} rounded-full blur-[20px] -mr-12 -mt-12 opacity-20 group-hover:opacity-40 transition-opacity`} />
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Priority Operation Grid - Enhanced Dashboard Logic */}
        <div className="space-y-12 pt-8">
          {/* Quick Access Control - Simplified Elite */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/admin/review" className="group">
                <div className="bg-blue-600 rounded-[4px] p-5 text-white h-40 flex flex-col justify-between relative overflow-hidden shadow-xl shadow-blue-500/20 transition-all hover:shadow-blue-500/40 hover:-translate-y-1 active:scale-[0.99] border border-blue-500 group">
                  <ShieldCheck className="absolute right-[-20px] bottom-[-20px] h-32 w-32 text-white/10 transition-transform duration-700 group-hover:scale-105" />
                  <div className="relative z-10">
                      <div className="h-10 w-10 bg-white/10 rounded-[4px] flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner">
                        <ClipboardCheck className="h-5 w-5" />
                      </div>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-lg font-black tracking-tight mb-1 text-white group-hover:text-amber-300 transition-colors">Check Pending Cases</h4>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-100 flex items-center gap-2">
                        {stats?.pendingReviews || 0} Waiting <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
              </div>
            </Link>
              <Link href="/admin/review?tab=Assigned" className="group">
                <div className="bg-indigo-600 rounded-[4px] p-5 text-white h-40 flex flex-col justify-between relative overflow-hidden shadow-xl shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 hover:-translate-y-1 active:scale-[0.99] border border-indigo-500">
                  <Activity className="absolute right-[-20px] bottom-[-20px] h-32 w-32 text-white/5 transition-transform duration-700 group-hover:scale-105" />
                  <div className="relative z-10">
                      <div className="h-10 w-10 bg-white/10 rounded-[4px] flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner">
                        <Clock className="h-5 w-5" />
                      </div>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-lg font-black tracking-tight mb-1 text-white group-hover:text-indigo-200 transition-colors">Assign Cases</h4>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-100 flex items-center gap-2">
                        Dispatch Tasks <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
              </div>
            </Link>
              <Link href="/admin/doctors" className="group">
                <div className="bg-slate-900 rounded-[4px] p-5 text-white h-40 flex flex-col justify-between relative overflow-hidden shadow-xl shadow-slate-900/20 transition-all hover:shadow-slate-900/40 hover:-translate-y-1 active:scale-[0.99] border border-white/5">
                  <UserPlus className="absolute right-[-20px] bottom-[-20px] h-32 w-32 text-white/5 transition-transform duration-700 group-hover:scale-105" />
                  <div className="relative z-10">
                      <div className="h-10 w-10 bg-white/5 rounded-[4px] flex items-center justify-center backdrop-blur-xl border border-white/10 shadow-inner">
                        <Users className="h-5 w-5 text-blue-400" />
                      </div>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-lg font-black tracking-tight mb-1 text-white group-hover:text-blue-400 transition-colors">Manage Users</h4>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                        {(stats?.totalDoctors || 0) + (stats?.totalClinicians || 0)} Profiles <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
              </div>
            </Link>
              <Link href="/admin/approvals" className="group">
                <div className="bg-emerald-600 rounded-[4px] p-5 text-white h-40 flex flex-col justify-between relative overflow-hidden shadow-xl shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 hover:-translate-y-1 active:scale-[0.99] border border-emerald-500 group">
                  <ClipboardCheck className="absolute right-[-20px] bottom-[-20px] h-32 w-32 text-white/10 transition-transform duration-700 group-hover:scale-105" />
                  <div className="relative z-10">
                      <div className="h-10 w-10 bg-white/10 rounded-[4px] flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner">
                        <ClipboardCheck className="h-5 w-5" />
                      </div>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-lg font-black tracking-tight mb-1 text-white group-hover:text-emerald-200 transition-colors">Approved Cases</h4>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-100 flex items-center gap-2">
                        {loading ? '...' : (stats?.approvedCases || 0)} Verified <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
              </div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12">
            <div className="lg:col-span-8 space-y-12">
              {/* Global Notifications Stream - Refined Feed */}
              <div className="space-y-8 px-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between items-start gap-3 sm:gap-4 px-2">
                    <h2 className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] flex items-center gap-4 whitespace-nowrap">
                        <div className="h-1 w-8 bg-blue-600 rounded-[4px]" /> Recent Activity
                    </h2>
                    <Button variant="ghost" className="h-auto p-0 sm:px-4 text-[11px] sm:text-[11px] font-black uppercase tracking-widest text-blue-600 hover:bg-transparent whitespace-nowrap">Mark all read</Button>
                  </div>
                  <div className="space-y-5">
                    {[
                      { title: 'Security Alert', msg: "Mobile number '91XXXXX420' was submitted twice today.", type: 'security', icon: AlertTriangle, color: 'bg-orange-600', iconColor: 'text-orange-600', bg: 'bg-orange-50', action: 'Review' },
                      { title: 'New Doctor Signed Up', msg: 'Dr. Anita Roy has created a new account.', type: 'auth', icon: Users, color: 'bg-indigo-600', iconColor: 'text-indigo-600', bg: 'bg-indigo-50', action: 'View Doctor' }
                    ].map((notif, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ x: 5 }}
                        className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center p-4 sm:p-5 bg-white rounded-[4px] border border-slate-100 shadow-xl shadow-slate-200/10 gap-4 sm:gap-6 group cursor-pointer transition-all"
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${notif.color}`} />
                        <div className={`h-12 w-12 sm:h-12 sm:w-12 rounded-[4px] flex items-center justify-center shrink-0 ${notif.bg} border border-slate-100 group-hover:scale-105 transition-transform`}>
                          <notif.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${notif.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                              <p className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{notif.title}</p>
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-500">Live</span>
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1 leading-relaxed">{notif.msg}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="w-full sm:w-auto h-10 sm:h-11 px-6 rounded-[4px] font-black text-[10px] uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-50/50 sm:border-transparent">{notif.action}</Button>
                      </motion.div>
                    ))}
                  </div>
              </div>
            </div>

            {/* Operation Status Sidebar - Premium Financials */}
            <div className="lg:col-span-4 space-y-12">
              <div>
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em] px-2 flex items-center gap-4 mb-8">
                  <div className="h-1 w-8 bg-emerald-600 rounded-full" /> Pending Payouts
                </h2>
                <div className="bg-white rounded-[4px] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-3xl -mr-12 -mt-12 opacity-50" />
                    <div className="divide-y divide-slate-50">
                      {pendingWithdrawals?.length > 0 ? pendingWithdrawals.map((item) => (
                        <div key={item.id} className="p-5 sm:p-8 hover:bg-slate-50 transition-all flex items-center justify-between group cursor-pointer relative z-10">
                          <div className="space-y-1">
                            <p className="text-lg font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors uppercase">{item.doctorName || item.doctor || 'Practitioner'}</p>
                            <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">{item.date || 'Today'} <span className="text-slate-200 mx-2">|</span> ₹{item.amount?.toLocaleString()}</p>
                          </div>
                          <div className={`h-8 w-8 rounded-[4px] border-2 border-white shadow-md overflow-hidden bg-slate-100 flex items-center justify-center transition-all group-hover:scale-110`}>
                              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                          </div>
                        </div>
                      )) : (
                        <div className="p-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No pending payouts</div>
                      )}
                    </div>
                    <div className="p-5 sm:p-8 bg-slate-900 border-t border-white/5">
                      <Link href="/admin/earnings">
                        <Button variant="ghost" className="w-full h-14 rounded-[4px] text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-white hover:bg-white/5 group gap-4 transition-all">
                          View All Earnings <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Premium System Health Banner - Bottom Position */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-700 via-blue-900 to-indigo-950 rounded-[4px] p-6 py-10 sm:px-10 text-white relative overflow-hidden group shadow-2xl shadow-blue-900/30 border border-white/5 mt-8"
        >
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] rotate-12 group-hover:rotate-45 group-hover:scale-125 transition-all duration-1000">
              <Activity className="h-64 w-64" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                  <div className="h-14 w-14 bg-white/10 rounded-[4px] flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner shrink-0">
                    <Activity className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300 mb-1 opacity-60">System Health Protocol</h4>
                    <p className="text-xs sm:text-sm text-blue-100/80 font-bold leading-relaxed max-w-md">
                      Everything is working perfectly and running smoothly for all doctors.
                    </p>
                  </div>
              </div>
              
              <div className="flex items-end gap-3 bg-white/5 px-8 py-3 rounded-[4px] border border-white/10">
                  <span className="text-4xl sm:text-5xl font-black tracking-tighter leading-none">100<span className="text-blue-400 text-xl sm:text-2xl">%</span></span>
                  <span className="text-[10px] font-black text-blue-400 mb-1 uppercase tracking-widest">Score</span>
              </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        </motion.div>
      </div>
    </DashboardLayout>

  );
}

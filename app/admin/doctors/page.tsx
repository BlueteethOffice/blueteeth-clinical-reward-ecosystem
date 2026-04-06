'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Users, Search, UserCheck, ShieldAlert, Mail, Phone,
  FilePlus, MapPin, Coins, ArrowRight, Filter, Download, MoreVertical,
  Activity, Award, UserPlus, X, CreditCard, ChevronRight,
  TrendingUp, Clock, History, ShieldCheck, Share2, Trash2, PlusCircle,
  IndianRupee, Smartphone, Gift, BadgeCheck, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { fetchDoctors } from '@/lib/firestore';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, orderBy, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

import { Suspense } from 'react';

function DoctorListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryQ = searchParams.get('q') || '';
  
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  
  // Reset pagination to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [queryQ]);


  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showNewDoctorModal, setShowNewDoctorModal] = useState(false);
  const [experienceFilter, setExperienceFilter] = useState<'all' | 'junior' | 'senior'>('all');
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Prevent background scrolling when Drawer or Modal is open
  useEffect(() => {
    if (showDrawer || showNewDoctorModal || showAdjustModal || showConfirmModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [showDrawer, showNewDoctorModal, showAdjustModal, showConfirmModal]);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onAction: () => void;
    type: 'danger' | 'info' | 'success';
    confirmLabel?: string;
    hideCancel?: boolean;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [bonusReason, setBonusReason] = useState('Administrative Performance Bonus');
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(true);
  const [newDoctorData, setNewDoctorData] = useState({ name: '', email: '', phone: '', clinic: '', experience: '0' });
  const [doctorCases, setDoctorCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(50);
  const [auditPage, setAuditPage] = useState(1);
  const [selectedAuditCase, setSelectedAuditCase] = useState<any>(null);
  const AUDIT_ITEMS_PER_PAGE = 8;

  useEffect(() => {
    setHasMounted(true);
    const fetchRate = async () => {
      const { fetchGlobalSettings } = await import('@/lib/firestore');
      const settings = await fetchGlobalSettings();
      if (settings?.exchangeRate) setExchangeRate(settings.exchangeRate);
    };
    fetchRate();
  }, []);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    if (!db || !hasMounted) return;

    setLoading(true);

    const fetchAllIdentities = async () => {
      try {
        const qUsers = query(collection(db, 'users'), where('role', '==', 'doctor'));
        const usersSnap = await getDocs(qUsers);
        const usersData = usersSnap.docs.map(d => {
          const data = d.data();
          // IDENTITY PRIORITIZATION: name > legalName > displayName > email handle
          const loginName = data.name || data.legalName || data.displayName || data.email?.split('@')[0] || 'Practitioner';
          return { id: d.id, ...data, name: loginName };
        });

        const doctorsSnap = await getDocs(collection(db, 'doctors'));
        const legacyData = doctorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const identityMap = new Map();
        [...legacyData, ...usersData].forEach(doc => {
          identityMap.set(doc.id, doc);
        });

        const mergedList = Array.from(identityMap.values());
        setDoctors(mergedList);
        setLoading(false);
      } catch (error) {
        console.error("Clinical Sync Error:", error);
        setLoading(false);
      }
    };

    fetchAllIdentities();

    const qLive = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const unsubUsers = onSnapshot(qLive, (snapshot) => {
      const liveData = snapshot.docs.map(doc => {
        const l = doc.data();
        const loginName = l.name || l.legalName || l.displayName || l.email?.split('@')[0] || 'Practitioner';
        return { id: doc.id, ...l, name: loginName };
      });
      setDoctors(prev => {
        const identityMap = new Map();
        prev.forEach(p => identityMap.set(p.id, p));
        liveData.forEach(l => identityMap.set(l.id, l));
        return Array.from(identityMap.values());
      });
    });

    // 2. Listen to Global Redemption Requests
    const qRedeem = query(collection(db, 'redemptions'), orderBy('requestedAt', 'desc'));
    const unsubRedeem = onSnapshot(qRedeem, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRedemptions(data);
      setLoadingRedemptions(false);
    });

    return () => {
      unsubUsers();
      unsubRedeem();
    };
  }, [db, hasMounted]);

  const handleProcessRedemption = async (redemption: any) => {
    setConfirmConfig({
      title: "Authorize Clinical Payout",
      message: `Confirm payout of ₹${redemption.amount.toLocaleString()}? This will mark the request as 'Paid' and deduct ${redemption.points} B-PTS from the practitioner's balance.`,
      type: 'info',
      onAction: async () => {
        try {
          const { doc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
          // 1. Mark redemption as paid
          await updateDoc(doc(db as any, 'redemptions', redemption.id), { status: 'Paid', processedAt: serverTimestamp() });

          // 2. Synchronize Practitioner Wallet (Subtract points/revenue)
          const drRef = doc(db as any, 'users', redemption.doctorUid);
          await updateDoc(drRef, {
            totalPoints: increment(-(redemption.points || 0)),
            walletBalance: increment(-(redemption.amount || 0))
          });

          toast.success("Clinical Payout Dispatched Successfully!");
        } catch (err) {
          console.error("Payout Processing Failure:", err);
          toast.error("Banking Ledger Update Failed.");
        }
      }
    });
    setShowConfirmModal(true);
  };

  const handleAdjustBalance = async () => {
    if (!selectedDoctor) return;
    setAdding(true);
    try {
      const { updateDoc, addDoc, getDoc, doc, collection, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      // Fetch dynamic exchange rate from settings
      const settingsSnap = await getDoc(doc(db as any, 'settings', 'global'));
      const exchangeRate = settingsSnap.exists() ? (settingsSnap.data().exchangeRate || 50) : 50;

      const newBalance = (selectedDoctor.walletBalance || 0) + adjustmentValue;
      const pointsChange = adjustmentValue / exchangeRate;
      const newPoints = (selectedDoctor.totalPoints || 0) + pointsChange;

      // 1. Update Profile Dashboard
      await updateDoc(doc(db as any, 'users', selectedDoctor.id), {
        walletBalance: newBalance,
        totalPoints: newPoints
      });

      // 2. CREATE OFFICIAL AUDIT TRAIL ENTRY
      await addDoc(collection(db as any, 'cases'), {
        doctorUid: selectedDoctor.id,
        patientName: "ADMIN MANUAL ADJUSTMENT",
        treatment: "Manual Credit Adjustment",
        points: pointsChange,
        bonusPoints: 0,
        status: "Approved",
        submittedAt: serverTimestamp(),
        bonusReason: adjustmentReason || "General Clinical Performance Reward"
      });

      toast.success(`Wealth Synchronized: +${pointsChange.toFixed(1)} Points Logged`);
      setAdjustmentValue(0);
      setAdjustmentReason('');
      setShowAdjustModal(false);

      // Update local baseline
      setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? { ...d, walletBalance: newBalance, totalPoints: newPoints } : d));
      setSelectedDoctor({ ...selectedDoctor, walletBalance: newBalance, totalPoints: newPoints });
    } catch (e) {
      console.error(e);
      toast.error('Financial Registry Sync failed.');
    } finally {
      setAdding(false);
    }
  };

  const filteredDoctors = (doctors || []).filter(d => {
    const q = queryQ.toLowerCase();
    const name = (d.name || '').toLowerCase();
    const email = (d.email || '').toLowerCase();
    const bio = (d.specialization || d.specialty || '').toLowerCase();
    const clinic = (d.clinic || '').toLowerCase();

    const matchesSearch = (
      name.includes(q) ||
      email.includes(q) ||
      bio.includes(q) ||
      clinic.includes(q)
    );

    // EXPERIENCE LOGIC: Junior < 1.5 yrs | Senior >= 1.5 yrs
    const exp = parseFloat(d.experience || '0');
    let matchesExperience = true;
    if (experienceFilter === 'junior') matchesExperience = exp < 1.5;
    if (experienceFilter === 'senior') matchesExperience = exp >= 1.5;

    return matchesSearch && matchesExperience;
  });

  const totalPages = Math.ceil(filteredDoctors.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDoctors = filteredDoctors.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (!hasMounted) return <DashboardLayout isAdminRoute={true}><div className="h-screen bg-slate-50 animate-pulse border-2 border-slate-200 rounded-2xl m-8" /></DashboardLayout>;

  const handleSaveName = async () => {
    if (!selectedDoctor || !editableName.trim()) return;
    setAdding(true);
    try {
      const { doc, updateDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const drRef = doc(db as any, 'users', selectedDoctor.id);
      
      // MASTER IDENTITY PATCH: Synchronizing Legal Identity
      await updateDoc(drRef, { 
        name: editableName.trim(),
        legalName: editableName.trim(), // Force sync to Legal Name field too
        updatedAt: new Date()
      });
      
      // Update local baseline sync
      setSelectedDoctor({ ...selectedDoctor, name: editableName.trim(), legalName: editableName.trim() });
      setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? { ...d, name: editableName.trim(), legalName: editableName.trim() } : d));
      
      setIsEditingName(false);
      toast.success("Identity Reconciled with Cloud Registry");
    } catch (e: any) {
      console.error("Clinical Identity Sync Failure:", e);
      if (e.code === 'permission-denied') {
        toast.error("Security Audit: Authorization failed. Check Admin clearance.");
      } else {
        toast.error("Connectivity Alert: Sync failed. Check network link.");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleCaseBonus = async (caseId: string, bonus: number, reason: string) => {
    if (!selectedDoctor || !bonus) return;
    setAdding(true);
    try {
      const { doc, updateDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      // 1. Fetch live rate
      const settingsSnap = await getDoc(doc(db as any, 'settings', 'global'));
      const rate = settingsSnap.exists() ? (settingsSnap.data().exchangeRate || 50) : 50;

      // 2. Update Case doc
      const caseRef = doc(db as any, 'cases', caseId);
      const bonusPointsVal = Number(bonus);
      const bonusCashVal = bonusPointsVal * rate;

      await updateDoc(caseRef, {
        bonusPoints: increment(bonusPointsVal),
        bonusReason: reason || "Admin Reward"
      });

      // 3. Update Doctor Balance (Atomic Increment to ensure accuracy)
      const drRef = doc(db as any, 'users', selectedDoctor.id);
      await updateDoc(drRef, {
        totalPoints: increment(bonusPointsVal),
        walletBalance: increment(bonusCashVal),
        updatedAt: serverTimestamp()
      });

      // 4. Update Local State (Immediate Visual Feedback)
      const currentCaseBonus = Number(selectedAuditCase.bonusPoints || 0);
      const updatedCaseBonus = currentCaseBonus + bonusPointsVal;
      const updatedDrPoints = (selectedDoctor.totalPoints || 0) + bonusPointsVal;
      const updatedDrBalance = (selectedDoctor.walletBalance || 0) + bonusCashVal;

      setSelectedAuditCase({ ...selectedAuditCase, bonusPoints: updatedCaseBonus, bonusReason: reason });
      setDoctorCases(prev => prev.map(c => c.id === caseId ? { ...c, bonusPoints: updatedCaseBonus, bonusReason: reason } : c));
      setSelectedDoctor({ ...selectedDoctor, totalPoints: updatedDrPoints, walletBalance: updatedDrBalance });
      toast.success(`Bonus Synchronized to Case ID: ${caseId.slice(-6)}`);

    } catch (err) {
      console.error(err);
      toast.error("Bonus sync failure");
    } finally {
      setAdding(false);
    }
  };

   const handleDeleteTransaction = async (caseId: string, points: number, bonusPoints: number = 0, caseSubmittedAt: any) => {
     if (!selectedDoctor) return;

     // 🛑 FINANCIAL AUDIT LOCK: Check if this case is already liquidated in a payout
     const drRedemptions = redemptions.filter(r => r.doctorUid === selectedDoctor.id);
     if (drRedemptions.length > 0) {
        const lastRequest = drRedemptions[0]; // Ordered by requestedAt desc
        const requestTime = lastRequest.requestedAt?.seconds || (lastRequest.requestedAt instanceof Date ? lastRequest.requestedAt.getTime() / 1000 : 0);
        const caseTime = caseSubmittedAt?.seconds || (caseSubmittedAt instanceof Date ? caseSubmittedAt.getTime() / 1000 : 0);

        if (caseTime <= requestTime) {
           setConfirmConfig({
              title: "FINANCIAL AUDIT LOCK",
              message: "SECURED ASSET: This clinical entry has already been managed in a paid payout request. To maintain absolute clinical ledger integrity, this record is permanently locked and cannot be revoked.",
              type: 'info',
              confirmLabel: "I UNDERSTAND",
              hideCancel: true,
              onAction: () => setShowConfirmModal(false)
           });
           setShowConfirmModal(true);
           return;
        }
     }

     setConfirmConfig({
       title: "Revoke Clinical Credit",
       message: `Are you sure you want to REVOKE this clinical credit of ${points + bonusPoints} pts? This will subtract points/cash from the practitioner's balance and delete the case record permanently.`,
       type: 'danger',
       onAction: async () => {
        try {
          const { doc, deleteDoc, updateDoc } = await import('firebase/firestore');

          // 1. Delete the record
          await deleteDoc(doc(db as any, 'cases', caseId));

          // 2. Update Doctor Balance
          const pointsToSubtract = Number(points) + Number(bonusPoints);
          const cashToSubtract = pointsToSubtract * exchangeRate;

          const newPoints = (selectedDoctor.totalPoints || 0) - pointsToSubtract;
          const newBalance = (selectedDoctor.walletBalance || 0) - cashToSubtract;

          await updateDoc(doc(db as any, 'users', selectedDoctor.id), {
            totalPoints: newPoints,
            walletBalance: newBalance
          });

          toast.success("Transaction Revoked & Balance Updated");

          // Update Local State
          setSelectedDoctor({ ...selectedDoctor, totalPoints: newPoints, walletBalance: newBalance });
          setDoctorCases(prev => prev.filter(c => c.id !== caseId));
        } catch (error) {
          console.error("Revocation Error:", error);
          toast.error("Failed to revoke credit");
        }
      }
    });
    setShowConfirmModal(true);
  };

  if (!hasMounted) {
    return (
      <DashboardLayout isAdminRoute={true}>
        <div className="flex-1 min-h-[60vh] flex items-center justify-center">
           <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse italic">Synchronizing Global Clinical Node...</p>
           </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout isAdminRoute={true}>
      <div className="space-y-6 pb-0" suppressHydrationWarning={true}>
        {/* Simple Compact Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" suppressHydrationWarning={true}>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-blue-900 tracking-tight">Doctor List</h1>
            <p className="text-slate-500 font-medium text-xs">Manage your doctor network and their points from here.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => {
                const headers = ['Name', 'Email', 'Phone', 'Clinic', 'Experience', 'Balance', 'Points'];
                const rows = doctors.map(d => [d.name, d.email, d.phone, d.clinic, d.experience, d.walletBalance, d.totalPoints].join(','));
                const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "Blueteeth_Doctors_List.csv");
                document.body.appendChild(link);
                link.click();
                toast.success('Doctor list downloaded');
              }}
              className="h-10 w-full sm:w-auto rounded-lg gap-2 font-bold text-[10px] uppercase tracking-widest border-slate-200"
            >
              <Download className="h-3.5 w-3.5" /> Download List
            </Button>
            <Button
              onClick={() => setShowNewDoctorModal(true)}
              className="h-10 w-full sm:w-auto rounded-lg gap-2 bg-blue-600 font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add New Doctor
            </Button>
          </div>
        </div>

        {/* Global Identity Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by name, email or clinic..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-100 shadow-sm transition-all"
              value={queryQ}
              onChange={(e) => {
                const params = new URLSearchParams(window.location.search);
                if (e.target.value) {
                  params.set('q', e.target.value);
                } else {
                  params.delete('q');
                }
                const newQuery = params.toString();
                router.replace(newQuery ? `${pathname}?${newQuery}` : pathname, { scroll: false });
              }}
            />
          </div>
          <div className="relative">
            <Button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              variant="outline" className={`h-11 w-full sm:w-auto px-6 rounded-lg border-slate-200 gap-2 font-bold text-[10px] uppercase tracking-widest transition-all ${experienceFilter !== 'all' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'text-slate-600'}`}
            >
              <Filter className="h-3.5 w-3.5" />
              {experienceFilter === 'all' ? 'Filters' : `${experienceFilter}s`}
            </Button>

            <AnimatePresence>
              {showFilterDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-2xl z-50 p-2 overflow-hidden"
                  >
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest p-3 bg-slate-50 rounded-lg mb-1">Clinical Experience</p>
                    <button
                      onClick={() => { setExperienceFilter('all'); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${experienceFilter === 'all' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                    >All Practitioners</button>

                    <button
                      onClick={() => { setExperienceFilter('junior'); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${experienceFilter === 'junior' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                    >Junior Doctors (&lt; 1.5 Yr)</button>

                    <button
                      onClick={() => { setExperienceFilter('senior'); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${experienceFilter === 'senior' ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                    >Senior Doctors (1.5+ Yr)</button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Scalable Doctor Stream */}
        <Card className="border border-slate-100 shadow-xl rounded-lg bg-white overflow-hidden" suppressHydrationWarning={true}>
          {/* Desktop View - Full Professional Table */}
          <div className="hidden lg:block overflow-x-auto" suppressHydrationWarning={true}>
            <table className="w-full text-left" suppressHydrationWarning={true}>
              <thead suppressHydrationWarning={true}>
                <tr className="bg-slate-50/50 border-b border-slate-100" suppressHydrationWarning={true}>
                  <th className="px-6 py-4 text-[9px] font-black text-blue-400 uppercase tracking-widest w-[40%]" suppressHydrationWarning={true}>Doctor Details</th>
                  <th className="px-6 py-4 text-[9px] font-black text-blue-400 uppercase tracking-widest text-center" suppressHydrationWarning={true}>Total Points & Cash</th>
                  <th className="px-6 py-4 text-[9px] font-black text-blue-400 uppercase tracking-widest text-center" suppressHydrationWarning={true}>Work Status</th>
                  <th className="px-6 py-4 text-[9px] font-black text-blue-400 uppercase tracking-widest text-right" suppressHydrationWarning={true}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse"><td colSpan={4} className="h-16 bg-slate-50/10"></td></tr>
                  ))
                ) : paginatedDoctors.length > 0 ? paginatedDoctors.map((doc, idx) => (
                  <motion.tr
                    key={doc.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-slate-50 transition-all group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 ring-1 ring-blue-500/10 shadow-sm border border-blue-100/50 overflow-hidden">
                          {doc.photoURL ? (
                            <img src={doc.photoURL} alt="p" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-blue-600 text-white text-xs font-black uppercase">
                              {doc.name?.charAt(0) || <Users className="h-4 w-4" />}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-blue-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                            {doc.name || doc.displayName || doc.email?.split('@')[0] || 'Practitioner'}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Mail className="h-2.5 w-2.5" /> {doc.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex flex-col items-center gap-0.5 p-2 bg-emerald-50 rounded-lg border border-emerald-100 ring-1 ring-inset ring-emerald-500/10">
                        <span className="text-xs font-black text-emerald-700 tracking-tight">₹{Math.round((doc.totalPoints || 0) * exchangeRate).toLocaleString()}</span>
                        <span className="text-[8px] font-black text-emerald-600/50 uppercase tracking-widest">{Number(doc.totalPoints || 0).toFixed(1)} PTS</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 rounded-lg bg-slate-50 text-[8px] font-black text-slate-500 uppercase tracking-widest border border-slate-200">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        onClick={() => {
                          setSelectedDoctor(doc);
                          setShowDrawer(true);
                        }}
                        variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-slate-100"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </td>
                  </motion.tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="h-12 w-12 text-slate-200 mb-4" />
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{queryQ ? 'No Matches Found' : 'No Practitioners'}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{queryQ ? `No practitioners matching "${queryQ}"` : 'The clinical registry is empty.'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View - Card Stack */}
          <div className="block lg:hidden divide-y divide-slate-100" suppressHydrationWarning={true}>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="p-6 animate-pulse">
                   <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
                   <div className="h-3 bg-slate-50 rounded w-3/4" />
                </div>
              ))
            ) : paginatedDoctors.length > 0 ? paginatedDoctors.map((doc, idx) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => { setSelectedDoctor(doc); setShowDrawer(true); }}
                className="p-5 active:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm overflow-hidden shrink-0">
                      {doc.photoURL ? (
                        <img src={doc.photoURL} alt="p" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-blue-600 text-white text-xs font-black">
                          {doc.name?.charAt(0) || 'DR'}
                        </div>
                      )}
                   </div>
                   <div className="min-w-0">
                      <p className="font-black text-blue-900 uppercase tracking-tight truncate pr-2">{doc.name || 'Practitioner'}</p>
                      <p className="text-[9px] font-medium text-slate-400 mt-0.5 truncate">{doc.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                         <span className="text-[10px] font-black text-emerald-600">₹{Math.round((doc.totalPoints || 0) * exchangeRate).toLocaleString()}</span>
                         <span className="h-1 w-1 bg-slate-200 rounded-full" />
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{Number(doc.totalPoints || 0).toFixed(1)} PTS</span>
                      </div>
                   </div>
                </div>
                <Button variant="ghost" className="h-10 w-10 p-0 rounded-lg bg-blue-50/50">
                   <ChevronRight className="h-5 w-5 text-blue-600" />
                </Button>
              </motion.div>
            )) : (
              <div className="p-12 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                No Doctors Found
              </div>
            )}
          </div>
        </Card>

        {/* Security Audit Banner (Restored) */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white relative overflow-hidden group shadow-xl">
          <ShieldAlert className="absolute right-[-20px] bottom-[-20px] h-32 w-32 text-white/10 group-hover:rotate-12 transition-all duration-1000" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-100 font-black text-[10px] uppercase tracking-[0.2em] mb-1">
                <ShieldCheck className="h-3 w-3" /> Security Identity Audit
              </div>
              <h3 className="text-lg font-black tracking-tight leading-none">Global Clinical Identity Protection</h3>
              <p className="text-blue-100/70 text-[11px] font-medium leading-relaxed max-w-lg">All practitioner identities are protected by AES-256 protocols. Profile changes are logged for security audits.</p>
            </div>
            <Button className="h-10 px-6 rounded-xl bg-white text-blue-900 font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 shadow-lg group gap-2">
              Initiate Audit <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-all" />
            </Button>
          </div>
        </div>
      </div>

      {/* Side Slide-Over Drawer */}
      <AnimatePresence>
        {showDrawer && selectedDoctor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDrawer(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[210]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-white shadow-2xl z-[211] overflow-hidden flex flex-col border-l border-slate-100"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-blue-900 uppercase tracking-widest">Doctor Profile</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Admin Control Panel</p>
                </div>
                <button onClick={() => setShowDrawer(false)} className="h-10 w-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-all group">
                  <X className="h-5 w-5 text-slate-400 group-hover:text-red-500" />
                </button>
              </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Compact Identity Card */}
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 text-white relative overflow-hidden shadow-2xl ring-4 ring-blue-500/10">
                     <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                     <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="h-20 w-20 rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform hover:rotate-3 group relative cursor-pointer" onClick={() => { setIsEditingName(true); setEditableName(selectedDoctor.name); }}>
                           {selectedDoctor.photoURL ? (
                             <img src={selectedDoctor.photoURL} alt="p" className="h-full w-full object-cover" />
                           ) : (
                             <div className="h-full w-full flex items-center justify-center bg-white/20 text-2xl font-black text-white uppercase">
                               {selectedDoctor.name?.charAt(0) || <Users className="h-8 w-8" />}
                             </div>
                           )}
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                              <BadgeCheck size={20} className="text-white" />
                           </div>
                        </div>

                        {isEditingName ? (
                          <div className="mt-4 flex flex-col gap-2 w-full px-8">
                            <input 
                              type="text" 
                              autoFocus 
                              value={editableName} 
                              onChange={(e) => setEditableName(e.target.value)}
                              className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-white/30 uppercase"
                              placeholder="Enter Clinical Name"
                            />
                            <div className="flex gap-2 justify-center">
                              <button onClick={handleSaveName} disabled={adding} className="text-[10px] bg-emerald-500 px-3 py-1 rounded-md font-black uppercase text-white shadow-lg">Save</button>
                              <button onClick={() => setIsEditingName(false)} className="text-[10px] bg-white/20 px-3 py-1 rounded-md font-black uppercase text-white hover:bg-white/30">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mt-4 ml-6">
                              <h3 className="text-xl font-black tracking-tight uppercase leading-none">{selectedDoctor.name || 'Practitioner'}</h3>
                              <button onClick={() => { setIsEditingName(true); setEditableName(selectedDoctor.name); }} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20 transition-all text-white/60 hover:text-white">
                                <PlusCircle size={14} />
                              </button>
                            </div>
                            <p className="text-blue-100/60 font-bold text-[10px] mt-2 lowercase flex items-center gap-2">
                               <Mail size={12} className="opacity-40" /> {selectedDoctor.email}
                            </p>
                          </>
                        )}
                     </div>
                  </div>

                  {/* Wealth Stats Recap */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Cash</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">₹{Math.round((selectedDoctor.totalPoints || 0) * exchangeRate).toLocaleString()}</h4>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Points</p>
                      <h4 className="text-lg font-black text-slate-900 mt-1">{Number(selectedDoctor.totalPoints || 0).toFixed(1)} <span className="text-[8px] text-slate-400">PTS</span></h4>
                    </div>
                  </div>

                  {/* HIGH-FIDELITY BIO-DATA DOSSIER */}
                  <div className="space-y-4">
                     {/* Financial Identity Bundle */}
                     <div className="p-5 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                           <Smartphone size={12} /> Payment Details
                        </p>
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">UPI Identity</p>
                              <p className="text-xs font-black text-slate-700 uppercase">{selectedDoctor.upiId || 'Not Linked'}</p>
                           </div>
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Bank Account</p>
                              <p className="text-xs font-black text-slate-700 uppercase">{selectedDoctor.bankAccount || 'Not Synchronized'}</p>
                           </div>
                           {selectedDoctor.bankName && (
                              <div className="flex items-center justify-between">
                                 <p className="text-[10px] font-bold text-slate-400 uppercase">Bank Branch</p>
                                 <p className="text-xs font-black text-slate-700 uppercase">{selectedDoctor.bankName}</p>
                              </div>
                           )}
                        </div>
                     </div>

                     {/* Clinical Profile Bundle */}
                     <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                           <Activity size={12} /> Doctor Details
                        </p>
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Clinical Focus</p>
                              <p className="text-xs font-black text-slate-700 uppercase">{selectedDoctor.specialization || 'Generalist'}</p>
                           </div>
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Experience</p>
                              <p className="text-xs font-black text-slate-700 uppercase">{selectedDoctor.experience || '-'}</p>
                           </div>
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Clinic Node</p>
                              <p className="text-xs font-black text-slate-700 uppercase max-w-[150px] text-right truncate">{selectedDoctor.clinicName || selectedDoctor.clinic || 'Blueteeth Partner'}</p>
                           </div>
                        </div>
                     </div>

                     {/* Contact & Location */}
                     <div className="p-5 bg-emerald-50/20 rounded-2xl border border-emerald-100/50">
                        <div className="flex items-center gap-4 mb-4">
                           <div className="h-8 w-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                              <Phone size={14} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Emergency Line</p>
                              <p className="text-xs font-black text-slate-700">{selectedDoctor.phone || 'Registry Locked'}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                              <MapPin size={14} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Clinic Coordinates</p>
                              <p className="text-xs font-black text-slate-700 leading-relaxed max-w-[200px]">{selectedDoctor.location || selectedDoctor.clinicAddress || 'Global Network'}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Clinical Action Hub Partition */}
                  <div className="h-px bg-slate-100 my-8" />

                  {/* Clinical Action Hub */}
                  <div className="space-y-4" suppressHydrationWarning={true}>
                  <div className="flex items-center gap-2 mb-2" suppressHydrationWarning={true}>
                    <div className="h-1 w-4 bg-indigo-500 rounded-full" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Identity Action Center</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="w-full relative group overflow-hidden bg-slate-900 text-white rounded-xl p-5 flex flex-col border border-white/5">
                      <div className="absolute top-0 right-0 p-3 opacity-[0.15]">
                        <CreditCard className="h-12 w-12" />
                      </div>
                      <div className="relative z-10 flex items-center justify-between w-full mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Registry Snapshot</span>
                        <ShieldCheck className="h-4 w-4 text-slate-600" />
                      </div>
                      <h4 className="text-sm font-black text-white relative z-10">Admin Control Lock</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={async () => {
                          setLoadingCases(true);
                          setShowAuditLogs(true);
                          try {
                            const { query, collection, where, getDocs } = await import('firebase/firestore');
                            const { db } = await import('@/lib/firebase');
                            const q = query(
                              collection(db as any, 'cases'),
                              where('doctorUid', '==', selectedDoctor.id)
                            );
                            const snap = await getDocs(q);
                            const cases = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                            // Client-side Sort: Eliminates Firebase Index Requirement
                            cases.sort((a: any, b: any) => {
                              const timeA = a.submittedAt?.seconds || 0;
                              const timeB = b.submittedAt?.seconds || 0;
                              return timeB - timeA;
                            });

                            setDoctorCases(cases);
                          } catch (err) {
                            console.error("Clinical Vault Access Failure:", err);
                          } finally {
                            setLoadingCases(false);
                          }
                        }}
                        className="flex flex-col items-center justify-center p-4 bg-blue-50/40 border border-blue-100/50 rounded-lg hover:bg-blue-100/40 transition-all group overflow-hidden"
                      >
                        <History className="h-5 w-5 text-slate-400 mb-2 group-hover:text-blue-600 transition-colors" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Audit Logs</span>
                      </button>
                      <button className="flex flex-col items-center justify-center p-4 bg-red-50/50 border border-red-100 rounded-lg hover:bg-red-100 transition-all group overflow-hidden">
                        <ShieldAlert className="h-5 w-5 text-red-300 mb-2 group-hover:text-red-500 transition-colors" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-600">Revoke Access</span>
                      </button>
                    </div>

                    {/* Full-Screen Clinical Audit Vault */}
                    <AnimatePresence>
                      {showAuditLogs && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[250] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 md:p-12"
                        >
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="bg-white w-full max-w-5xl h-full max-h-[85vh] rounded-lg shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col border border-white/20"
                          >
                            {/* Report Header - Enhanced for Mobile View */}
                            <div className="px-5 sm:px-8 py-4 sm:py-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
                              <div className="flex items-center gap-3 sm:gap-4">
                                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200 shrink-0">
                                  <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <div className="min-w-0">
                                  <h2 className="text-sm sm:text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight max-w-[220px] sm:max-w-none">
                                    Doctor Statement
                                  </h2>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1 truncate">Doctor: <span className="text-blue-600 truncate">{selectedDoctor?.name}</span></p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                                <button
                                  onClick={() => {
                                    setAdjustmentValue(0);
                                    setShowAdjustModal(true);
                                  }}
                                  className="flex-1 sm:flex-none h-10 px-4 sm:px-6 rounded-lg bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 group whitespace-nowrap"
                                >
                                  <PlusCircle className="h-4 w-4 text-white group-hover:rotate-90 transition-transform" /> 
                                  <span className="hidden xs:inline">Adjust Wealth</span>
                                  <span className="xs:hidden font-black">Adjust</span>
                                </button>
                                <button
                                  onClick={() => setShowAuditLogs(false)}
                                  className="h-10 w-10 rounded-lg bg-red-50 text-red-500 border border-red-100 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm shrink-0"
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              </div>
                            </div>

                            {/* Report Stats Summary - Enforced 2-Line Labels for Better Visual Weight */}
                            <div className="grid grid-cols-4 border-b border-slate-50">
                              <div className="p-4 sm:p-6 border-r border-slate-50 text-center">
                                <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">All Points</p>
                                <p className="text-sm sm:text-xl font-black text-slate-900 leading-none">{Number(selectedDoctor?.totalPoints || 0).toFixed(1)} <br className="sm:hidden" /><span className="text-[8px] sm:text-[10px] text-slate-400 uppercase font-bold">PTS</span></p>
                              </div>
                              <div className="p-4 sm:p-6 border-r border-slate-50 text-center">
                                <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Total Cash</p>
                                <p className="text-sm sm:text-xl font-black text-slate-900 leading-none">₹{(selectedDoctor?.walletBalance || 0).toLocaleString()}</p>
                              </div>
                              <div className="p-4 sm:p-6 border-r border-slate-50 text-center">
                                <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Case Count</p>
                                <p className="text-sm sm:text-xl font-black text-slate-900 leading-none">{doctorCases.length} <br className="sm:hidden" /><span className="text-[8px] sm:text-[10px] text-slate-400 uppercase font-bold">NODES</span></p>
                              </div>
                              <div className="p-4 sm:p-6 text-center bg-blue-50/30">
                                <p className="text-[7px] sm:text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5 leading-none">Market Rate</p>
                                <p className="text-sm sm:text-xl font-black text-blue-600 leading-none">₹{exchangeRate} <br className="sm:hidden" /><span className="text-[8px] sm:text-[10px] text-blue-400 uppercase font-bold">/ PT</span></p>
                              </div>
                            </div>

                            {/* Professional Table View */}
                            <div className="flex-1 flex flex-col">
                                                             <div className="px-4 sm:px-8 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-5 gap-1 sm:gap-4 items-center">
                                                                 <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none sm:leading-tight">Case <br className="sm:hidden" /> Summary</span>
                                                                 <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-none sm:leading-tight">Points</span>
                                                                 <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-none sm:leading-tight">Cash</span>
                                                                 <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest text-center leading-none sm:leading-tight">Status</span>
                                                                 <span className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest text-right leading-none sm:leading-tight">Actions</span>
                              </div>

                              <div className="divide-y divide-slate-100">
                                {loadingCases ? (
                                  <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
                                    <div className="animate-spin h-8 w-8 border-[3px] border-blue-600 border-t-transparent rounded-full" />
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Decrypting Clinical Vault...</p>
                                  </div>
                                ) : doctorCases.length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center py-20 grayscale opacity-20">
                                    <History className="h-20 w-20 mb-4" />
                                    <p className="text-sm font-black uppercase tracking-widest">No records found</p>
                                  </div>
                                ) : (
                                  doctorCases
                                    .slice((auditPage - 1) * 8, auditPage * 8)
                                    .map((c, i) => (
                                      <div
                                        key={i}
                                        onClick={() => setSelectedAuditCase(c)}
                                        className="px-4 sm:px-8 py-3 grid grid-cols-5 gap-1 sm:gap-4 items-center hover:bg-slate-50/80 transition-all cursor-pointer group border-b border-slate-50"
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                                          <p className="text-[10px] sm:text-[12px] font-black text-slate-900 uppercase group-hover:text-blue-600 transition-colors truncate">{c.patientName}</p>
                                          <div className="hidden sm:block h-4 w-px bg-slate-200" />
                                          <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase truncate pr-1">{c.treatment}</p>
                                        </div>

                                        <div className="text-center">
                                          <p className="text-[10px] sm:text-[12px] font-black text-blue-600">
                                            {c.points >= 0 ? '+' : ''}{Number(c.points).toFixed(1)}
                                            {c.bonusPoints > 0 && <span className="text-emerald-500 font-black ml-1"> (+{Number(c.bonusPoints).toFixed(1)})</span>}
                                            <span className="text-[7px] sm:text-[8px] ml-1 text-blue-300">PTS</span>
                                          </p>
                                        </div>

                                        <div className="text-center">
                                          <p className="text-[10px] sm:text-[12px] font-black text-slate-900 truncate">₹{Math.round((Number(c.points) + Number(c.bonusPoints || 0)) * exchangeRate).toLocaleString()}</p>
                                        </div>

                                        <div className="flex justify-center">
                                          <span className="px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-lg bg-emerald-50 text-[6px] sm:text-[8px] font-black text-emerald-600 border border-emerald-100 uppercase tracking-tight sm:tracking-widest truncate">
                                            {c.status?.toUpperCase() || 'VERIFIED'}
                                          </span>
                                        </div>

                                        <div className="flex justify-end items-center gap-1 sm:gap-2">
                                          <button className="hidden sm:flex px-3 py-1.5 rounded-lg border border-slate-100 text-[8px] font-black uppercase text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all items-center gap-1.5 bg-white">
                                            <Share2 size={10} /> Proof
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteTransaction(c.id, c.points, c.bonusPoints, c.submittedAt);
                                            }}
                                            className="h-7 w-7 rounded-lg border border-rose-50 text-rose-300 hover:text-white hover:bg-rose-500 hover:border-rose-500 transition-all flex items-center justify-center bg-white"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                )}
                              </div>
                            </div>

                            {/* Report Pagination Footer */}
                            {!loadingCases && doctorCases.length > 0 && (
                                                            <div className="px-6 py-4 bg-slate-900 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                  <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Pagination</p>
                                                                        <p className="text-[10px] font-bold text-white uppercase leading-none">Page {auditPage} of {Math.ceil(doctorCases.length / 8)}</p>
                                  </div>
                                  <div className="h-8 w-px bg-white/10" />
                                  <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Index Count</p>
                                                                        <p className="text-[10px] font-bold text-white uppercase leading-none">{doctorCases.length} Nodes Synced</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button
                                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                                    disabled={auditPage === 1}
                                                                        className="h-9 px-4 bg-white/5 border border-white/10 rounded-md text-[9px] font-black uppercase text-white hover:bg-white/10 disabled:opacity-20 transition-all"
                                  >PREVIOUS PROTOCOL</Button>

                                                                    <div className="h-9 w-9 bg-blue-600 rounded-md flex items-center justify-center text-[12px] font-black text-white shadow-xl shadow-blue-600/30">
                                    {auditPage}
                                  </div>

                                  <Button
                                    onClick={() => setAuditPage(p => Math.min(Math.ceil(doctorCases.length / 8), p + 1))}
                                    disabled={auditPage >= Math.ceil(doctorCases.length / 8)}
                                                                        className="h-9 px-4 bg-white/5 border border-white/10 rounded-md text-[9px] font-black uppercase text-white hover:bg-white/10 disabled:opacity-20 transition-all"
                                  >NEXT PROTOCOL</Button>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Deep Diagnostic Detail Viewer */}
                    <AnimatePresence>
                      {selectedAuditCase && (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedAuditCase(null)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                          />
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="relative bg-white rounded-lg shadow-2xl w-full max-w-[400px] overflow-hidden border border-slate-200"
                          >
                            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                                  <Activity className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none outline-none">Clinical Proof</h3>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Verification Index: {selectedAuditCase.id.slice(-8).toUpperCase()}</p>
                                </div>
                              </div>
                              <button onClick={() => setSelectedAuditCase(null)} className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="p-4 space-y-2.5">
                              {/* Clinical Evidence Image */}
                              <div 
                                onClick={() => {
                                  const url = selectedAuditCase.evidenceUrl;
                                  if (!url) return;
                                  
                                  if (url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf')) {
                                    const toastId = toast.loading("Opening clinical PDF...");
                                    try {
                                      if (url.startsWith('data:application/pdf')) {
                                        const base64Data = url.split(',')[1];
                                        const byteCharacters = atob(base64Data);
                                        const byteNumbers = new Array(byteCharacters.length);
                                        for (let i = 0; i < byteCharacters.length; i++) {
                                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                                        }
                                        const byteArray = new Uint8Array(byteNumbers);
                                        const blob = new Blob([byteArray], { type: 'application/pdf' });
                                        const blobUrl = URL.createObjectURL(blob);
                                        window.open(blobUrl, '_blank');
                                      } else {
                                        window.open(url, '_blank');
                                      }
                                      toast.success("Document opened.", { id: toastId });
                                    } catch (e) {
                                      toast.error("Format error. Try again.", { id: toastId });
                                      window.open(url, '_blank');
                                    }
                                  } else {
                                    window.open(url, '_blank');
                                  }
                                }}
                                className="relative h-24 group overflow-hidden bg-slate-100 rounded-2xl border border-slate-200 shadow-inner cursor-pointer"
                              >
                                {selectedAuditCase.evidenceUrl ? (
                                  (selectedAuditCase.evidenceUrl.startsWith('data:application/pdf') || selectedAuditCase.evidenceUrl.toLowerCase().includes('.pdf')) ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50/50 group-hover:bg-rose-100/50 transition-colors">
                                      <FilePlus className="h-8 w-8 text-rose-500 mb-1 group-hover:scale-110 transition-transform" />
                                      <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Open Clinical PDF</p>
                                    </div>
                                  ) : (
                                    <img
                                      src={selectedAuditCase.evidenceUrl}
                                      alt="Diagnostic Proof"
                                      className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                                    />
                                  )
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                                    <ShieldCheck className="h-10 w-10 text-slate-300 mb-3" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Official System Record:<br /><span className="text-blue-600">Manual Asset Sync</span></p>
                                  </div>
                                )}
                                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[8px] font-black text-slate-900 uppercase shadow-sm border border-slate-200/50 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                  {selectedAuditCase.evidenceUrl?.includes('pdf') ? 'SECURE PDF' : 'Encrypted Proof'}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Case Integrity Details</p>
                                  <div className="flex justify-between items-center py-1.5 border-b border-white">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Case Reference</span>
                                    <span className="text-[9px] font-black text-slate-900 uppercase">{selectedAuditCase.patientName}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1.5 border-b border-white">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Treatment</span>
                                    <span className="text-[9px] font-black text-slate-900 uppercase">{selectedAuditCase.treatment}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1.5 border-b border-white">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Base Reward</span>
                                    <span className="text-[9px] font-black text-slate-900">{Number(selectedAuditCase.points).toFixed(1)} pts</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1.5 border-b border-white">
                                    <span className="text-[9px] font-bold text-emerald-500 uppercase">Admin Bonus</span>
                                    <span className="text-[9px] font-black text-emerald-600">+{Number(selectedAuditCase.bonusPoints || 0).toFixed(1)} pts</span>
                                  </div>
                                  <div className="flex justify-between items-center py-1.5">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Total Clinical Wealth</span>
                                    <span className="text-[10px] font-black text-blue-600">₹{Math.round((Number(selectedAuditCase.points) + Number(selectedAuditCase.bonusPoints || 0)) * exchangeRate).toLocaleString()}</span>
                                  </div>
                                </div>

                                {/* Dynamic Bonus Adjustment Tool */}
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
                                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest leading-none text-left">Clinical Bonus Protocol</p>
                                  <div className="space-y-1.5">
                                    <input
                                      id="bonusInput" type="number" step="0.1" placeholder="+ Points"
                                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                    <textarea
                                      id="reasonInput" placeholder="Audit Justification"
                                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-[9px] font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-400 h-8 resize-none"
                                    />
                                    <button
                                      onClick={() => {
                                        const val = (document.getElementById('bonusInput') as HTMLInputElement).value;
                                        const reason = (document.getElementById('reasonInput') as HTMLTextAreaElement).value;
                                        handleCaseBonus(selectedAuditCase.id, Number(val), reason || "Deep Audit Bonus");
                                        (document.getElementById('bonusInput') as HTMLInputElement).value = '';
                                        (document.getElementById('reasonInput') as HTMLTextAreaElement).value = '';
                                      }}
                                      disabled={adding}
                                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                    >
                                      {adding ? 'Syncing...' : 'Authorize Clinical Asset'}
                                    </button>
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    const content = `
BLUETEETH CLINICAL CERTIFICATE
-------------------------------
VERIFICATION INDEX: ${selectedAuditCase.id.toUpperCase()}
DATE: ${new Date().toLocaleDateString()}
PRACTITIONER: ${selectedDoctor?.name || 'Authorized Network Node'}

CASE DOSSIER DETAILS:
- Patient Reference: ${selectedAuditCase.patientName}
- Clinical Treatment: ${selectedAuditCase.treatment}
- Base Reward Yield: ${Number(selectedAuditCase.points).toFixed(1)} PTS
- Administrative Bonus: +${Number(selectedAuditCase.bonusPoints || 0).toFixed(1)} PTS

FINANCIAL STANDING:
- Total Protocol Wealth: ₹${Math.round((Number(selectedAuditCase.points) + Number(selectedAuditCase.bonusPoints || 0)) * exchangeRate).toLocaleString()}

STATUS: CLINICALLY VERIFIED & SECURED
-------------------------------
INTERNAL REGISTRY AUDIT SUCCESSFUL
`;
                                    const blob = new Blob([content], { type: 'text/plain' });
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `Certificate_${selectedAuditCase.patientName.replace(/\s+/g, '_')}_${selectedAuditCase.id.slice(-6)}.txt`);
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    toast.success('Clinical Archive Downloaded');
                                  }}
                                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all hover:shadow-2xl hover:shadow-slate-300 active:scale-95"
                                >
                                  Download Case Certificate
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-50 bg-slate-50/30">
                <p className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">Identity Protected by Blueteeth Clinical Encryption</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Manual Balance Adjust Modal */}
      <AnimatePresence>
        {showAdjustModal && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdjustModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-[320px] overflow-hidden border border-slate-200"
            >
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                <div className="h-8 w-8 bg-slate-900 text-white rounded-lg flex items-center justify-center shadow-md">
                  <Coins className="h-4 w-4" />
                </div>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest truncate">Adjust Balance: {selectedDoctor?.name}</h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2 pb-0 relative">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      autoFocus
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black focus:border-blue-500 transition-all outline-none"
                      placeholder="0.00"
                      onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                    />
                    <p className="text-[8px] font-black text-slate-400 mt-2 uppercase tracking-tight italic">* Negative value to subtract</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Adjustment Reason</label>
                    <textarea
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="e.g. Clinical Bonus for March Performance"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold focus:border-blue-500 outline-none min-h-[80px]"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setShowAdjustModal(false)}
                    className="flex-1 h-10 rounded-lg text-[9px] font-black uppercase tracking-widest"
                  >Cancel</Button>
                  <Button
                    disabled={adding}
                    onClick={handleAdjustBalance}
                    className="flex-1 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                  >
                    {adding ? 'Syncing...' : 'Update Wealth'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Practitioner Modal */}
      <AnimatePresence>
        {showNewDoctorModal && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setShowNewDoctorModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
              <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg"><UserPlus className="h-6 w-6" /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Register Practitioner</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Manual Network Node Integration</p>
                </div>
              </div>
              <div className="p-8 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Full Name</label>
                    <input onChange={e => setNewDoctorData({ ...newDoctorData, name: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-blue-500 outline-none" placeholder="DR. VIKAS GARG" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Mobile ID</label>
                      <input onChange={e => setNewDoctorData({ ...newDoctorData, phone: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-blue-500 outline-none" placeholder="91XXXXXXXX" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Email Node</label>
                      <input onChange={e => setNewDoctorData({ ...newDoctorData, email: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-blue-500 outline-none" placeholder="mail@blueteeth.com" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Clinic Identity</label>
                    <input onChange={e => setNewDoctorData({ ...newDoctorData, clinic: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-blue-500 outline-none" placeholder="BLUETEETH CENTRAL HOSPITAL" />
                  </div>
                </div>
                <div className="flex gap-3 pt-6">
                  <Button variant="ghost" onClick={() => setShowNewDoctorModal(false)} className="flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest py-6">Cancel</Button>
                  <Button
                    onClick={async () => {
                      setAdding(true);
                      try {
                        const { createPractitioner } = await import('@/lib/firestore');
                        const res = await createPractitioner(newDoctorData);
                        if (res.success) {
                          toast.success('Practitioner Synchronized');
                          setShowNewDoctorModal(false);
                          // Refresh is automatic via Firebase Real-time data stream
                        } else {
                          toast.error(res.error || 'Identity Conflict Found');
                        }
                      } catch (e) {
                        toast.error('Clinical Node Sync failure');
                      } finally {
                        setAdding(false);
                      }
                    }}
                    isLoading={adding}
                    className="flex-1 rounded-xl bg-blue-600 font-black text-[10px] uppercase tracking-widest py-6 shadow-xl shadow-blue-500/20"
                  >Register Node</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Professional Clinical Verification Modal */}
      <AnimatePresence>
        {showConfirmModal && confirmConfig && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConfirmModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-lg shadow-3xl w-full max-w-[340px] overflow-hidden border border-slate-100 mx-auto">
              <div className={`p-5 ${confirmConfig.type === 'danger' ? 'bg-red-50' : 'bg-blue-50'} border-b border-slate-100 flex items-center gap-4`}>
                <div className={`h-10 w-10 ${confirmConfig.type === 'danger' ? 'bg-red-600' : 'bg-blue-600'} text-white rounded-lg flex items-center justify-center shadow-lg`}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{confirmConfig.title}</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Access Authority Verification</p>
                </div>
              </div>
              <div className="p-6 space-y-5 text-center sm:text-left">
                <p className="text-[12px] font-bold text-slate-600 leading-relaxed px-1">{confirmConfig.message}</p>
                <div className="flex flex-row gap-2 pt-2">
                  {!confirmConfig.hideCancel && (
                    <Button variant="ghost" onClick={() => setShowConfirmModal(false)} className="flex-1 rounded-lg border border-slate-200 font-black text-[9px] uppercase tracking-widest h-11">Decline</Button>
                  )}
                  <Button
                    onClick={async () => {
                      setConfirming(true);
                      await confirmConfig.onAction();
                      setConfirming(false);
                      setShowConfirmModal(false);
                    }}
                    isLoading={confirming}
                    className={`flex-1 rounded-lg ${confirmConfig.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black text-[9px] uppercase tracking-widest h-11 shadow-md`}
                  >
                    {confirmConfig.confirmLabel || 'Authorize Action'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

export default function DoctorList() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <DoctorListContent />
    </Suspense>
  );
}

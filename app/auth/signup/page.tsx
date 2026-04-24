'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Mail, Lock, Stethoscope, ArrowRight, User, ShieldCheck, Activity, Eye, EyeOff, CheckCircle2, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { sendEmail } from '@/lib/email';

type SignupStep = 'FORM' | 'OTP' | 'SUCCESS';

export default function SignupPage() {
  const [step, setStep] = useState<SignupStep>('FORM');
  const [formData, setFormData] = useState({
    name: '',
    clinicName: 'Blueteeth',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'associate' as 'associate' | 'clinician',
    regNo: ''
  });
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userId, setUserId] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (step === 'SUCCESS') {
      const timer = setTimeout(() => {
        const dest = formData.role === 'clinician' ? '/clinician' : '/doctor';
        router.push(dest);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, router, formData.role]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match!');
      return;
    }

    // 🕵️ GENUINE DATA VALIDATION (Strict Name & Reg No)
    const nameTrimmed = formData.name.trim();
    const nameRegex = /^[a-zA-Z]{2,}\s+[a-zA-Z\s]{2,}$/; // Matches "First Last" format
    const hasVowel = /[aeiouAEIOU]/.test(nameTrimmed);

    if (!nameRegex.test(nameTrimmed) || !hasVowel) {
      toast.error('Enter a valid Full Name (e.g., Rahul Sharma). No random letters allowed.');
      setLoading(false);
      return;
    }

    if (formData.role === 'clinician') {
      if (!formData.regNo || formData.regNo.length < 5) {
        toast.error('Invalid Registration Number. Provide genuine Medical ID.');
        setLoading(false);
        return;
      }
    }

    const toastId = toast.loading("Initializing Clinical Node...");
    setLoading(true);
    let userRecord = null;

    // 0. ADMIN SECURITY BLOCK
    const reservedEmails = ['admin@blueteeth.in', 'niteen02@gmail.com', 'nitinchauhan378@gmail.com', 'niteen02'];
    if (reservedEmails.includes(formData.email.toLowerCase())) {
        sendEmail({
            to_email: 'nitinchauhan378@gmail.com',
            user_email: formData.email,
            subject: '🚨 CRITICAL: Unauthorized Admin Registration Blocked',
            message: `URGENT: A registration attempt was BLOCKED. Someone tried to create a new profile using the reserved ADMIN email: ${formData.email}.`,
            passcode: 'ALERT_SIGNUP_BLOCKED',
            to_name: "Master Admin"
        }).catch(() => {});
        toast.error('Security Protocol: Restricted email usage is blocked.', { id: toastId });
        setLoading(false);
        return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      userRecord = userCredential.user;
      
      const displayName = formData.role === 'clinician'
        ? (formData.name.toLowerCase().startsWith('dr.') ? formData.name : `Dr. ${formData.name}`)
        : formData.name;
      await updateProfile(userRecord, { displayName });
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-in-use') {
        toast.error('An account already exists with this email. Please Login instead.', { id: toastId });
        setLoading(false);
        return;
      } else {
        console.error('>>> [FIREBASE AUTH ERROR]:', authError.code, authError.message);
        const firebaseErrors: Record<string, string> = {
          'auth/weak-password': 'Password too weak! Use at least 6 characters.',
          'auth/invalid-email': 'Invalid email address format.',
          'auth/network-request-failed': 'Network error. Check your internet connection.',
          'auth/too-many-requests': 'Too many attempts. Please wait a few minutes.',
          'auth/operation-not-allowed': 'Email signup is not enabled. Contact admin.',
          'auth/user-disabled': 'This account has been disabled.',
        };
        const msg = firebaseErrors[authError.code] || `Error: ${authError.message || authError.code}`;
        toast.error(msg, { id: toastId });
        setLoading(false);
        return;
      }
    }

    if (!userRecord) return;

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    setUserId(userRecord.uid);

    try {
      const emailResult = await sendEmail({ 
        email: formData.email, 
        to_email: formData.email,
        subject: "Blueteeth: OTP Verification",
        to_name: formData.name, 
        passcode: newOtp,
        otp: newOtp,
        message: `Your OTP is: ${newOtp}`,
        time: "10 minutes" 
      });

      // 🛠️ DEV: Always log OTP in console for debugging delivery issues


      if (!emailResult.success) {
        throw new Error(emailResult.error || "Failed to deliver OTP email.");
      }

      // Build display name with Dr. prefix for clinicians
      const finalName = formData.role === 'clinician'
        ? (formData.name.toLowerCase().startsWith('dr.') ? formData.name : `Dr. ${formData.name}`)
        : formData.name;

      await setDoc(doc(db, 'users', userRecord.uid), {
        name: finalName,
        clinicName: formData.clinicName,
        email: formData.email,
        role: formData.role,
        regNo: formData.role === 'clinician' ? formData.regNo : '',
        createdAt: new Date().toISOString(),
        points: 0,
        walletBalance: 0,
        emailVerified: false,
        pending: true,
        otp: newOtp
      }, { merge: true });

      setStep('OTP');
      setLoading(false);
      toast.success('Check your email for OTP', { id: toastId });

    } catch (e: any) {
      console.error(">>> [REGISTRATION FAILURE]:", e.message);
      const errorPrefix = step === 'FORM' ? "Database Error" : "Email Error";
      toast.error(`${errorPrefix}: ${e.message || "Please check your network"}`, { id: toastId });
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (otp === generatedOtp) {
      // 1. UPDATE DB STATUS
      await updateDoc(doc(db, 'users', userId), {
        pending: false,
        emailVerified: true,
        otp: null
      });

      // 2. DISPATCH SUCCESS WELCOME EMAIL (With Explicit Subject)
      try {
        await sendEmail({
           to_email: formData.email,
           to_name: formData.name,
           subject: "Welcome to Blueteeth Network! 🚀✨",
           message: `Congratulations ${formData.name}! Your associate reward portal has been successfully activated. You can now manage your Reward Points and Cases in real-time.`,
           passcode: "VERIFIED"
        });
      } catch(e) { console.warn("Welcome Notification Deferred."); }

      setStep('SUCCESS');
      toast.success('Identity Verified!');
    } else {
      toast.error('Invalid OTP Code.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-white" />
      
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl z-10">
        <Card className="border-0 shadow-2xl rounded-lg overflow-hidden bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-5 h-full">
             {/* Left Branding Node */}
            <div className="lg:col-span-2 relative p-6 text-white bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="h-14 w-14 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-xl">
                    <User className="h-8 w-8 text-blue-300" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold leading-tight tracking-tighter">Join Blueteeth Clinical Network.</h2>
                    <p className="text-blue-100/80 text-sm leading-relaxed font-medium">Unlock exclusive rewards and manage your professional cases with premium cloud tools.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-50">AES-256 Cloud Encrypted</span>
                  </div>

                  <div className="h-px w-full bg-white/10" />

                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Trusted by 500+ Practitioners</p>
                    <div className="flex items-center">
                       {[
                         "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80",
                         "https://images.unsplash.com/photo-1594824476967-48c8b964273f?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80",
                         "https://images.unsplash.com/photo-1622253692010-333f2da6031d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80",
                         "https://images.unsplash.com/photo-1537368910025-700350fe46c7?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
                       ].map((url, i) => (
                         <div key={i} className="h-9 w-9 rounded-full border-2 border-white/20 -ml-3 overflow-hidden first:ml-0 bg-slate-800 shadow-xl">
                           <img src={url} alt="clinical-practitioner" className="h-full w-full object-cover" />
                         </div>
                       ))}
                       <div className="h-9 px-4 rounded-full bg-blue-600 border-2 border-white/30 -ml-3 flex items-center justify-center text-[10px] font-bold text-white shadow-xl shadow-blue-500/20">500+</div>
                    </div>
                  </div>
                </div>
            </div>

            {/* Right Registration Node */}
            <div className="lg:col-span-3 p-6 sm:p-8 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {step === 'FORM' && (
                  <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="mb-4">
                      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Create Profile</h1>
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest opacity-80">
                        {formData.role === 'clinician' ? 'Clinician Specialist Setup' : 'Associate Identity Setup'}
                      </p>
                    </div>

                    <div className="mb-6 p-1.5 bg-slate-100 rounded-lg flex gap-1.5 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'associate' })}
                        className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                          formData.role === 'associate'
                            ? 'bg-white text-blue-600 shadow-md shadow-blue-500/5 ring-1 ring-slate-200'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Briefcase size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Associate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'clinician' })}
                        className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-lg transition-all duration-300 ${
                          formData.role === 'clinician'
                            ? 'bg-white text-blue-600 shadow-md shadow-blue-500/5 ring-1 ring-slate-200'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Stethoscope size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Clinician</span>
                      </button>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                            <input 
                              type="text" 
                              placeholder={formData.role === 'clinician' ? 'e.g. Rahul Sharma (Dr. added auto)' : 'Vivek Garg'} 
                              required 
                              value={formData.name} 
                              onChange={(e) => setFormData({...formData, name: e.target.value})} 
                              minLength={3}
                              maxLength={50}
                              className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 outline-none text-sm font-medium transition-all" 
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Clinic Name</label>
                          <div className="relative">
                            <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" size={16} />
                            <input
                              type="text"
                              value="Blueteeth"
                              readOnly
                              className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-100 bg-blue-50/60 text-blue-700 font-bold text-sm cursor-not-allowed select-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Reg. No. + Email — same row for clinician */}
                      <div className={`grid gap-4 ${formData.role === 'clinician' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                        {formData.role === 'clinician' && (
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest ml-1">Reg. No. <span className="text-rose-500">*</span></label>
                            <div className="relative">
                              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                              <input
                                type="text"
                                placeholder="e.g. MH-DCI-12345"
                                required
                                value={formData.regNo}
                                onChange={(e) => setFormData({...formData, regNo: e.target.value.toUpperCase()})}
                                minLength={5}
                                maxLength={15}
                                className="w-full pl-11 pr-4 py-3.5 rounded-lg border-2 border-indigo-100 bg-indigo-50/40 focus:bg-white focus:border-indigo-500 outline-none text-sm font-bold text-indigo-700 tracking-wider transition-all placeholder:font-normal placeholder:text-slate-400 placeholder:tracking-normal"
                              />
                            </div>
                          </div>
                        )}
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Official Email</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                            <input type="email" placeholder="you@example.com" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-11 pr-4 py-3.5 rounded-lg border border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 outline-none text-sm font-medium transition-all" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Secure Password</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                            <input type={showPassword ? "text" : "password"} placeholder="••••••••" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full pl-11 pr-11 py-3.5 rounded-lg border border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 outline-none text-sm font-medium transition-all" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-600">
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Repeat Password</label>
                          <div className="relative">
                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500" size={16} />
                            <input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" required value={formData.confirmPassword} onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} className="w-full pl-11 pr-11 py-3.5 rounded-lg border border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-600 outline-none text-sm font-medium transition-all" />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-600">
                              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <Button type="submit" isLoading={loading} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[12px] uppercase tracking-widest rounded-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-all mt-4">
                        Initialize My Profile <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </form>

                    <div className="mt-8 text-center">
                       <Link href="/auth/login" className="text-[10px] text-slate-400 font-bold hover:text-blue-600 transition-colors uppercase tracking-widest">
                         Already a Member? <span className="text-blue-600">Sign In</span>
                       </Link>
                    </div>
                  </motion.div>
                )}

                {step === 'OTP' && (
                  <motion.div key="otp" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="text-center">
                    <div className="h-20 w-20 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mx-auto mb-6 shadow-inner ring-1 ring-blue-100">
                       <ShieldCheck className="h-10 w-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight mb-2">Verify Identity</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-10">Enter the 6-digit code sent to your Medical email.</p>
                    <form onSubmit={handleVerifyOtp} className="space-y-6 max-w-sm mx-auto">
                      <input 
                        type="text" maxLength={6} required placeholder="000000"
                        className="w-full text-center text-5xl font-bold py-4 bg-slate-50 border-2 border-slate-100 rounded-lg focus:bg-white focus:border-blue-600 outline-none tracking-[0.3em] transition-all"
                        value={otp} onChange={(e) => setOtp(e.target.value)}
                      />
                      <Button type="submit" isLoading={loading} className="w-full h-15 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] uppercase tracking-widest rounded-lg shadow-xl shadow-blue-500/20 active:scale-95">Verify Identity Node</Button>
                    </form>
                    <button onClick={() => setStep('FORM')} className="mt-8 text-[9px] font-bold text-slate-300 uppercase tracking-widest hover:text-blue-600 transition-colors">Edit Registration Data</button>
                  </motion.div>
                )}

                {step === 'SUCCESS' && (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                    <div className="relative mx-auto h-24 w-24 mb-6">
                       <div className="absolute inset-0 bg-emerald-500/20 animate-ping rounded-full" />
                       <div className="relative h-24 w-24 bg-emerald-50 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                       </div>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight mb-2">Node Activated</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Redirecting to {formData.role === 'clinician' ? 'specialist' : 'associate'} dashboard...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

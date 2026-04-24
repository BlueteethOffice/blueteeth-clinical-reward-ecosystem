'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Lock, Stethoscope, ArrowRight, User, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { sendEmail } from '@/lib/email';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAdminFlow, setIsAdminFlow] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Email daalo pehle, phir "Forgot Password" click karo.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Password reset link sent! Apna email check karo. 📧');
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found'
        ? 'Yeh email registered nahi hai.'
        : err.code === 'auth/invalid-email'
        ? 'Invalid email format.'
        : 'Reset email send nahi hua. Try again.';
      toast.error(msg);
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
       setIsAdminFlow(window.location.search.includes('flow=admin'));
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Verifying Credentials...");
    setLoading(true);

    try {
      const sanitizedEmail = email.trim();
      const sanitizedPassword = password.trim();

      const userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('User profile not found in clinical registry.');
      }

      const userData = userSnap.data();
      const role = userData?.role || 'doctor';
      
      let dest = '/doctor';
      if (role === 'admin') dest = '/admin';
      else if (role === 'clinician') dest = '/clinician';
      
      router.push(dest);
      toast.success('Welcome Back!', { id: toastId });

      // 🛡️ SECURITY ALERT (silent background task)
      try {
        sendEmail({
            to_email: sanitizedEmail,
            to_name: userData?.name || 'Practitioner',
            subject: 'Login Alert: Successful Access ✅',
            message: `A successful login was recorded for your account. Time: ${new Date().toLocaleString()}`,
            passcode: 'SECURE_LOGIN_NODE'
        }).catch(() => {});
      } catch (_) {}

    } catch (error: any) {
        let errorMsg = 'Login failed. Check your credentials.';
        if (error.code === 'auth/wrong-password') errorMsg = 'Incorrect password. Please try again.';
        else if (error.code === 'auth/user-not-found') errorMsg = 'No account found with this email.';
        else if (error.code === 'auth/invalid-email') errorMsg = 'Invalid email format.';
        else if (error.message) errorMsg = error.message;

        toast.error(errorMsg, { id: toastId });
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-white" />
      
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl z-10">
        <Card className="border border-slate-200 shadow-2xl rounded-md overflow-hidden bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-5 h-full">
             {/* Left Identity Node */}
            <div className="lg:col-span-2 relative p-8 text-white bg-[#11235A] flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="h-14 w-14 rounded-md bg-white/10 flex items-center justify-center border border-white/30 shadow-inner">
                    <Lock className="h-7 w-7 text-amber-400" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-bold leading-tight tracking-tight">Blueteeth Clinical Portal.</h2>
                    <p className="text-slate-300 text-sm leading-relaxed font-medium">Manage your cases and track your rewards securely via Blueteeth Cloud.</p>
                  </div>
                </div>
                
                <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/10 border border-white/5 backdrop-blur-md w-fit">
                   <div className="h-4 w-4 rounded-full border-2 border-emerald-500/50 flex items-center justify-center">
                     <CheckCircle2 size={8} className="text-emerald-500" />
                   </div>
                   <span className="text-[10px] font-bold uppercase tracking-widest text-slate-100">AES-256 Cloud Encrypted</span>
                </div>
            </div>

            {/* Right Control Node */}
            <div className="lg:col-span-3 p-8 sm:p-10 flex flex-col justify-center">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-2">Welcome Back</h1>
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest opacity-80">Verified Identity Login</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Official ID / Email</label>
                    <div className="relative">
                       <User className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={16} />
                       <input type="text" placeholder="associate@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-md border border-slate-300 bg-slate-50/50 focus:bg-white focus:border-indigo-600 outline-none text-sm font-bold transition-all placeholder:text-slate-400" />
                    </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Secure Password</label>
                    <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                       <input type={showPassword ? "text" : "password"} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-12 py-4 rounded-md border border-slate-300 bg-slate-50/50 focus:bg-white focus:border-indigo-600 outline-none text-sm font-bold transition-all placeholder:text-slate-400" />
                       <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors">
                         {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                       </button>
                    </div>
                </div>

                <Button type="submit" isLoading={loading} className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-all mt-4">
                  Access Portal <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-[10px] text-blue-500 font-bold hover:text-blue-700 transition-colors uppercase tracking-widest disabled:opacity-50"
                >
                  {resetLoading ? 'Sending...' : '🔑 Forgot Password? Reset karo'}
                </button>
                <div className="h-px w-full bg-slate-100" />
                <Link href="/auth/signup" className="text-[10px] text-slate-400 font-bold hover:text-blue-600 transition-colors uppercase tracking-widest">
                  New Practitioner? <span className="text-blue-600">Register Now</span>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

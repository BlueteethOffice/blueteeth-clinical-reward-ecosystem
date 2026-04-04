'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userData: any | null;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userData: null,
  isAdmin: false,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const logout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        setUser(null);
        setUserData(null);
        setIsAdmin(false);
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    let userDocUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        // ROBUST FETCH: Retrieve identity baseline via high-reliability direct GET
        const fetchUserData = async () => {
          try {
            const userRef = doc(db, 'users', authUser.uid);
            const snapshot = await getDoc(userRef);
            
            if (snapshot.exists()) {
              const data = snapshot.data();
              setUserData(data);
              
              const masterEmails = ['admin@blueteeth.in', 'nitinchauhan378@gmail.com', 'niteen02@gmail.com', 'niteen02'];
              const isMaster = Boolean(authUser.email && masterEmails.includes(authUser.email.toLowerCase())) || data.role === 'admin';
              
              console.log(">>> [AUTH SYSTEM] Verified Role:", isMaster ? 'ADMIN' : 'DOCTOR');
              setIsAdmin(isMaster);
            } else {
              // Default Clinical Baseline if document missing
              const masterEmails = ['admin@blueteeth.in', 'nitinchauhan378@gmail.com', 'niteen02@gmail.com', 'niteen02'];
              const isMaster = Boolean(authUser.email && masterEmails.includes(authUser.email.toLowerCase()));
              
              setUserData({ 
                 name: isMaster ? 'Master Admin' : (authUser.displayName || 'Nimona Singh'), 
                 role: isMaster ? 'admin' : 'doctor', 
                 pending: false 
              });
              setIsAdmin(isMaster);
            }
            setLoading(false);
          } catch (error) {
            console.warn("Identity Fetch Latency (Network Check Req):", error);
            // Default recovery to prevent blocking the UI
            const masterEmails = ['admin@blueteeth.in', 'nitinchauhan378@gmail.com', 'niteen02@gmail.com', 'niteen02'];
            const isMaster = Boolean(authUser.email && masterEmails.includes(authUser.email.toLowerCase()));

            setUserData({ name: isMaster ? 'Master Admin' : 'System Doctor', role: isMaster ? 'admin' : 'doctor', pending: false });
            setIsAdmin(isMaster);
            setLoading(false);
          }
        };
        // Safety Timeout for Identity Fetch to prevent forever-spinner
        const timeoutId = setTimeout(() => {
          if (loading) {
            console.warn("Identity Fetch Timeout - Forcing Session Release");
            setLoading(false);
          }
        }, 8000);
        fetchUserData().finally(() => clearTimeout(timeoutId));
      } else {
        setUserData(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, userData, isAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

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

  // OPTIMISTIC INITIALIZATION: Load clinical snapshot from local storage to eliminate white-flicker
  useEffect(() => {
    try {
      const lastUid = localStorage.getItem('last_clinical_uid');
      if (lastUid) {
        const snapshot = localStorage.getItem(`clinical_identity_snapshot_${lastUid}`);
        if (snapshot) {
           const parsed = JSON.parse(snapshot);
           setUserData({ name: parsed.name, role: parsed.role });
           setIsAdmin(parsed.role === 'admin');
           // We keep loading=true until Firebase confirms, but now the UI has a skeleton data
        }
      }
    } catch (e) {}
  }, []);

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
        localStorage.setItem('last_clinical_uid', authUser.uid);
        // [OPTIMIZATION 1] FAST-PATH ADMIN DETECTION: Determine role via email prefix to bypass DB latency
        const masterEmails = ['admin@blueteeth.in', 'nitinchauhan378@gmail.com', 'niteen02@gmail.com', 'niteen02'];
        const lowerEmail = authUser.email?.toLowerCase() || '';
        const isMaster = masterEmails.includes(lowerEmail);
        
        if (isMaster) {
           console.log(">>> [AUTH GATEWAY] ELITE ADMIN IDENTITY RESOLVED (FAST-PATH)");
           setIsAdmin(true);
           // Release UI lock early for admin-speed navigation
           setLoading(false); 
        }

        const fetchUserData = async () => {
          try {
            const userRef = doc(db, 'users', authUser.uid);
            const snapshot = await getDoc(userRef);
            
            if (snapshot.exists()) {
              const data = snapshot.data();
              setUserData(data);
              
              const verifiedAdmin = isMaster || data.role === 'admin';
              setIsAdmin(verifiedAdmin);
              
              // Persist minimal identity for next-session optimistic rendering
              localStorage.setItem(`clinical_identity_snapshot_${authUser.uid}`, JSON.stringify({
                 role: verifiedAdmin ? 'admin' : 'doctor',
                 name: data.name
              }));
            } else {
              setUserData({ 
                 name: isMaster ? 'Master Admin' : (authUser.displayName || 'Practitioner'), 
                 role: isMaster ? 'admin' : 'doctor', 
                 pending: false 
              });
              setIsAdmin(isMaster);
            }
            setLoading(false);
          } catch (error) {
            console.warn("Identity Fetch Latency:", error);
            // Default recovery to avoid blocking the UI
            setIsAdmin(isMaster);
            setLoading(false);
          }
        };

        // Safety Timeout shortened for microsecond-feel navigation
        const timeoutId = setTimeout(() => {
          if (loading) {
            console.warn("Identity Fetch Latency Identified - Bypassing Profile Dependency");
            setLoading(false);
          }
        }, 3000); // 3s instead of 8s
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

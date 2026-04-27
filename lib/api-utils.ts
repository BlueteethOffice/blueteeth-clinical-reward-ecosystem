import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from './firebase-admin';

export interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export function apiResponse(
  success: boolean, 
  message: string, 
  data?: any, 
  status: number = 200
) {
  return NextResponse.json({
    success,
    message,
    data
  }, { status });
}

export async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing token');
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await adminAuth.verifyIdToken(token);
  
  const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
  const userData = userDoc.data();
  
  if (userData?.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  
  return { uid: decodedToken.uid, userData };
}

export async function logActivity(type: 'auth' | 'admin' | 'payout' | 'system', message: string, metadata: any = {}) {
  try {
    await adminDb.collection('logs').add({
      type,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      createdAt: new Date()
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

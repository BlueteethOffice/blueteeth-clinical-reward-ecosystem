import { NextRequest } from 'next/server';
import '@/lib/env-config';
import { adminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limiter';
import { apiResponse } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting (10 requests per minute per IP)
    const ip = req.headers.get('x-forwarded-for') || 'anonymous';
    const limitResult = await rateLimit(ip, 10, 60000);
    if (!limitResult.success) {
      return apiResponse(false, 'Too many requests. Please try again later.', null, 429);
    }

    // 2. Verify Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
       return apiResponse(false, 'Unauthorized', null, 401);
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      await adminAuth.verifyIdToken(token);
    } catch (e) {
       return apiResponse(false, 'Unauthorized', null, 401);
    }

    const { upiId } = await req.json();

    if (!upiId || !upiId.includes('@')) {
      return apiResponse(false, 'Invalid UPI format', null, 400);
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return apiResponse(false, 'Verification service unavailable', null, 503);
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/payments/validate/vpa', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vpa: upiId.trim().toLowerCase() }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return apiResponse(true, 'UPI verified', {
        name: data.customer_name || 'Name Verified',
        vpa: data.vpa,
      });
    } else {
      return apiResponse(false, 'UPI ID not found or invalid.');
    }

  } catch (error: any) {
    console.error('UPI Verification Error:', error);
    return apiResponse(false, 'Verification service temporarily unavailable.', null, 500);
  }
}

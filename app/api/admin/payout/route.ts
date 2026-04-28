import { NextRequest } from 'next/server';
import '@/lib/env-config';
import { apiResponse, verifyAdmin, logActivity } from '@/lib/api-utils';
import { PayoutSchema } from '@/lib/schemas';

const RAZORPAY_KEY = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_X_ACCOUNT = process.env.RAZORPAY_X_ACCOUNT_NUMBER;

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Admin Authentication & Authorization
    const { uid, userData } = await verifyAdmin(req);

    // 2. Parse & Validate Input
    const body = await req.json();
    const validation = PayoutSchema.safeParse(body);
    
    if (!validation.success) {
      return apiResponse(false, (validation.error as any).errors[0]?.message || 'Invalid data', null, 400);
    }

    const { amount, vpa, name, redemptionId, upiId } = validation.data;
    const finalVpa = vpa || upiId;

    // 3. Process Payout
    const isSimulation = !RAZORPAY_KEY || !RAZORPAY_SECRET || !RAZORPAY_X_ACCOUNT;

    if (isSimulation) {
      console.warn('⚠️ RAZORPAY KEYS MISSING: Entering Simulation Mode');
      
      // Simulate external latency
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Log Simulated Activity
      await logActivity('payout', `[SIMULATION] Payout of ₹${amount} simulated for ${name}`, {
        redemptionId,
        adminUid: uid,
        simulation: true
      });

      return apiResponse(true, 'Simulation: Payout logic verified. Connect keys for real settlement.', { 
        payoutId: `SIM_${Math.random().toString(36).substring(7).toUpperCase()}`,
        simulation: true 
      });
    }

    const auth = btoa(`${RAZORPAY_KEY}:${RAZORPAY_SECRET}`);
    
    // Create Fund Account
    const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_type: 'vpa',
        vpa: { address: finalVpa },
        contact: { 
           name: name || 'Associate Partner', 
           type: 'vendor', 
           contact: userData?.phone || '9999999999' 
        }
      })
    });

    const fundData = await fundRes.json();
    if (!fundRes.ok) throw new Error(fundData.error?.description || 'Fund account creation failed');

    // Execute Payout
    const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_number: RAZORPAY_X_ACCOUNT,
        fund_account_id: fundData.id,
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: redemptionId,
        notes: { redemptionId, adminUid: uid }
      })
    });

    const payoutData = await payoutRes.json();
    if (!payoutRes.ok) throw new Error(payoutData.error?.description || 'Payout execution failed');

    // 3. Log Payout Activity
    await logActivity('payout', `Payout of ₹${amount} executed for ${name}`, {
      redemptionId,
      adminUid: uid,
      payoutId: payoutData.id,
      vpa: finalVpa
    });

    return apiResponse(true, 'Payout processed successfully', { payoutId: payoutData.id });

  } catch (error: any) {
    console.error('PAYOUT ERROR:', error.message);
    const status = error.message.includes('Unauthorized') ? 401 : error.message.includes('Forbidden') ? 403 : 500;
    return apiResponse(false, error.message, null, status);
  }
}

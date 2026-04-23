import { NextResponse } from 'next/server';

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_X_ACCOUNT = process.env.RAZORPAY_X_ACCOUNT_NUMBER;

export async function POST(req: Request) {
  try {
    const { redemptionId, amount, details, method, doctorName, doctorEmail } = await req.json();

    // 1. Check for API Credentials — If missing, return simulation success
    if (!RAZORPAY_KEY || !RAZORPAY_SECRET || !RAZORPAY_X_ACCOUNT) {
      console.warn(">>> [PAYOUT SIMULATION] RAZORPAY KEYS NOT FOUND. BYPASSING ACTUAL DISPATCH.");
      return NextResponse.json({ 
        success: true, 
        simulation: true,
        message: "Simulation Completed. Connect Razorpay X for live settlement.",
        payout_id: `sim_pay_${Math.random().toString(36).substring(7)}`
      });
    }

    const auth = btoa(`${RAZORPAY_KEY}:${RAZORPAY_SECRET}`);

    // 2. Create Razorpay Contact
    const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({
        name: doctorName,
        email: doctorEmail || "payout@blueteeth.in",
        type: "associate",
        reference_id: redemptionId
      })
    });

    const contact = await contactRes.json();
    if (contact.error) throw new Error(`Contact Fault: ${contact.error.description}`);

    // 3. Create Fund Account
    const fundBody = method === 'upi' ? {
      account_type: 'vpa',
      vpa: { address: details },
      contact_id: contact.id
    } : {
      account_type: 'bank_account',
      bank_account: {
        name: doctorName,
        ifsc: details.split(' • ')[1],
        account_number: details.split(' • ')[0]
      },
      contact_id: contact.id
    };

    const fundRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify(fundBody)
    });

    const fund = await fundRes.json();
    if (fund.error) throw new Error(`Fund Account Fault: ${fund.error.description}`);

    // 4. Dispatch Payout Request
    const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Basic ${auth}`,
        'X-Payout-Idempotency': redemptionId // Prevent double payout
      },
      body: JSON.stringify({
        account_number: RAZORPAY_X_ACCOUNT,
        fund_account_id: fund.id,
        amount: amount * 100, // Amount in paise
        currency: "INR",
        mode: method === 'upi' ? "IMPS" : "NEFT",
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: redemptionId,
        narration: `Blueteeth: Associate Reward Payout - ${redemptionId.slice(-6)}`
      })
    });

    const payout = await payoutRes.json();
    if (payout.error) throw new Error(`Payout Dispatch Fault: ${payout.error.description}`);

    return NextResponse.json({ 
      success: true, 
      simulation: false,
      payout_id: payout.id,
      status: payout.status 
    });

  } catch (error: any) {
    console.error(">>> [PAYOUT CRITICAL FAILURE]:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

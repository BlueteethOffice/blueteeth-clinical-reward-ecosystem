/**
 * 🩺 ELITE CLINICAL DISPATCHER (V2: RESEND ENGINE)
 * This module uses our internal API route (/api/send-email) to dispatch
 * professional clinical notifications via the Resend API.
 * 3,000 Emails/Month Free Tier Capacity.
 */

export const sendEmail = async (params: Record<string, any>) => {
  try {
    const recipient = params.to_email || params.email;
    if (!recipient || (typeof recipient === 'string' && !recipient.includes('@'))) {
      console.warn(">>> [RESEND DISPATCH] ABORT: Invalid or Empty Recipient Address.");
      return { 
        success: false, 
        error: "Recipient address is missing or invalid.",
        status: 422
      };
    }

    const payload = {
      to: recipient,
      to_name: params.to_name || 'Dr.',
      subject: params.subject || 'Blueteeth Clinical Notification',
      message: params.message || 'Verification needed for your Blueteeth profile.',
      passcode: params.passcode || params.otp || null,
    };

    console.log(">>> [RESEND DISPATCH] HITTING INTERNAL API NODE...");
    
    // Using a relative path for the internal API route
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log(">>> [RESEND DISPATCH] SUCCESS: ID:", result.id);
      return { success: true, id: result.id };
    } else {
      console.error(">>> [RESEND DISPATCH] FAILURE NODE:", result.error);
      return { 
        success: false, 
        error: result.error?.message || result.error || "Service Error",
        status: response.status 
      };
    }
  } catch (error: any) {
    const errorMsg = error?.message || "Service Unreachable";
    console.error(">>> [RESEND DISPATCH] EXCEPTION:", errorMsg);
    
    return { 
      success: false, 
      error: errorMsg,
      status: 500 
    };
  }
};

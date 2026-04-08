/**
 * 🩺 ELITE CLINICAL DISPATCHER (V2: RESEND ENGINE)
 * This module uses our internal API route (/api/send-email) to dispatch
 * professional clinical notifications via the Resend API.
 * 3,000 Emails/Month Free Tier Capacity.
 */

import emailjs from '@emailjs/browser';

export const sendEmail = async (params: Record<string, any>) => {
  try {
    const recipient = params.to_email || params.email;
    if (!recipient || (typeof recipient === 'string' && !recipient.includes('@'))) {
      console.warn(">>> [DISPATCH] ABORT: Invalid Recipient Address.");
      return { success: false, error: "Invalid recipient address.", status: 422 };
    }

    const payload = {
      to: recipient,
      to_name: params.to_name || 'Doctor',
      subject: params.subject || 'Blueteeth Clinical Notification',
      message: params.message || 'Verification needed for your Blueteeth profile.',
      passcode: params.passcode || params.otp || null,
    };

    // 🏎️ STRATEGY A: Internal SMTP Node (Nodemailer/Gmail)
    console.log(">>> [DISPATCH] ATTENTION: Hitting Internal SMTP Node...");
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        console.log(">>> [SMTP SUCCESS]: ID:", result.id || 'N/A');
        return { success: true };
      }
      console.warn(">>> [SMTP FAILED]: Falling back to Cloud Dispatcher (EmailJS)...");
    } catch (smtpErr) {
      console.error(">>> [SMTP EXCEPTION]:", smtpErr);
    }

    // ☁️ STRATEGY B: Cloud Dispatcher (EmailJS) - Browser-side fallback
    console.log(">>> [DISPATCH] Hitting Cloud Dispatcher Flow...");
    
    // Mapping internal payload to EmailJS structure
    const emailJsParams = {
      to_email: recipient,
      to_name: payload.to_name,
      subject: payload.subject,
      message: payload.message,
      otp: payload.passcode,
      passcode: payload.passcode
    };

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_thvu0l4';
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_7nj9q8f';
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'pQVg9Ozfwc_qC1UaC';

    const ejResult = await emailjs.send(serviceId, templateId, emailJsParams, publicKey);
    
    if (ejResult.status === 200) {
      console.log(">>> [CLOUD DISPATCH SUCCESS]");
      return { success: true };
    }

    return { success: false, error: "All dispatchers failed.", status: ejResult.status };

  } catch (error: any) {
    console.error(">>> [DISPATCH EXCEPTION]:", error.message);
    return { success: false, error: error.message, status: 500 };
  }
};

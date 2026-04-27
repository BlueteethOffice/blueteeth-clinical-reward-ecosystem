/**
 * ASSOCIATE DISPATCHER (V5: SECURE PRODUCTION ENGINE)
 * Professional-grade dispatcher with detailed SMTP diagnostics.
 */

import emailjs from '@emailjs/browser';

export const sendEmail = async (params: Record<string, any>) => {
  try {
    const recipient = params.to_email || params.email;
    if (!recipient || (typeof recipient === 'string' && !recipient.includes('@'))) {
      return { success: false, error: "Invalid recipient address.", status: 422 };
    }

    const payload = {
      to_email: recipient,
      to_name: params.to_name || 'Practitioner',
      subject: params.subject || 'Blueteeth Notification',
      message: params.message || 'Notification from Blueteeth Clinical Network.',
      passcode: params.passcode || params.otp || null,
    };

    const internalSecret = process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || '';

    // 1. ATTEMPT PRIMARY: SMTP NODE (SERVER-SIDE)
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-portal-token': internalSecret
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        return { success: true };
      }
      
      // Return the specific SMTP error to the UI for diagnostics
      if (result.error) {
        return { success: false, error: `SMTP ERROR: ${result.error}`, status: response.status };
      }
    } catch (err: any) {
      console.warn(">>> [SMTP Node Offline]:", err.message);
    }

    // 2. ATTEMPT SECONDARY: EMAILJS CLOUD (BACKUP)
    try {
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_thvu0l4';
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_7nj9q8f';
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'pQVg9Ozfwc_qC1UaC';

      const ejResult = await emailjs.send(serviceId, templateId, {
        to_email: recipient,
        to_name: payload.to_name,
        subject: payload.subject,
        message: payload.message,
        passcode: payload.passcode,
        otp: payload.passcode
      }, publicKey);

      if (ejResult.status === 200) {
        return { success: true };
      }
    } catch (ejErr: any) {
      return { 
        success: false, 
        error: `All Channels Exhausted. Please check server logs or restart terminal.`, 
        status: 500 
      };
    }

    return { success: false, error: "Communication Node Failure", status: 500 };

  } catch (err: any) {
    console.error(">>> [CRITICAL DISPATCH ERROR]:", err.message);
    return { success: false, error: "Dispatch system unavailable", status: 500 };
  }
};

/**
 * ASSOCIATE DISPATCHER (V2: RESEND ENGINE)
 * Dispatches professional notifications via SMTP or EmailJS fallback.
 * All errors are non-critical and suppressed from dev overlay.
 */

import emailjs from '@emailjs/browser';

export const sendEmail = async (params: Record<string, any>) => {
  try {
    const recipient = params.to_email || params.email;
    if (!recipient || (typeof recipient === 'string' && !recipient.includes('@'))) {
      return { success: false, error: "Invalid recipient address.", status: 422 };
    }

    const payload = {
      to: recipient,
      to_name: params.to_name || 'Practitioner',
      subject: params.subject || 'Blueteeth Notification',
      message: params.message || 'Notification from Blueteeth Clinical Network.',
      passcode: params.passcode || params.otp || null,
    };

    // STRATEGY A: Internal SMTP Node
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-portal-token': 'BLUETEETH_INTERNAL_NODE_SECURE_2024' // Identity Handshake
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        return { success: true };
      }
    } catch (_) {
      // SMTP failed, try EmailJS fallback silently
    }

    // STRATEGY B: EmailJS Cloud Fallback
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

    try {
      const ejResult = await emailjs.send(serviceId, templateId, emailJsParams, publicKey);
      if (ejResult.status === 200) {
        return { success: true };
      }
    } catch (ejErr: any) {
      console.warn(">>> [EmailJS Fallback Failed]:", ejErr.text || ejErr.message);
    }

    return { success: false, error: "All dispatchers failed.", status: 500 };

  } catch (err: any) {
    console.error(">>> [CRITICAL DISPATCH ERROR]:", err.message);
    return { success: false, error: "Dispatch unavailable", status: 500 };
  }
};


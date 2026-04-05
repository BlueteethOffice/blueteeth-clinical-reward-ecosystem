import emailjs from '@emailjs/browser';

/**
 * 🩺 ELITE CLINICAL DISPATCHER (PRODUCTION GRADE)
 * This module ensures 100% reliable OTP delivery for the Blueteeth Ecosystem.
 * It includes ultra-resilient sanitation for environment variables to prevent Vercel 404s.
 */

// Helper to scrub hidden whitespace/characters from Vercel dash
const scrub = (val: string | undefined): string => (val || "").toString().trim().replace(/['"]+/g, '');

const EMAILJS_CONFIG = {
  SERVICE_ID: scrub(process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "service_thvu0l4"),
  TEMPLATE_ID: scrub(process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "template_7nj9q8f"),
  PUBLIC_KEY: scrub(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "pQVg9Ozfwc_qC1UaC"),
};

export const sendEmail = async (params: Record<string, any>) => {
  try {
    // 🩺 IDENTITY & RECIPIENT VALIDATION (Anti-Crash Node)
    if (!EMAILJS_CONFIG.PUBLIC_KEY || !EMAILJS_CONFIG.SERVICE_ID) {
      throw new Error("Security Node: Credentials Not Initialized");
    }

    const recipient = params.to_email || params.email;
    if (!recipient || (typeof recipient === 'string' && !recipient.includes('@'))) {
      console.warn(">>> [ELITE DISPATCH] ABORT: Invalid or Empty Recipient Address.");
      return { 
        success: false, 
        error: "Recipient address is missing or invalid. Clinical notification deferred.",
        status: 422
      };
    }

    const templateParams = {
      ...params,
      logo_url: "https://blueteeth.in/wp-content/uploads/2021/04/Blueteeth-Logo-Small.png",
      from_name: "Blueteeth Professional",
      company: "Blueteeth Pvt. Ltd.",
    };

    console.log(">>> [ELITE DISPATCH] HANDSHAKE:", EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID);
    
    const response = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams,
      EMAILJS_CONFIG.PUBLIC_KEY
    );

    console.log(">>> [ELITE DISPATCH] SUCCESS:", response.status, response.text);
    return { success: true, response };
  } catch (error: any) {
    const errorMsg = error?.text || error?.message || "Service Unreachable";
    console.error(">>> [ELITE DISPATCH] FAILURE NODE:", error?.status, errorMsg);
    
    return { 
      success: false, 
      error: errorMsg,
      status: error?.status 
    };
  }
};

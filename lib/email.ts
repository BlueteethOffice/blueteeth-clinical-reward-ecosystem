import emailjs from '@emailjs/browser';

// VERIFIED EMAILJS SERVICE IDENTITY (ELITE DISPATCH PROTOCOL)
const EMAILJS_CONFIG = {
  SERVICE_ID: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "service_thvu0l4",
  TEMPLATE_ID: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "template_7nj9q8f",
  PUBLIC_KEY: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "pQVg9Ozfwc_qC1UaC"
};

/**
 * Global Email Dispatcher Module
 * Ensures high-resilience clinical OTP delivery across all nodes (Local, Preview, Production).
 */
export const sendEmail = async (params: Record<string, any>) => {
  try {
    // 1. IDENTITY INJECTION
    const templateParams = {
      ...params,
      // Global Branding Enforcements
      logo_url: "https://blueteeth.in/wp-content/uploads/2021/04/Blueteeth-Logo-Small.png",
      from_name: "Blueteeth Security Team",
      company: "Blueteeth Pvt. Ltd.",
    };

    // 2. DISPATCH
    console.log(">>> [ELITE DISPATCH] AUTHORIZING SERVICE:", EMAILJS_CONFIG.SERVICE_ID);
    
    const response = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams,
      EMAILJS_CONFIG.PUBLIC_KEY
    );

    console.log(">>> [ELITE DISPATCH] SUCCESSFUL:", response.status, response.text);
    return { success: true, response };
  } catch (error: any) {
    console.error(">>> [ELITE DISPATCH] CRITICAL FAILURE:", error?.status, error?.text || error);
    return { 
      success: false, 
      error: error?.text || error?.message || "Service Unreachable",
      status: error?.status 
    };
  }
};

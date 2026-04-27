const requiredEnv = [
  'GMAIL_APP_PASSWORD',
  'GMAIL_USER',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_X_ACCOUNT_NUMBER',
  'INTERNAL_API_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

export function validateEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    const error = `>>> [CRITICAL] Missing required environment variables: ${missing.join(', ')}`;
    console.error(error);
    // In production, we want the app to fail fast if critical configs are missing.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(error);
    }
  }
}

// Auto-validate on import
validateEnv();

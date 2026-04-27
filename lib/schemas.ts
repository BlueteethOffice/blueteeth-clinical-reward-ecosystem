import { z } from 'zod';

// Schema for Payout Requests
export const PayoutSchema = z.object({
  amount: z.number().positive().min(100, "Minimum payout is ₹100"),
  vpa: z.string().email("Invalid UPI ID format").or(z.string().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/)),
  name: z.string().min(2, "Name is too short"),
  redemptionId: z.string().min(5, "Invalid Redemption ID"),
  upiId: z.string().optional(),
});

// Schema for UPI Verification
export const UpiVerificationSchema = z.object({
  upiId: z.string().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, "Invalid UPI ID format"),
});

// Schema for Email Dispatch
export const EmailSchema = z.object({
  to_email: z.string().email(),
  to_name: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  passcode: z.string().optional(),
});

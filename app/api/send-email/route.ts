import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import { apiResponse } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    // 1. Identity Handshake
    const portalToken = req.headers.get('x-portal-token');
    const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

    if (!INTERNAL_SECRET || portalToken !== INTERNAL_SECRET) {
      console.warn(">>> [SECURITY] Unauthorized email API access");
      return apiResponse(false, 'Identity Verification Failed', null, 403);
    }

    // 2. Parse Input
    const body = await req.json();
    const { to_email, to_name, subject, message, passcode } = body;

    if (!to_email || !to_email.includes('@')) {
      return apiResponse(false, 'Invalid recipient email', null, 400);
    }

    if (!process.env.GMAIL_APP_PASSWORD || !process.env.GMAIL_USER) {
      console.error(">>> [CRITICAL] Gmail credentials missing!");
      return apiResponse(false, 'Email service misconfigured', null, 500);
    }

    // 3. Send Email via Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const isOtp = !!passcode;

    const mailOptions = {
      from: `"Blueteeth Portal" <${process.env.GMAIL_USER}>`,
      to: to_email,
      subject: subject || (isOtp ? "Blueteeth: Identity Verification OTP" : "Blueteeth: Clinical Notification"),
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; background-color: #f8fafc; color: #1e293b;">
          <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
            <div style="background: #2563eb; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Blueteeth Clinical</h1>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Hello ${to_name || "Partner"},</p>
              <div style="font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 25px; white-space: pre-wrap;">
                ${message || (isOtp ? "Please use the following verification code to secure your account:" : "You have a new update regarding your clinical submissions.")}
              </div>
              ${isOtp ? `
                <div style="background: #f1f5f9; padding: 25px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px dashed #cbd5e1;">
                  <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #1e293b; font-family: monospace;">
                    ${passcode}
                  </span>
                  <p style="font-size: 11px; color: #64748b; margin-top: 10px; text-transform: uppercase; font-weight: 700;">Valid for 10 minutes</p>
                </div>
              ` : ''}
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
                  Best Regards,<br />
                  <strong>Operations Core</strong><br />
                  Blueteeth Clinical Network Team
                </p>
              </div>
            </div>
            <div style="background: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 10px; color: #94a3b8; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
                &copy; ${new Date().getFullYear()} Blueteeth Associate Network. Confidential Clinical Communication.
              </p>
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`>>> [SMTP] Email dispatched to ${to_email}`);
    return apiResponse(true, 'Email dispatched successfully');

  } catch (error: any) {
    console.error('>>> [SMTP ERROR]:', error.message);
    return apiResponse(false, `SMTP: ${error.message}`, null, 500);
  }
}

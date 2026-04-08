import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, to_email, to, subject, to_name, message, passcode } = body;
    const recipient = email || to_email || to;

    console.log(`>>> [SERVER EMAIL] TO: ${recipient}, SUBJECT: ${subject}, OTP: ${passcode}`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'blueteethofffice@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD, 
      },
    });

    const mailOptions = {
      from: '"Blueteeth Portal" <blueteethofffice@gmail.com>',
      to: recipient,
      subject: subject || "Blueteeth: Identity Verification OTP",
      html: `
        <div style="font-family: sans-serif; padding: 40px; border: 1px solid #e2e8f0; border-radius: 16px; max-width: 600px; margin: auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">Blueteeth Clinical Rewards</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Secure Professional Verification</p>
          </div>
          
          <p style="font-size: 16px; color: #1e293b;">Hello Dr. ${to_name || "Doctor"},</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.6;">
            ${message || "To complete your clinical profile activation, please use the following 6-digit verification code:"}
          </p>
          
          <div style="background: #f8fafc; padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0; border: 1px dashed #cbd5e1;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #1e293b; font-family: monospace;">
              ${passcode || "------"}
            </span>
          </div>
          
          <p style="font-size: 13px; color: #94a3b8; text-align: center;">
            This code expires in 10 minutes. If you did not request this code, please ignore this email.
          </p>
          
          <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px; text-align: center;">
            <p style="font-size: 11px; color: #cbd5e1; margin: 0;">&copy; ${new Date().getFullYear()} Blueteeth Clinical Network. AES-256 Encrypted Flow.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('SMTP ERROR:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

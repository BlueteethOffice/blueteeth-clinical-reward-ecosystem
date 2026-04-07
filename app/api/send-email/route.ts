import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, to_email, to, subject, to_name, message, passcode } = body;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'blueteethofffice@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD, 
      },
    });

    const mailOptions = {
      from: '"Blueteeth Portal" <blueteethofffice@gmail.com>',
      to: email || to_email || to,
      subject: subject || "Blueteeth: Identity Verification OTP",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Blueteeth Clinical Rewards</h2>
          <p>Dr. ${to_name || "Doctor"},</p>
          <p>${message || "Your professional authentication code is below. Please enter it to finalize your enrollment."}</p>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e293b;">
            ${passcode}
          </div>
          <p style="font-size: 11px; color: #64748b; margin-top: 20px;">
            This is an automated professional message. If you did not request this, please ignore it.
          </p>
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

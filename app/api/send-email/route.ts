import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, to_email, to, subject, to_name, message, passcode } = body;
    const recipient = email || to_email || to;

    if (!recipient) {
      return NextResponse.json({ success: false, error: 'Recipient missing' }, { status: 400 });
    }

    console.log(`>>> [SERVER EMAIL] Dispatching to: ${recipient}`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'blueteethofffice@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD, 
      },
    });

    const isOtp = !!passcode;

    const mailOptions = {
      from: '"Blueteeth Portal" <blueteethofffice@gmail.com>',
      to: recipient,
      subject: subject || (isOtp ? "Blueteeth: Identity Verification OTP" : "Blueteeth: Clinical Notification"),
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; background-color: #f8fafc; color: #1e293b;">
          <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
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
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('SMTP ERROR:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

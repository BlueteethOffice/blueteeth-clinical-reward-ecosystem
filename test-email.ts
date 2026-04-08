import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

async function testEmail() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'blueteethofffice@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const mailOptions = {
    from: '"Blueteeth Test" <blueteethofffice@gmail.com>',
    to: 'nitinchauhan378@gmail.com',
    subject: 'SMTP TEST',
    text: 'If you see this, SMTP is working.',
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
  } catch (error) {
    console.error('SMTP Error: ' + error.message);
  }
}

testEmail();

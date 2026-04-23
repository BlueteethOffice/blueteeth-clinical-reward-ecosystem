const nodemailer = require('nodemailer');

async function testSMTP() {
  console.log('>>> [1] Testing SMTP connection...');
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'blueteethofffice@gmail.com',
      pass: 'bimuiivynwzannmv',
    },
  });

  try {
    await transporter.verify();
    console.log('>>> [2] SMTP AUTH: OK - Connected to Gmail');
  } catch (err) {
    console.error('>>> [2] SMTP AUTH FAILED:', err.message);
    console.error('>>> Full Error:', err.code, err.responseCode);
    return;
  }

  console.log('>>> [3] Sending test OTP email...');
  try {
    const info = await transporter.sendMail({
      from: '"Blueteeth Test" <blueteethofffice@gmail.com>',
      to: 'nitinchauhan378@gmail.com',
      subject: '[TEST] OTP Email - ' + new Date().toLocaleString('en-IN'),
      html: '<h2>Test OTP: <b>123456</b></h2><p>If you see this, SMTP is working!</p>',
    });
    console.log('>>> [4] EMAIL SENT SUCCESS!');
    console.log('>>> Message ID:', info.messageId);
    console.log('>>> Response:', info.response);
    console.log('>>> Accepted:', info.accepted);
    console.log('>>> Rejected:', info.rejected);
  } catch (err) {
    console.error('>>> [4] EMAIL SEND FAILED!');
    console.error('>>> Error:', err.message);
    console.error('>>> Code:', err.code);
    console.error('>>> Response:', err.response);
    console.error('>>> ResponseCode:', err.responseCode);
    console.error('>>> Command:', err.command);
  }
}

testSMTP();


export const generateCertificate = (caseData: any, doctorData: any) => {
  return new Promise<string>((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve('');

    // High Resolution A4 Portrait (300 DPI approx for 2480x3508, but let's go with 2000x2828 for performance)
    canvas.width = 2000;
    canvas.height = 2828;

    // 1. Background & Base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Outer Border (Slate-900)
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 60;
    ctx.strokeRect(80, 80, canvas.width - 160, canvas.height - 160);

    // Inner Accent Border (Blue-600)
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 4;
    ctx.strokeRect(120, 120, canvas.width - 240, canvas.height - 240);

    // 2. Header Branding
    const centerX = canvas.width / 2;
    
    // Logo Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 100px sans-serif';
    ctx.fillText('BLUETEETH', centerX, 350);

    // Sub-Branding
    ctx.fillStyle = '#2563EB';
    ctx.font = '700 32px sans-serif';
    ctx.letterSpacing = '12px';
    ctx.fillText('CLINICAL REWARD ECOSYSTEM', centerX, 420);
    ctx.letterSpacing = '0px'; // Reset

    // Decorative Line
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 300, 480);
    ctx.lineTo(centerX + 300, 480);
    ctx.stroke();

    // 3. Main Title (Wrapped if necessary)
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 85px sans-serif';
    const title = 'CERTIFICATE OF CLINICAL INTEGRITY';
    
    // Function to wrap text
    const wrapText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const words = text.split(' ');
      let line = '';
      let currentY = y;
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
      return currentY;
    };

    const titleEndY = wrapText(title, centerX, 650, 1600, 100);

    // 4. Achievement Text
    ctx.fillStyle = '#64748B';
    ctx.font = '500 40px sans-serif';
    ctx.fillText('This document serves as an official verification of clinical work performed by', centerX, titleEndY + 120);

    // 5. Practitioner Name (Highlighted)
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 110px sans-serif';
    ctx.fillText(doctorData?.name?.toUpperCase() || 'AUTHORIZED PRACTITIONER', centerX, titleEndY + 280);

    // 6. Data Ledger (Clean & Spaced)
    const ledgerStartY = titleEndY + 450;
    const ledgerX = centerX - 500;
    const labelWidth = 400;

    const data = [
      { label: 'PATIENT REFERENCE', value: caseData.patientName },
      { label: 'TREATMENT PROTOCOL', value: caseData.treatmentName || caseData.treatment },
      { label: 'VERIFICATION INDEX', value: (caseData.id || '').toUpperCase() },
      { label: 'CLINICAL ASSET YIELD', value: `${(Number(caseData.points) + Number(caseData.bonusPoints || 0)).toFixed(1)} B-POINTS` },
      { label: 'FINANCIAL SETTLEMENT', value: `₹${Math.round((Number(caseData.points) + Number(caseData.bonusPoints || 0)) * 50).toLocaleString()}` },
      { label: 'COMPLETION TIMESTAMP', value: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).toUpperCase() }
    ];

    data.forEach((item, i) => {
      const y = ledgerStartY + (i * 150);
      
      // Label
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94A3B8';
      ctx.font = '900 28px sans-serif';
      ctx.fillText(item.label, ledgerX, y);

      // Value
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 42px sans-serif';
      ctx.fillText(item.value?.toString().toUpperCase() || 'N/A', ledgerX, y + 60);

      // Thin separator
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ledgerX, y + 100);
      ctx.lineTo(ledgerX + 1000, y + 100);
      ctx.stroke();
    });

    // 7. Verification & Status
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 32px sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText('STATUS: CLINICALLY VERIFIED & AUDIT SECURED', centerX, 2550);
    ctx.letterSpacing = '0px';

    // 8. Seal Section
    const sealX = canvas.width - 400;
    const sealY = 2500;
    
    // Outer Circle
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(sealX, sealY, 140, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Circle
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sealX, sealY, 125, 0, Math.PI * 2);
    ctx.stroke();

    // Seal Text
    ctx.fillStyle = '#2563EB';
    ctx.font = '900 24px sans-serif';
    ctx.fillText('OFFICIAL', sealX, sealY - 15);
    ctx.fillText('VERIFIED', sealX, sealY + 15);
    ctx.font = '700 18px sans-serif';
    ctx.fillText('BLUETEETH CORE', sealX, sealY + 45);

    // 9. Footnote
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '500 24px sans-serif';
    ctx.fillText('This is a system-generated secure record. Authenticity can be verified via the clinical portal.', centerX, 2720);

    resolve(canvas.toDataURL('image/png', 1.0));
  });
};

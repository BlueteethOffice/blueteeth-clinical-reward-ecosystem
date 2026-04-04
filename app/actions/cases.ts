'use server';

// FINAL SURGICAL REST API - BYPASSING ALL HANGS
export async function submitCaseAction(doctorUid: string, data: any) {
  try {
    const projectId = "blueteeth-rewards";
    const apiKey = "AIzaSyC2zJc4VWoOBXVZlOP2vzsd5EWeMZBdytQ";

    console.log(`[SURGERY] Direct Rest Sync with Cloud Portal: ${projectId}`);

    // FIRESTORE REST API - NO SDK HANGS POSSIBLE
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cases?key=${apiKey}`;

    const payload = {
      fields: {
        patientName: { stringValue: data.patientName || 'Untitled' },
        patientMobile: { stringValue: data.patientMobile || '0000000000' },
        treatment: { stringValue: data.treatment || 'Consultation' },
        notes: { stringValue: data.notes || '' },
        points: { integerValue: data.points || 0 },
        doctorUid: { stringValue: doctorUid },
        status: { stringValue: 'Pending' },
        submittedAt: { timestampValue: new Date().toISOString() },
        caseDate: { stringValue: data.caseDate || new Date().toISOString() }
      }
    };

    // 2-SECOND HARD TIMEOUT
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json();
      console.error('CLINICAL REJECTION:', err);
      return { success: false, error: err.error?.message || 'Cloud Link Refused' };
    }

    const result = await response.json();
    return { success: true, id: result.name.split('/').pop() };

  } catch (error: any) {
    console.error('REST SURGERY FATAL:', error);
    if (error.name === 'AbortError') {
      return { success: false, error: 'Clinical registry unreachable: Network Congestion/Timeout' };
    }
    return { success: false, error: 'Transmission Error: Could not reach Google Cloud' };
  }
}

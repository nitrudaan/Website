/**
 * UDAAN Email Service
 * Uses Google Apps Script as a backend to send emails via Gmail API.
 * Supports automatic failover to backup endpoint when primary fails/quota exceeded.
 */

const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL || '';
const EMAIL_API_URL_BACKUP = import.meta.env.VITE_EMAIL_API_URL_BACKUP || '';
const EMAIL_API_TOKEN = import.meta.env.VITE_EMAIL_API_TOKEN || '';

enum EmailType {
  OTP_VERIFICATION = 'OTP_VERIFICATION',
  INDUCTION_CREDENTIALS = 'INDUCTION_CREDENTIALS',
  ID_CHANGE = 'ID_CHANGE',
  INDUCTION_SUCCESS = 'INDUCTION_SUCCESS',
}

interface EmailPayload {
  name?: string;
  code?: string;
  expiryText?: string;
  memberId?: string;
  temporaryPassword?: string;
  oldId?: string;
  newId?: string;
  timestamp?: string;
}

/**
 * Attempts to send email to a single endpoint.
 * Google Apps Script deployed as web app supports CORS, so we use normal fetch.
 */
async function trySendToEndpoint(url: string, body: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow'
    });
    
    // Google Apps Script returns JSON response
    const text = await response.text();
    
    try {
      const result = JSON.parse(text);
      return result.status === 'success';
    } catch {
      // If response isn't JSON, check if fetch succeeded
      return response.ok;
    }
  } catch {
    return false;
  }
}

/**
 * Core email sending function with automatic failover.
 * Tries primary endpoint first, then backup if primary fails.
 * Email is non-blocking: failures return false but do not throw.
 */
async function sendEmail(
  type: EmailType,
  recipient: string,
  payload: EmailPayload
): Promise<boolean> {
  // Validate configuration
  if (!EMAIL_API_URL || !EMAIL_API_TOKEN) {
    return false;
  }

  const requestBody = JSON.stringify({
    type,
    recipient,
    payload,
    token: EMAIL_API_TOKEN
  });

  // Try primary endpoint first
  const primarySuccess = await trySendToEndpoint(EMAIL_API_URL, requestBody);
  if (primarySuccess) {
    return true;
  }

  // Primary failed - try backup if available
  if (EMAIL_API_URL_BACKUP) {
    const backupSuccess = await trySendToEndpoint(EMAIL_API_URL_BACKUP, requestBody);
    return backupSuccess;
  }

  return false;
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationCode: string
): Promise<boolean> {
  return sendEmail(EmailType.OTP_VERIFICATION, email, {
    name,
    code: verificationCode,
    expiryText: '15 minutes'
  });
}

export async function sendCredentialsEmail(
  email: string,
  name: string,
  memberId: string,
  temporaryPassword: string
): Promise<boolean> {
  return sendEmail(EmailType.INDUCTION_CREDENTIALS, email, {
    name,
    memberId,
    temporaryPassword
  });
}

export async function sendIdChangeNotificationEmail(
  memberName: string,
  oldId: string,
  newId: string,
  verifiedEmail: string
): Promise<boolean> {
  const timestamp = new Date().toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  });
  return sendEmail(EmailType.ID_CHANGE, verifiedEmail, {
    name: memberName,
    oldId,
    newId,
    timestamp
  });
}

export async function sendInductionSuccessEmail(
  email: string,
  name: string,
  memberId: string
): Promise<boolean> {
  return sendEmail(EmailType.INDUCTION_SUCCESS, email, {
    name,
    memberId
  });
}

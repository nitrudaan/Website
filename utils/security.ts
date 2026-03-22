/**
 * Security Utilities
 * Provides security-related functions for the application
 */

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate roll number format (NIT Rourkela format: 123XX0XXX)
 */
export function isValidRollNumber(rollNo: string): boolean {
  if (!rollNo) return false;
  const rollRegex = /^\d{3}[A-Z]{2}\d{4}$/;
  return rollRegex.test(rollNo.toUpperCase());
}

/**
 * Validate phone number (Indian format)
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const phoneRegex = /^[6-9]\d{9}$/;
  const cleaned = phone.replace(/[\s\-\+]/g, '');
  // Remove country code if present
  const number = cleaned.startsWith('91') ? cleaned.slice(2) : cleaned;
  return phoneRegex.test(number);
}

/**
 * Generate a secure random string (for verification codes, etc.)
 * Uses crypto API when available
 */
export function generateSecureCode(length: number = 6): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Generate a numeric code of specified length
  const code = (array[0] % Math.pow(10, length)).toString().padStart(length, '0');
  return code;
}

/**
 * Rate limiting helper - tracks attempts and enforces cooldown
 */
interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60000,
  lockoutMs: number = 300000
): { allowed: boolean; remainingAttempts: number; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    rateLimitStore.set(key, { attempts: 1, lastAttempt: now });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  // Check if locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000)
    };
  }

  // Reset if window has passed
  if (now - entry.lastAttempt > windowMs) {
    rateLimitStore.set(key, { attempts: 1, lastAttempt: now });
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  // Increment attempts
  entry.attempts++;
  entry.lastAttempt = now;

  if (entry.attempts > maxAttempts) {
    entry.lockedUntil = now + lockoutMs;
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfter: Math.ceil(lockoutMs / 1000)
    };
  }

  return { allowed: true, remainingAttempts: maxAttempts - entry.attempts };
}

/**
 * Clear rate limit for a key (e.g., after successful login)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Mask sensitive data for display (e.g., email, phone)
 */
export function maskEmail(email: string): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const maskedUser = user.length > 2 
    ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1]
    : '*'.repeat(user.length);
  return `${maskedUser}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * Safe JSON parse with fallback
 */
export function safeJSONParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Remove sensitive fields from an object before logging or storing
 */
export function sanitizeForLogging<T extends Record<string, any>>(
  obj: T,
  sensitiveFields: string[] = ['password', 'token', 'key', 'secret', 'credentials', 'otp', 'code']
): Partial<T> {
  const sanitized = { ...obj };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      (sanitized as any)[field] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * Secure session storage wrapper that encrypts data
 * Note: This provides basic obfuscation, not true encryption
 */
export const secureStorage = {
  setItem: (key: string, value: string): void => {
    try {
      // Basic encoding (not cryptographically secure, but prevents casual inspection)
      const encoded = btoa(unescape(encodeURIComponent(value)));
      sessionStorage.setItem(key, encoded);
    } catch {
      // Fallback to plain storage if encoding fails
      sessionStorage.setItem(key, value);
    }
  },

  getItem: (key: string): string | null => {
    try {
      const encoded = sessionStorage.getItem(key);
      if (!encoded) return null;
      // Try to decode
      return decodeURIComponent(escape(atob(encoded)));
    } catch {
      // Fallback to plain read if decoding fails
      return sessionStorage.getItem(key);
    }
  },

  removeItem: (key: string): void => {
    sessionStorage.removeItem(key);
  },

  clear: (): void => {
    sessionStorage.clear();
  }
};

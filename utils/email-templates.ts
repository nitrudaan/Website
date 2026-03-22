
/**
 * HTML Email Templates for UDAAN
 */

function escapeHtml(str: string) {
    return String(str).replace(/[&<>"']/g, (s) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[s as string] ?? s);
}

// Dark Tech Theme Constants
const EMAIL_STYLES = `
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #e2e8f0;
  line-height: 1.6;
  margin: 0;
  padding: 0;
  background-color: #000000;
  width: 100%;
`;

const CONTAINER_STYLE = `
  max-width: 600px;
  margin: 40px auto;
  padding: 0;
  background-color: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
`;

const HEADER_STYLE = `
  background-color: #020617;
  padding: 30px 20px;
  text-align: center;
  border-bottom: 2px solid #2563eb;
  background-image: linear-gradient(rgba(37, 99, 235, 0.1) 1px, transparent 1px),
  linear-gradient(90deg, rgba(37, 99, 235, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
`;

const LOGO_TEXT_STYLE = `
  color: #ffffff;
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(37, 99, 235, 0.8);
`;

const CONTENT_STYLE = `
  padding: 32px 30px;
`;

const FOOTER_STYLE = `
  text-align: center;
  background-color: #020617;
  padding: 20px;
  border-top: 1px solid #1e293b;
  color: #64748b;
  font-family: 'Courier New', monospace;
  font-size: 11px;
`;

const ACCENT_COLOR = '#38bdf8'; // Sky 400

/**
 * Generate HTML for Verification Code Email
 */
export function getVerificationEmailHtml(name: string, code: string, expiryText: string = '15 minutes'): string {
    const today = new Date().getFullYear();

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${EMAIL_STYLES}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 20px; background-color: #000000;">
            <div style="${CONTAINER_STYLE}">
              
              <!-- Header -->
              <div style="${HEADER_STYLE}">
                <h1 style="${LOGO_TEXT_STYLE}">UDAAN</h1>
                <p style="color: #94a3b8; margin: 8px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-family: monospace;"> System Notification</p>
              </div>
              
              <!-- Content -->
              <div style="${CONTENT_STYLE}">
                <div style="border-left: 3px solid ${ACCENT_COLOR}; padding-left: 12px; margin-bottom: 24px;">
                  <h2 style="color: #f8fafc; font-size: 20px; margin: 0; font-weight: 600;">Verification Required</h2>
                </div>
                
                <p style="color: #cbd5e1; font-size: 15px;">Target: <strong>${escapeHtml(name)}</strong></p>
                <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">A verification request has been initialized. Use the access code below.</p>
                
                <div style="background-color: #020617; border: 1px solid #1e293b; padding: 24px; text-align: center; margin: 28px 0; position: relative;">
                  <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: ${ACCENT_COLOR}; display: block; text-shadow: 0 0 10px rgba(56, 189, 248, 0.4);">${escapeHtml(code)}</span>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: flex-start; gap: 8px; font-size: 12px; color: #ef4444; font-family: monospace;">
                  <span>[!] EXPIRES IN ${escapeHtml(expiryText).toUpperCase()}</span>
                </div>
                
                <p style="color: #475569; font-size: 12px; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 12px;">
                  If this request was not initiated by you, terminate this session immediately (ignore email).
                </p>
              </div>
              
              <!-- Footer -->
              <div style="${FOOTER_STYLE}">
                <p style="margin: 0;">&copy; ${today} UDAAN AEROMODELLING CLUB</p>
                <p style="margin: 5px 0 0;">SYSTEM AUTOMATION</p>
              </div>
              
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for Credentials Email
 */
export function getCredentialsEmailHtml(name: string, memberId: string, temporaryPassword: string): string {
    const loginUrl = 'https://udaan-website-delta.vercel.app/induction-login';
    const today = new Date().getFullYear();

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${EMAIL_STYLES}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 20px; background-color: #000000;">
            <div style="${CONTAINER_STYLE}">
              
              <!-- Header -->
              <div style="${HEADER_STYLE}">
                <h1 style="${LOGO_TEXT_STYLE}">UDAAN</h1>
                <p style="color: #10b981; margin: 8px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-family: monospace;">Access Granted</p>
              </div>
              
              <!-- Content -->
              <div style="${CONTENT_STYLE}">
                <div style="border-left: 3px solid #10b981; padding-left: 12px; margin-bottom: 24px;">
                   <h2 style="color: #f8fafc; font-size: 20px; margin: 0; font-weight: 600;">Induction Credentials</h2>
                </div>

                <p style="color: #cbd5e1; font-size: 15px;">Pilot <strong>${escapeHtml(name)}</strong>,</p>
                <p style="color: #94a3b8; font-size: 14px;">Your clearance level has been updated. Access credentials for the Induction Portal are generated below.</p>
                
                <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; margin: 24px 0; border-left: 2px solid ${ACCENT_COLOR};">
                  <div style="margin-bottom: 16px;">
                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-family: monospace;">Member ID</span>
                    <div style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 600; color: #f8fafc; margin-top: 4px;">${escapeHtml(memberId)}</div>
                  </div>
                  <div style="border-top: 1px solid #1e293b; margin: 12px 0;"></div>
                  <div>
                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-family: monospace;">Temporary Cipher</span>
                    <div style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 600; color: #10b981; margin-top: 4px;">${escapeHtml(temporaryPassword)}</div>
                  </div>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="background-color: #1e293b; color: ${ACCENT_COLOR}; padding: 12px 24px; border: 1px solid ${ACCENT_COLOR}; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">Initialize Login &gt;</a>
                </div>
                
                <div style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px;">
                  <h4 style="margin: 0 0 6px; color: #ef4444; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-family: monospace;">Security Protocols</h4>
                  <ul style="margin: 0; padding-left: 20px; color: #9ca3af; font-size: 12px;">
                    <li style="margin-bottom: 4px;"> Credentials valid for <strong>Induction Portal</strong> only.</li>
                    <li style="margin-bottom: 4px;">Update password upon first entry.</li>
                  </ul>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="${FOOTER_STYLE}">
                <p style="margin: 0;">&copy; ${today} UDAAN COMMAND CENTRAL</p>
              </div>
              
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for ID Change Notification Email
 */
export function getIdChangeEmailHtml(name: string, oldId: string, newId: string, timestamp: string): string {
    const today = new Date().getFullYear();

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${EMAIL_STYLES}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 20px; background-color: #000000;">
            <div style="${CONTAINER_STYLE}">
              
              <!-- Header -->
              <div style="${HEADER_STYLE}">
                <h1 style="${LOGO_TEXT_STYLE}">UDAAN</h1>
                <p style="color: #fbbf24; margin: 8px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-family: monospace;">Profile Sync</p>
              </div>
              
              <!-- Content -->
              <div style="${CONTENT_STYLE}">
                <div style="border-left: 3px solid #fbbf24; padding-left: 12px; margin-bottom: 24px;">
                   <h2 style="color: #f8fafc; font-size: 20px; margin: 0; font-weight: 600;">ID Reassignment</h2>
                </div>

                <p style="color: #cbd5e1; font-size: 15px;">Unit <strong>${escapeHtml(name)}</strong>,</p>
                <p style="color: #94a3b8; font-size: 14px;">Your identifier has been updated in the database.</p>
                
                <div style="display: flex; align-items: center; justify-content: center; margin: 30px 0;">
                  <div style="text-align: center;">
                    <div style="font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 6px; font-family: monospace;">Old ID</div>
                    <div style="font-family: 'Courier New', monospace; font-size: 16px; color: #ef4444; text-decoration: line-through; opacity: 0.6;">${escapeHtml(oldId)}</div>
                  </div>
                  <div style="margin: 0 20px; color: #475569; font-size: 16px;">&gt;&gt;</div>
                  <div style="text-align: center;">
                    <div style="font-size: 10px; color: ${ACCENT_COLOR}; text-transform: uppercase; margin-bottom: 6px; font-family: monospace;">New ID</div>
                    <div style="font-family: 'Courier New', monospace; font-size: 18px; color: ${ACCENT_COLOR}; font-weight: 700; border-bottom: 1px solid ${ACCENT_COLOR}; padding-bottom: 2px;">${escapeHtml(newId)}</div>
                  </div>
                </div>
                
                <div style="background-color: rgba(56, 189, 248, 0.1); padding: 16px; border-left: 2px solid ${ACCENT_COLOR};">
                  <p style="margin: 0; color: #e2e8f0; font-size: 13px;">Use <strong>${escapeHtml(newId)}</strong> for all future system interactions.</p>
                </div>
                
                <p style="color: #475569; font-size: 10px; margin-top: 24px; font-family: monospace;">TIMESTAMP: ${escapeHtml(timestamp)}</p>
              </div>
              
              <!-- Footer -->
              <div style="${FOOTER_STYLE}">
                <p style="margin: 0;">&copy; ${today} UDAAN AEROMODELLING CLUB</p>
              </div>
              
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for Induction Success Email
 */
export function getInductionSuccessEmailHtml(name: string, memberId: string): string {
    const today = new Date().getFullYear();
    const loginUrl = 'https://udaan-website-delta.vercel.app/team-login';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${EMAIL_STYLES}">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 20px; background-color: #000000;">
            <div style="${CONTAINER_STYLE}">
              
              <!-- Header -->
              <div style="${HEADER_STYLE}">
                <h1 style="${LOGO_TEXT_STYLE}">UDAAN</h1>
                <p style="color: #10b981; margin: 8px 0 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-family: monospace;">Mission Status: ACCOMPLISHED</p>
              </div>
              
              <!-- Content -->
              <div style="${CONTENT_STYLE}">
                <div style="border-left: 3px solid #10b981; padding-left: 12px; margin-bottom: 24px;">
                   <h2 style="color: #f8fafc; font-size: 20px; margin: 0; font-weight: 600;">Welcome to the Team</h2>
                </div>

                <p style="color: #cbd5e1; font-size: 15px;">Pilot <strong>${escapeHtml(name)}</strong>,</p>
                <p style="color: #94a3b8; font-size: 14px;">Congratulations. You have successfully completed the induction process and have been granted <strong>Level 2 Clearance</strong>.</p>
                
                <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; margin: 24px 0; border-left: 2px solid ${ACCENT_COLOR};">
                  <p style="margin: 0 0 12px; color: #e2e8f0; font-size: 14px;">You have officially joined the roster.</p>
                  
                  <div style="margin-bottom: 16px;">
                    <span style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-family: monospace;">Callsign / Member ID</span>
                    <div style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 600; color: #f8fafc; margin-top: 4px;">${escapeHtml(memberId)}</div>
                  </div>
                </div>

                <p style="color: #94a3b8; font-size: 14px;">You can now log in to the main <strong>Team Portal</strong> to access resources, view projects, and collaborate with your division.</p>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginUrl}" style="background-color: #10b981; color: #020617; padding: 12px 24px; border: 1px solid #10b981; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">Enter Team Portal &gt;</a>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="${FOOTER_STYLE}">
                <p style="margin: 0;">&copy; ${today} UDAAN AEROMODELLING CLUB</p>
                <p style="margin: 5px 0 0;">OFFICIAL COMMUNICATION</p>
              </div>
              
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

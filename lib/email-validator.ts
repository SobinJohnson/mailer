import dns from 'dns';
import net from 'net';

export interface EmailValidationResult {
  valid: boolean;
  status: 'deliverable' | 'undeliverable' | 'mx_valid' | 'invalid_syntax' | 'dns_failed' | 'no_mx_records' | 'connection_error' | 'risky';
  error?: string;
  details?: string;
}

/**
 * Validates email reachability by verifying:
 * 1. Syntax (format check)
 * 2. DNS MX records existence
 * 3. SMTP mailbox connection handshake (pinging recipient mailbox)
 * 
 * Supports fallback for environments where outgoing port 25 is blocked (like Vercel).
 */
export async function checkEmailReachability(email: string): Promise<EmailValidationResult> {
  // 1. Basic syntax check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      status: 'invalid_syntax',
      error: 'The email address format is invalid.',
    };
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return {
      valid: false,
      status: 'invalid_syntax',
      error: 'The email address must contain exactly one "@" symbol.',
    };
  }
  const domain = parts[1];

  // 2. DNS MX Records Lookup
  let mxRecords: dns.MxRecord[];
  try {
    mxRecords = await dns.promises.resolveMx(domain);
  } catch (err: any) {
    return {
      valid: false,
      status: 'dns_failed',
      error: `DNS lookup failed for domain "${domain}": ${err.message}`,
    };
  }

  if (!mxRecords || mxRecords.length === 0) {
    return {
      valid: false,
      status: 'no_mx_records',
      error: `No MX (Mail Exchange) records found for domain "${domain}". This domain cannot receive emails.`,
    };
  }

  // Sort MX records by priority (lower number = higher priority)
  mxRecords.sort((a, b) => a.priority - b.priority);
  const bestMxHost = mxRecords[0].exchange;

  // 3. SMTP Connection Handshake (Ping Mailbox)
  return new Promise((resolve) => {
    // Port 25 is the standard SMTP port for server-to-server mail delivery
    const socket = net.createConnection(25, bestMxHost);
    socket.setTimeout(4000); // 4 seconds timeout for connection & handshake steps

    let resolved = false;
    let step = 0; // 0: greeting, 1: EHLO, 2: MAIL FROM, 3: RCPT TO

    const handleResolve = (result: EmailValidationResult) => {
      if (resolved) return;
      resolved = true;
      try {
        socket.write('QUIT\r\n');
        socket.end();
      } catch (e) {}
      resolve(result);
    };

    socket.on('connect', () => {
      // TCP connection established, waiting for SMTP greeting (220)
    });

    socket.on('data', (chunk) => {
      const data = chunk.toString();
      const lines = data.split('\r\n').filter(Boolean);
      
      // Get the last status code in this chunk response
      const lastLine = lines[lines.length - 1];
      const code = lastLine?.slice(0, 3);
      const isMultiLinePending = lastLine?.charAt(3) === '-'; // e.g. "250-SIZE" means more lines are pending

      if (isMultiLinePending) {
        // Wait for next data chunk to get the final line of multi-line response
        return;
      }

      try {
        if (step === 0) {
          // Expecting 220 greeting
          if (code !== '220') {
            return handleResolve({
              valid: false,
              status: 'connection_error',
              error: `SMTP server rejected connection with code ${code}: ${lastLine}`,
            });
          }
          step = 1;
          socket.write('EHLO mailer-system.com\r\n');
        } else if (step === 1) {
          // Expecting 250 response to EHLO
          if (code !== '250') {
            return handleResolve({
              valid: false,
              status: 'connection_error',
              error: `SMTP handshake (EHLO) rejected with code ${code}: ${lastLine}`,
            });
          }
          step = 2;
          socket.write('MAIL FROM:<verify@mailer-system.com>\r\n');
        } else if (step === 2) {
          // Expecting 250 response to MAIL FROM
          if (code !== '250') {
            return handleResolve({
              valid: false,
              status: 'connection_error',
              error: `SMTP MAIL FROM command rejected with code ${code}: ${lastLine}`,
            });
          }
          step = 3;
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (step === 3) {
          // Expecting response to RCPT TO
          if (code === '250' || code === '251') {
            handleResolve({
              valid: true,
              status: 'deliverable',
              details: `Recipient mailbox is deliverable. SMTP code: ${code}.`,
            });
          } else if (['550', '551', '552', '553', '554'].includes(code)) {
            handleResolve({
              valid: false,
              status: 'undeliverable',
              error: `Recipient mailbox is undeliverable/bounces. SMTP response: ${lastLine}`,
            });
          } else if (['421', '450', '451', '452'].includes(code)) {
            // Temporary failure or greylisting: treat as risky but valid to avoid false blockages
            handleResolve({
              valid: true,
              status: 'risky',
              details: `Mailbox is temporarily unreachable (greylisting or rate-limiting). SMTP response: ${lastLine}`,
            });
          } else {
            handleResolve({
              valid: true,
              status: 'risky',
              details: `SMTP server returned unexpected code ${code}: ${lastLine}`,
            });
          }
        }
      } catch (err: any) {
        handleResolve({
          valid: false,
          status: 'connection_error',
          error: `Error processing SMTP response: ${err.message}`,
        });
      }
    });

    socket.on('error', (err: any) => {
      // Detect outgoing Port 25 blockages (common in Vercel/cloud environments)
      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH') {
        verifyWithQuickEmailVerification(email).then(handleResolve);
      } else {
        handleResolve({
          valid: false,
          status: 'connection_error',
          error: `SMTP connection error to mail server: ${err.message}`,
        });
      }
    });

    socket.on('timeout', () => {
      // Fallback for timeout (likely due to port 25 block)
      verifyWithQuickEmailVerification(email).then(handleResolve);
    });
  });
}

/**
 * Fallback validator that calls the QuickEmailVerification API when port 25 is blocked.
 */
async function verifyWithQuickEmailVerification(email: string): Promise<EmailValidationResult> {
  const apiKey = process.env.QUICK_EMAIL_VERIFICATION_API_KEY;
  if (!apiKey) {
    return {
      valid: true,
      status: 'mx_valid',
      details: 'SMTP handshake timed out / Port 25 block detected. Domain exists and has valid MX records, but SMTP mailbox validation was skipped (API key not configured).',
    };
  }

  try {
    const url = `https://api.quickemailverification.com/v1/verify?email=${encodeURIComponent(email)}&apikey=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`QuickEmailVerification API returned HTTP ${response.status}: ${errText}`);
      return {
        valid: true,
        status: 'mx_valid',
        details: `QuickEmailVerification API error (HTTP ${response.status}). Domain exists and has valid MX records.`,
      };
    }

    const data = await response.json();
    
    if (data.success === 'false' || data.success === false) {
      return {
        valid: true,
        status: 'mx_valid',
        details: `QuickEmailVerification API reports failure: ${data.message || 'unknown error'}. Domain exists and has valid MX records.`,
      };
    }

    const isValid = data.result === 'valid';
    const isInvalid = data.result === 'invalid';
    const isRisky = data.result === 'unknown' || data.safe_to_send === 'false' || data.safe_to_send === false;

    if (isValid) {
      if (isRisky) {
        return {
          valid: true,
          status: 'risky',
          details: `Email domain is valid but mailbox is marked as risky (reason: ${data.reason || 'unknown'}).`,
        };
      }
      return {
        valid: true,
        status: 'deliverable',
        details: `Mailbox verified and reachable via QuickEmailVerification API.`,
      };
    } else if (isInvalid) {
      return {
        valid: false,
        status: 'undeliverable',
        error: `Mailbox is undeliverable/bounces (reason: ${data.reason || 'rejected'}).`,
      };
    } else {
      return {
        valid: true,
        status: 'risky',
        details: `Mailbox validity is unknown (reason: ${data.reason || 'unspecified'}).`,
      };
    }
  } catch (err: any) {
    console.error('Error calling QuickEmailVerification API:', err);
    return {
      valid: true,
      status: 'mx_valid',
      details: `QuickEmailVerification API request failed: ${err.message}. Domain exists and has valid MX records.`,
    };
  }
}

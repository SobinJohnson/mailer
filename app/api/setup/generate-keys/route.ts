import { NextResponse } from 'next/server';
import crypto from 'crypto';

// The base64url encoding function
function base64url(source: Buffer | string) {
  let encodedSource = Buffer.isBuffer(source) ? source.toString('base64') : Buffer.from(source).toString('base64');
  encodedSource = encodedSource.replace(/=+$/, '');
  encodedSource = encodedSource.replace(/\+/g, '-');
  encodedSource = encodedSource.replace(/\//g, '_');
  return encodedSource;
}

// Function to generate a JWT token
function generateJWT(role: string, secret: string) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // Expiration set to roughly 10 years for long-lived API keys
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10;

  const payload = {
    iss: 'supabase',
    role: role,
    exp: exp,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest();
    
  const encodedSignature = base64url(signature);

  return `${signatureInput}.${encodedSignature}`;
}

export async function POST() {
  try {
    // Generate a random 32-character secret for the JWT_SECRET
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    
    const anonKey = generateJWT('anon', jwtSecret);
    const serviceRoleKey = generateJWT('service_role', jwtSecret);

    return NextResponse.json({
      jwtSecret,
      anonKey,
      serviceRoleKey,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const crypto = require('crypto');

// The base64url encoding function
function base64url(source) {
  let encodedSource = Buffer.from(source).toString('base64');
  encodedSource = encodedSource.replace(/=+$/, '');
  encodedSource = encodedSource.replace(/\+/g, '-');
  encodedSource = encodedSource.replace(/\//g, '_');
  return encodedSource;
}

// Generate a random 32-character secret for the JWT_SECRET
const jwtSecret = crypto.randomBytes(32).toString('hex');

// Function to generate a JWT token
function generateJWT(role, secret) {
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

const anonKey = generateJWT('anon', jwtSecret);
const serviceRoleKey = generateJWT('service_role', jwtSecret);

console.log('\n======================================================');
console.log('🔒 MAILER CRM: SECURE KEY GENERATOR');
console.log('======================================================\n');
console.log('Copy these values into your docker/.env file:\n');
console.log(`JWT_SECRET=${jwtSecret}\n`);
console.log(`ANON_KEY=${anonKey}\n`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}\n`);
console.log('======================================================\n');

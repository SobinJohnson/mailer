import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCleanErrorMessage(errorMsg: string): string {
  if (!errorMsg) return 'Failed to connect or send mail';
  
  const lowerMsg = errorMsg.toLowerCase();
  
  if (lowerMsg.includes('535') || lowerMsg.includes('authentication failed') || lowerMsg.includes('invalid login')) {
    return 'Authentication failed: Incorrect username or password. Please verify your email credentials. If you are using Gmail, Hostinger, or Outlook, you may need to generate and use an App Password.';
  }
  
  if (lowerMsg.includes('enotfound') || lowerMsg.includes('getaddrinfo')) {
    return 'Server not found: Could not resolve the SMTP host address. Please verify that the SMTP host is typed correctly.';
  }
  
  if (lowerMsg.includes('etimedout') || lowerMsg.includes('connection timeout') || lowerMsg.includes('timeout')) {
    return 'Connection timed out: The SMTP server did not respond. Check your host, port, and security settings, or ensure your network is not blocking outgoing SMTP connections.';
  }
  
  if (lowerMsg.includes('econnrefused')) {
    return 'Connection refused: The SMTP server actively refused the connection. Please verify that the host and port are correct.';
  }

  if (lowerMsg.includes('self-signed certificate') || lowerMsg.includes('depth zero self signed')) {
    return 'SSL/TLS Error: Self-signed certificate in chain. Your SMTP server is using a self-signed SSL certificate.';
  }
  
  // Remove confusing trailing "(reason unavailable)" if it exists
  return errorMsg.replace(/\(reason unavailable\)/gi, '').trim();
}

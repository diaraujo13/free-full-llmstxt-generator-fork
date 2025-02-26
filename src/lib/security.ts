import { SafeParseReturnType, z } from 'zod';

const urlSchema = z.string()
  .url()
  .transform((url) => new URL(url))
  .refine(
    (url) => ['http:', 'https:'].includes(url.protocol),
    { message: 'Only HTTP and HTTPS protocols are allowed' }
  )
  .refine(
    (url) => {
      const hostname = url.hostname.toLowerCase();

      // Check for local/private addresses
      const isLocal =
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^(::1$|fc00:|fe80:)/);

      // Check for potentially dangerous ports
      const dangerousPorts = [21, 22, 23, 25, 135, 137, 138, 139, 445, 3389];
      const hasRiskyPort = url.port && dangerousPorts.includes(parseInt(url.port, 10));

      return !(isLocal || hasRiskyPort);
    },
    { message: 'Local, private IPs, or dangerous ports are not allowed' }
  )
  .transform((url) => {
    // Remove fragment
    url.hash = '';

    // Remove potentially sensitive query parameters
    [
      'api_key', 'token', 'key', 'password', 'secret', 'auth',
      'jwt', 'access_token', 'refresh_token', 'client_secret'
    ].forEach(param => url.searchParams.delete(param));

    return url.toString();
  });

export function validateAndSanitizeUrl(input: string): SafeParseReturnType<string, string> {
  return urlSchema.safeParse(input);
}


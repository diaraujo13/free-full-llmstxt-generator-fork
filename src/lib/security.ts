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
      return !(
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^(::1$|fc00:|fe80:)/)
      );
    },
    { message: 'Local and private IPs are not allowed' }
  )
  .transform((url) => {
    url.hash = '';
    ['api_key', 'token', 'key', 'password', 'secret']
      .forEach(param => url.searchParams.delete(param));
    return url.toString();
  });

export function validateAndSanitizeUrl(input: string): SafeParseReturnType<string, string> {
  return urlSchema.safeParse(input);
}


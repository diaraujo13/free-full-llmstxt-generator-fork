export function validateAndSanitizeUrl(input: string): string {
  try {
    const url = new URL(input);

    // Whitelist allowed protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid URL protocol');
    }

    // Block localhost and private IPs
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.match(/^(::1$|fc00:|fe80:)/)
    ) {
      throw new Error('Local and private IPs are not allowed');
    }

    // Remove fragments and sensitive parameters
    url.hash = '';
    const sensitiveParams = ['api_key', 'token', 'key', 'password', 'secret'];
    sensitiveParams.forEach(param => url.searchParams.delete(param));

    return url.toString();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    throw new Error('Invalid URL');
  }
}


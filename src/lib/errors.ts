export type ErrorCode =
  | 'INVALID_URL'
  | 'FETCH_ERROR'
  | 'PARSE_ERROR'
  | 'AI_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR';

export class LLMTXTError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public status?: number
  ) {
    super(message);
    this.name = 'LLMTXTError';
  }
}

export function handleError(error: unknown): LLMTXTError {
  // Handle known LLMTXTError instances
  if (error instanceof LLMTXTError) {
    return error;
  }

  // Handle network-related errors
  if (error instanceof TypeError) {
    return new LLMTXTError(
      'Failed to fetch webpage. Please check your internet connection and try again.',
      'NETWORK_ERROR'
    );
  }

  // Handle URL validation errors
  if (error instanceof URIError) {
    return new LLMTXTError(
      'Invalid URL format. Please enter a valid webpage URL.',
      'INVALID_URL'
    );
  }

  // Handle fetch response errors
  if (error instanceof Response) {
    return new LLMTXTError(
      `Failed to fetch webpage: ${error.statusText}`,
      'FETCH_ERROR',
      error.status
    );
  }

  // Default error case
  return new LLMTXTError(
    'An unexpected error occurred. Please try again.',
    'PARSE_ERROR'
  );
}
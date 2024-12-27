export class LLMTXTError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_URL' | 'FETCH_ERROR' | 'PARSE_ERROR' | 'AI_ERROR',
    public status?: number
  ) {
    super(message);
    this.name = 'LLMTXTError';
  }
}

export function handleError(error: unknown): LLMTXTError {
  if (error instanceof LLMTXTError) {
    return error;
  }

  if (error instanceof TypeError) {
    return new LLMTXTError(
      'Failed to fetch webpage. Please check the URL and try again.',
      'FETCH_ERROR'
    );
  }

  return new LLMTXTError(
    'An unexpected error occurred. Please try again.',
    'PARSE_ERROR'
  );
}
export {};

declare global {
  interface Error {
    code?: string;
    correlationId?: string;
    retryable?: boolean;
    status?: number | null;
    context?: Response | null;
    validationErrors?: Array<{ field: string; message: string }>;
    resumeUpload?: {
      intentId: string;
      tourId: string | null;
      path: string;
      uploadToken: string;
      expiresAt: string;
      idempotencyKey: string;
      peekKind: 'response';
    };
  }

  interface Navigator {
    standalone?: boolean;
  }
}

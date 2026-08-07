export {};

declare global {
  interface Error {
    code?: string;
    correlationId?: string;
    retryable?: boolean;
    status?: number | null;
    context?: Response | null;
    /**
     * Set by saveOwnerBusinessProfile() when the profile row was written but the
     * logo could not be attached, so the caller knows to refetch rather than
     * treat the whole save as failed.
     * src/services/businessProfilesService.js:100-103
     */
    profileSaved?: boolean;
    validationErrors?: Array<{ field: string; message: string }>;
    resumeUpload?: {
      intentId: string;
      tourId?: string | null;
      path: string;
      uploadToken: string;
      expiresAt: string | null;
      idempotencyKey: string;
      peekKind?: 'response';
    };
  }

  interface Navigator {
    standalone?: boolean;
  }
}

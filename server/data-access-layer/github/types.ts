/** Standard error response (legacy pattern). Use GitHubResult<T> for new DAL functions. */
export type GitHubErrorResponse = {
  error: string;
};

/**
 * Machine-readable codes for GitHub API errors.
 * Used in GitHubResult<T> to let the AI agent programmatically distinguish error types
 * and surface actionable guidance to the user.
 */
export enum GitHubErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** Structured error carrying a machine-readable code and optional rate-limit reset time. */
export type GitHubError = {
  code: GitHubErrorCode;
  message: string;
  /** Unix timestamp (ms) when the rate limit resets. Only present for RATE_LIMITED errors. */
  resetAt?: number;
};

/**
 * Discriminated union result type for GitHub DAL functions.
 *
 * Prefer this over the legacy `T | GitHubErrorResponse` pattern for new code.
 * TypeScript narrows the type on the `success` discriminant:
 *
 * ```ts
 * const result = await getGitHubUserOrgs({ accessToken });
 * if (result.success) {
 *   result.data; // T
 * } else {
 *   result.error.code; // GitHubErrorCode
 * }
 * ```
 */
export type GitHubResult<T> =
  | { success: true; data: T }
  | { success: false; error: GitHubError };

/** Constructs a successful GitHubResult. */
export function ok<T>(data: T): GitHubResult<T> {
  return { success: true, data };
}

/** Constructs a failed GitHubResult. */
export function fail(
  code: GitHubErrorCode,
  message: string,
  options?: { resetAt?: number },
): { success: false; error: GitHubError } {
  return {
    success: false,
    error: {
      code,
      message,
      ...(options?.resetAt !== undefined ? { resetAt: options.resetAt } : {}),
    },
  };
}

/**
 * Maps an HTTP status code to a GitHubErrorCode.
 * Used in DAL catch blocks to convert Octokit RequestErrors to structured results.
 */
export function mapStatusToErrorCode(status: number): GitHubErrorCode {
  switch (status) {
    case 401:
      return GitHubErrorCode.TOKEN_EXPIRED;
    case 403:
      return GitHubErrorCode.FORBIDDEN;
    case 404:
      return GitHubErrorCode.NOT_FOUND;
    case 422:
      return GitHubErrorCode.VALIDATION_ERROR;
    case 429:
      return GitHubErrorCode.RATE_LIMITED;
    default:
      return GitHubErrorCode.INTERNAL_ERROR;
  }
}

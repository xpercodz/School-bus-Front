/**
 * Client-side mirror of the HTTP contract.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOURCE OF TRUTH: `School-bus-API/src/contract.ts`.
 *
 * The two repos are independent, so nothing enforces this at build time — it is
 * hand-kept in sync. When you change a path, a request/response shape, or an
 * error code there, change it here in the same sitting. (If the contract
 * outgrows a handful of endpoints, publish the backend module as a private
 * package instead of mirroring it — see README "Contract drift".)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Canonical paths, so no component hand-writes a URL string. */
export const API_ROUTES = {
  health: "/health",
  directorSignIn: "/v1/auth/director-sign-in",
  verifyCode: "/v1/auth/verify-code",
  createDriver: "/v1/drivers",
  regenerateDriverCode: "/v1/drivers/regenerate",
} as const;

/** Every `{ error }` code the API can return. */
export const API_ERROR_CODES = [
  "invalid_request",
  "invalid_credentials",
  "invalid_code",
  "not_director",
  "too_many_attempts",
  "rate_limited",
  "invalid_name",
  "invalid_uid",
  "missing_token",
  "invalid_token",
  "forbidden",
  "not_found",
  "server_error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiError {
  error: ApiErrorCode;
}

// ── Request / response bodies ────────────────────────────────────────────────

export interface DirectorSignInRequest {
  email: string;
  password: string;
}
export interface DirectorSignInResponse {
  token: string;
}

export interface VerifyCodeRequest {
  code: string;
}
export interface VerifyCodeResponse {
  token: string;
}

export interface CreateDriverRequest {
  name: string;
}
export interface CreateDriverResponse {
  uid: string;
  code: string;
}

export interface RegenerateDriverCodeRequest {
  uid: string;
}
export interface RegenerateDriverCodeResponse {
  code: string;
}

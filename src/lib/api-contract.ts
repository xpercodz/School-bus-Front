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
  createOperator: "/v1/operators",
  updateOperatorScreens: "/v1/operators/screens",
  updateOperatorPassword: "/v1/operators/password",
  removeOperator: "/v1/operators/remove",
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
  "email_in_use",
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

// ── Operators ────────────────────────────────────────────────────────────────
//
// An operator is office staff below the director: email + password sign-in, and
// only the screens listed on their profile. This tuple is mirrored from
// `School-bus-API/src/contract.ts` and must stay in step with the screen names
// used by `firestore.rules` and by `src/lib/permissions.ts`.
export const OPERATOR_SCREENS = [
  "live",
  "students",
  "reports",
  "assignments",
  "drivers",
] as const;

export type OperatorScreen = (typeof OPERATOR_SCREENS)[number];

/**
 * The password bar. `src/lib/password.ts` holds the client's full checklist; the
 * API enforces this length (and nothing else), so a value that turns every
 * client check green is always accepted.
 */
export const OPERATOR_PASSWORD_MIN_LENGTH = 12;

export interface CreateOperatorRequest {
  email: string;
  password: string;
  displayName: string;
  screens: OperatorScreen[];
}
export interface CreateOperatorResponse {
  uid: string;
}

export interface UpdateOperatorScreensRequest {
  uid: string;
  screens: OperatorScreen[];
}

export interface UpdateOperatorPasswordRequest {
  uid: string;
  password: string;
}

export interface RemoveOperatorRequest {
  uid: string;
}

/** Both operator mutations answer with this. */
export interface OperatorMutationResponse {
  ok: true;
}

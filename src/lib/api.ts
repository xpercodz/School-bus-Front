/**
 * The one place the browser talks to the School-bus-API server.
 *
 * Every privileged operation (sign-in, driver create/rotate) goes through here;
 * everything realtime and offline (roster reads, attendance writes) keeps going
 * straight to Firestore via the client SDK — see `lib/school-data.ts`.
 *
 * The API lives at a different origin than this app, so `VITE_API_URL` must be
 * set and the API's `APP_ORIGINS` must list this app's origin.
 */
import {
  API_ROUTES,
  type ApiErrorCode,
  type CreateDriverResponse,
  type DirectorSignInResponse,
  type RegenerateDriverCodeResponse,
  type VerifyCodeResponse,
} from "@/lib/api-contract";
import { auth } from "@/lib/firebase";

/** Base URL of the API, without a trailing slash. */
const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

/** Codes this client synthesizes when a request never reached the API. */
export type ClientErrorCode =
  | "network_error"
  | "not_signed_in"
  | "not_configured";

/**
 * A failed API call: either a non-2xx response (`status` + the API's error
 * code) or a transport failure (`status` 0 + a `ClientErrorCode`).
 *
 * Callers branch on `status` (as the login page does for 403 / 429) or `code`.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode | ClientErrorCode,
  ) {
    super(`${code}:${status}`);
    this.name = "ApiError";
  }
}

/** Bearer header for the signed-in user; throws if there is no session. */
async function authHeader(): Promise<Record<string, string>> {
  const current = auth?.currentUser;
  if (!current) throw new ApiError(401, "not_signed_in");
  return { Authorization: `Bearer ${await current.getIdToken()}` };
}

interface PostOptions {
  /** Attach the Firebase ID token as a Bearer credential. */
  authenticated?: boolean;
}

async function post<T>(
  path: string,
  body: unknown,
  { authenticated = false }: PostOptions = {},
): Promise<T> {
  if (!API_URL) throw new ApiError(0, "not_configured");

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? await authHeader() : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Offline, DNS failure, CORS rejection — all indistinguishable to fetch.
    throw new ApiError(0, "network_error");
  }

  if (!response.ok) {
    // The API always answers `{ error }`; fall back defensively if a proxy
    // rewrote the body so callers still get a valid code to branch on.
    const payload = (await response.json().catch(() => null)) as
      | { error?: ApiErrorCode }
      | null;
    throw new ApiError(response.status, payload?.error ?? "server_error");
  }

  return (await response.json()) as T;
}

/**
 * POST /v1/auth/verify-code — exchange a driver access code for a Firebase
 * custom token. Throws `ApiError` for a wrong, locked, or rate-limited code.
 */
export async function verifyDriverCode(code: string): Promise<string> {
  const { token } = await post<VerifyCodeResponse>(API_ROUTES.verifyCode, {
    code,
  });
  return token;
}

/**
 * POST /v1/auth/director-sign-in — exchange director credentials for a Firebase
 * custom token. The server rejects non-director accounts with 403, so callers
 * can show a specific message instead of a generic failure.
 */
export async function directorSignIn(
  email: string,
  password: string,
): Promise<string> {
  const { token } = await post<DirectorSignInResponse>(
    API_ROUTES.directorSignIn,
    { email, password },
  );
  return token;
}

/** POST /v1/drivers — create a driver account (director only). */
export function createDriver(name: string): Promise<CreateDriverResponse> {
  return post<CreateDriverResponse>(
    API_ROUTES.createDriver,
    { name },
    { authenticated: true },
  );
}

/** POST /v1/drivers/regenerate — rotate a driver's code (director only). */
export async function regenerateDriverCode(uid: string): Promise<string> {
  const { code } = await post<RegenerateDriverCodeResponse>(
    API_ROUTES.regenerateDriverCode,
    { uid },
    { authenticated: true },
  );
  return code;
}

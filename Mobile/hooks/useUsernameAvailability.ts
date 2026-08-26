/**
 * Realtime username availability check.
 *
 * Debounces the input by 350 ms then asks the backend whether the
 * normalised handle is free. The hook short-circuits when the value is
 * obviously invalid (length / regex) or unchanged from the user's own
 * current handle so we don't burn rate-limit tokens on noise.
 *
 * Stability note:
 *  Clerk's `getToken` returned from `useAuth()` is not guaranteed to
 *  keep the same reference across renders. That made the previous
 *  version of `useApiClient` produce a fresh axios instance each render,
 *  and any hook that listed it in a `useEffect` dependency array would
 *  fire its effect on every render. When that effect calls `setState`,
 *  the result is a render loop ("Maximum update depth exceeded").
 *
 *  We pin the api in a ref and depend only on the *content* of the
 *  inputs (`candidate`, `ownUsername`). Network calls inside the
 *  timeout always read the latest api via the ref.
 */
import { useEffect, useRef, useState } from "react";

import { useApiClient, userApi } from "@/utils/api";

export type AvailabilityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; message?: string }
  | { status: "taken"; message?: string }
  | { status: "invalid"; message: string };

const VALID_RX = /^[a-zA-Z0-9_]+$/;

function localValidate(raw: string): { ok: true } | { ok: false; reason: string } {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, reason: "Pick a username." };
  if (value.length < 3 || value.length > 30) {
    return { ok: false, reason: "Use 3 to 30 characters." };
  }
  if (!VALID_RX.test(value)) {
    return { ok: false, reason: "Letters, numbers, and underscores only." };
  }
  return { ok: true };
}

export const useUsernameAvailability = (
  candidate: string,
  ownUsername?: string | null
): AvailabilityState => {
  const api = useApiClient();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [state, setState] = useState<AvailabilityState>({ status: "idle" });

  useEffect(() => {
    const trimmed = candidate.trim().toLowerCase();
    const localResult = localValidate(trimmed);

    if (!localResult.ok) {
      setState({ status: "invalid", message: localResult.reason });
      return;
    }

    if (ownUsername && trimmed === ownUsername.toLowerCase()) {
      setState({ status: "available", message: "That's your handle" });
      return;
    }

    setState({ status: "checking" });

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await userApi.checkUsernameAvailability(apiRef.current, trimmed);
        if (cancelled) return;
        if (response.data.available) {
          setState({ status: "available", message: response.data.message });
        } else {
          setState({ status: "taken", message: response.data.message });
        }
      } catch {
        if (cancelled) return;
        // Network failure — don't block the user from saving. Treat as
        // tentatively available; the server-side validator will catch a
        // true collision on submit.
        setState({ status: "available", message: "Couldn't verify — try saving" });
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Intentionally NOT depending on `api` — see stability note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate, ownUsername]);

  return state;
};

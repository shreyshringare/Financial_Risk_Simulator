const SESSION_KEY = "finsim_session_id";

/**
 * Returns a stable session ID for this browser tab.
 * Generated once per session via crypto.randomUUID(), persisted in sessionStorage.
 * Cleared when the tab is closed (sessionStorage lifetime).
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

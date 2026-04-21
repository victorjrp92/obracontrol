/**
 * Minimal HTML escape for interpolating untrusted user data into email HTML.
 * Prevents HTML/phishing injection via names, project names, messages, etc.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (value) => EMAIL_RE.test(value.trim());

export const isStrongPassword = (value) =>
  value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

/** Returns 0 (empty) to 3 (strong). */
export function passwordStrength(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score++;
  if (value.length >= 12 || /[^A-Za-z0-9]/.test(value)) score++;
  return Math.max(1, score);
}

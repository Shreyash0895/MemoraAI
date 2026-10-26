/* Auth calls to the MemoraAI API (users are stored in SQLite on the server). */
import { request } from "./api.js";

export const DEMO = { email: "caregiver@memoraai.demo", password: "Memora@123" };

export const authService = {
  signIn: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }).then((d) => d.user),
  register: (form) => request("/auth/register", { method: "POST", body: form }).then((d) => d.user),
  resetPassword: (email) => request("/auth/reset-password", { method: "POST", body: { email } }),
  me: () => request("/auth/me").then((d) => d.user),
  signOut: () => request("/auth/logout", { method: "POST" }),
};

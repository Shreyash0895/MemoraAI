import { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  useEffect(() => {
    authService.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const value = {
    user,
    loading,
    async login(email, password) {
      const u = await authService.signIn(email, password);
      setUser(u);
      return u;
    },
    async register(data) {
      const u = await authService.register(data);
      setUser(u);
      return u;
    },
    resetPassword: (email) => authService.resetPassword(email),
    async logout() {
      try { await authService.signOut(); } catch { /* cookie expires anyway */ }
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

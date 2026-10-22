import { createContext, useContext, useState } from "react";
import { authService } from "../services/authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const value = {
    user,
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
    logout: () => setUser(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

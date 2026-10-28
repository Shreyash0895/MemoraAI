import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot" role="status" aria-label="Loading"><span className="spin" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

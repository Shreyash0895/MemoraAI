import { useNavigate } from "react-router-dom";
import Button from "../components/Button.jsx";
import { CheckIcon } from "../components/Icons.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/* Placeholder. The full caregiver dashboard is built in Phase 2. */
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="formpane" style={{ minHeight: "100vh" }}>
      <div className="card">
        <div className="ok"><CheckIcon /></div>
        <h2>You’re signed in</h2>
        <p className="lede">Welcome, {user.name}. The caregiver dashboard opens here in the next phase.</p>
        <Button variant="ghost" onClick={() => { logout(); navigate("/login"); }}>Sign out</Button>
      </div>
    </main>
  );
}

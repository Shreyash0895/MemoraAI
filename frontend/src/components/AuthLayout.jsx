import { Outlet } from "react-router-dom";
import BrandPanel from "./BrandPanel.jsx";

export default function AuthLayout() {
  return (
    <div className="shell">
      <BrandPanel />
      <main className="formpane">
        <div className="card"><Outlet /></div>
      </main>
    </div>
  );
}

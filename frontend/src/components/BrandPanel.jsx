import { PinIcon, UserIcon, PillIcon } from "./Icons.jsx";

export default function BrandPanel() {
  return (
    <aside className="brandpane">
      <div className="logo">
        <span className="mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19V6l8 8 8-8v13" />
          </svg>
        </span>
        <span>Memora<b>AI</b></span>
      </div>

      <div className="hero">
        <h1>When memory fades, guidance remains.</h1>
        <p>See where your loved one is, who they’ve met today, and whether their routine is on track, all in one place.</p>
      </div>

      <div className="live">
        <h2><span className="dot" />Today at a glance</h2>
        <div className="row"><PinIcon /><div><strong>At home</strong><span>Inside the safe zone since 8:10 am</span></div></div>
        <div className="row"><UserIcon /><div><strong>Recognized Arjun (son)</strong><span>Badge said “This is your son” at 9:42 am</span></div></div>
        <div className="row"><PillIcon /><div><strong>Morning medicine taken</strong><span>Next reminder at 2:00 pm</span></div></div>
        <small>Sample data for preview</small>
      </div>
    </aside>
  );
}

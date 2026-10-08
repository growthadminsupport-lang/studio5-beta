import { NavLink } from "react-router-dom";
import { LayoutGrid, LineChart, Flag, ScanLine, BookOpen, Home, Info, Mail } from "lucide-react";
import "./BottomNav.css";

const tab = ({ isActive }) => (isActive ? "active" : "");

/**
 * The tab bar on phones and tablets. Signed out, the top bar has room only for the logo and
 * "Login / Sign Up" below 768px, so the public pages get their own tabs there; without them a
 * visitor on a phone could not reach About, Resources or Contact.
 */
export default function BottomNav({ signedOut = false }) {
  if (signedOut) {
    return (
      <nav className="bottom-nav bottom-nav--public" aria-label="Main">
        <NavLink to="/" end className={tab}>
          <Home size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/about" className={tab}>
          <Info size={20} />
          <span>About</span>
        </NavLink>
        <NavLink to="/knowledge" className={tab}>
          <BookOpen size={20} />
          <span>Resources</span>
        </NavLink>
        <NavLink to="/contact" className={tab}>
          <Mail size={20} />
          <span>Contact</span>
        </NavLink>
      </nav>
    );
  }
  return (
    <nav className="bottom-nav lg:hidden" aria-label="Main">
      <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
        <LayoutGrid size={20} />
        <span>Dashboard</span>
      </NavLink>

      <NavLink to="/growth" className={({ isActive }) => (isActive ? "active" : "")}>
        <LineChart size={20} />
        <span>Growth</span>
      </NavLink>

      <NavLink to="/puberty" className={({ isActive }) => (isActive ? "active" : "")}>
        <Flag size={20} />
        <span>Puberty</span>
      </NavLink>

      <NavLink to="/bone-age" className={({ isActive }) => (isActive ? "active" : "")}>
        <ScanLine size={20} />
        <span>AI Prediction</span>
      </NavLink>

      <NavLink to="/knowledge" className={({ isActive }) => (isActive ? "active" : "")}>
        <BookOpen size={20} />
        <span>Resources</span>
      </NavLink>
    </nav>
  );
}
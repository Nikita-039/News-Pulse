/** Navbar with brand logo, title, and action slot. */
export default function Navbar({ children }) {
  return (
    <nav className="navbar" role="banner">
      <div className="navbar__brand">
        <div className="navbar__logo" aria-hidden="true">📡</div>
        <div>
          <div className="navbar__title gradient-text">News Pulse</div>
          <div className="navbar__subtitle">Topic-Clustered News Timeline</div>
        </div>
      </div>
      <div className="navbar__actions">{children}</div>
    </nav>
  );
}

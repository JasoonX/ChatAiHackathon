"use client";

import { useState, useEffect, useRef } from "react";
import "./landing.css";

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------
type IconName =
  | "arrow" | "spark" | "bolt" | "chip" | "brain" | "eye" | "wave"
  | "code" | "clock" | "users" | "trophy" | "globe" | "plus" | "play"
  | "calendar" | "mic" | "layers" | "github";

function Icon({ name, size = 16, stroke = 1.5 }: { name: IconName; size?: number; stroke?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
    spark: <><path d="M12 3v18M3 12h18" /></>,
    bolt: <><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></>,
    chip: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 9h6v6H9z" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /></>,
    brain: <><path d="M12 5a3 3 0 1 0-5.99.14 4 4 0 0 0-1.51 7.06 3 3 0 0 0 2.5 5.5 3 3 0 0 0 5 1A3 3 0 0 0 12 21" /><path d="M12 5a3 3 0 1 1 5.99.14 4 4 0 0 1 1.51 7.06 3 3 0 0 1-2.5 5.5 3 3 0 0 1-5 1A3 3 0 0 1 12 21" /></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    wave: <><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 2 0 2 0" /></>,
    code: <><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>,
    globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    play: <><polygon points="6 3 20 12 6 21 6 3" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10a7 7 0 0 1-14 0" /><path d="M12 19v3" /></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
    github: <><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.4 9 18v4" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] ?? null}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Reveal
// ---------------------------------------------------------------------------
function Reveal({
  children,
  delay = 0,
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -80px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const delayClass = delay ? ` reveal-delay-${delay}` : "";
  return (
    <div ref={ref} className={`reveal${delayClass} ${className}`} style={style}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BeamAvatar
// ---------------------------------------------------------------------------
function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}
const AVATAR_COLORS = ["#C0634A", "#6B5B93", "#2D7DD2", "#52B788", "#E09B3D"];

function BeamAvatar({ name, size = 32, round = false }: { name: string; size?: number; round?: boolean }) {
  const color = AVATAR_COLORS[Math.abs(hashCode(name)) % AVATAR_COLORS.length];
  const h = Math.abs(hashCode(name));
  const faceY = 13 + (h % 3);
  const eyeSpread = 3 + (h % 2);
  const radius = round ? "50%" : 6;
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32"
      style={{ borderRadius: radius, flexShrink: 0 }}
    >
      <rect width="32" height="32" fill={color} rx={size < 24 ? 16 : 8} />
      <rect x={16 - eyeSpread - 2} y={faceY} width="3" height="3" rx="1" fill="rgba(0,0,0,0.6)" />
      <rect x={16 + eyeSpread - 1} y={faceY} width="3" height="3" rx="1" fill="rgba(0,0,0,0.6)" />
      <rect x="13" y={faceY + 6} width="6" height="2" rx="1" fill="rgba(0,0,0,0.4)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="container nav-inner">
        <a href="#" className="brand">
          <ChattyLogo size={20} />
          <span>chatty</span>
        </a>
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#product">Product</a>
          <a href="#demo">Demo</a>
          <a href="#federation">Federation</a>
          <a href="#install">Install</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="nav-cta">
          <a href="/login" className="btn btn-ghost">
            Sign in
          </a>
          <a href="/register" className="btn btn-primary">
            Register <Icon name="arrow" size={14} />
          </a>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
type HeroCopy = { h1a: string; h1b: string; sub: string };

function Hero({ heroCopy }: { heroCopy: HeroCopy }) {
  return (
    <section className="hero">
      <div className="hero-bg" />
      <div className="hero-scrim" />
      <div className="hero-grain" />
      <div className="hero-content">
        <div className="hero-eyebrow reveal in">
          <span className="hero-eyebrow-tag">v1.0</span>
          <span>Self-hosted · No external services · Docker compose up</span>
        </div>
        <h1 className="reveal in reveal-delay-1">
          {heroCopy.h1a}
          <br />
          <span className="accent">{heroCopy.h1b}</span>
        </h1>
        <p className="hero-sub reveal in reveal-delay-2">{heroCopy.sub}</p>
        <div className="hero-ctas reveal in reveal-delay-3">
          <a href="/register" className="btn btn-primary">
            Try it now <Icon name="arrow" size={14} />
          </a>
          <a href="#demo" className="btn btn-secondary">
            <Icon name="play" size={14} /> Watch demo
          </a>
        </div>
        <div className="hero-sig reveal in reveal-delay-4">
          <span className="hero-sig-item"><span className="hero-sig-dot" style={{ background: "#5fd4a5" }} /> Self-hosted</span>
          <span className="hero-sig-item"><span className="hero-sig-dot" style={{ background: "#a8c0ff" }} /> XMPP federated</span>
          <span className="hero-sig-item"><span className="hero-sig-dot" style={{ background: "#f0c475" }} /> Zero telemetry</span>
          <span className="hero-sig-item"><span className="hero-sig-dot" style={{ background: "#c6b4ff" }} /> MIT licensed</span>
        </div>
      </div>
      <div className="scroll-hint">
        <span>Scroll</span>
        <div className="scroll-hint-line" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function Stats() {
  const items = [
    { n: "10,000", l: "Messages per room, infinite scroll tested", unit: "+" },
    { n: "100",    l: "Concurrent federated bots, zero errors",    unit: "" },
    { n: "1",      l: "Command to run the entire stack",           unit: "" },
  ];
  return (
    <section className="stats">
      <div className="stats-grid container">
        <Reveal className="stats-lead">
          <div className="eyebrow-label" style={{ marginBottom: 12 }}>The product</div>
          <p style={{ color: "var(--color-text)", fontSize: 16, lineHeight: 1.5 }}>
            Real-time chat that lives on your hardware. No SaaS account,
            no telemetry, no outbound calls. Just Postgres, Prosody, and
            a Next.js app in a single compose file.
          </p>
        </Reveal>
        {items.map((it, i) => (
          <Reveal key={it.l} delay={i + 1}>
            <div className="stat-num">
              {it.n}
              {it.unit && <span className="unit">{it.unit}</span>}
            </div>
            <div className="stat-label">{it.l}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Logo Icon (matches real LogoIcon component)
// ---------------------------------------------------------------------------
function ChattyLogo({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 598 615" fill="none" xmlns="http://www.w3.org/2000/svg"
      width={size} height={size} style={{ flexShrink: 0 }} aria-hidden="true">
      <g clipPath="url(#ll-clip)">
        <path d="M13.4598 98.2874C16.6653 73.4979 33.1358 45.3894 53.0543 30.1294C68.8363 18.2649 87.3448 10.5534 106.882 7.70093C117.419 6.18393 127.884 6.33744 138.505 6.27344L177.342 6.16943L312.798 6.34444L416.574 6.55994C431.066 6.38994 445.558 6.31293 460.05 6.32843C469.165 6.35343 478.15 6.11042 487.22 7.27592C516.365 11.0204 544.585 27.8479 562.405 51.0609C570.745 61.9204 580.1 82.2819 581.975 95.7239C585.105 118.169 583.625 145.611 583.61 168.542L583.385 305.947C585.9 308.887 583.97 310.177 583.855 314.027C583.75 317.587 583.855 323.692 583.855 327.297C583.505 342.802 583.74 358.377 583.705 373.887C583.7 376.227 584.155 386.932 583.235 388.397C583.015 400.722 582.79 410.022 579.365 422.067C567.06 465.332 528.885 498.772 482.995 502.037C477.285 503.147 467.44 502.912 461.405 502.917L432.354 502.927L321.16 502.952L262.324 502.992C258.852 502.992 240.037 503.197 237.514 502.642C228.567 509.517 223.272 516.017 215.246 523.767L167.842 570.077C159.402 578.472 150.446 588.417 140.713 595.127C130.958 601.852 120.248 595.182 117.695 584.457C116.893 577.637 116.93 569.982 117.05 563.077C117.394 543.237 116.463 522.962 117.282 503.182C98.0503 502.847 68.7813 491.232 54.2698 479.052C32.1108 460.452 17.1133 435.347 13.4788 406.677C12.6698 401.877 11.2718 402.222 11.2053 396.997C10.9303 375.232 11.0078 353.232 11.0168 331.477L11.0823 206.234L11.0798 140.399C11.0808 130.49 10.9703 120.462 11.2363 110.551C11.3468 106.433 12.7118 102.358 13.4598 98.2874Z" fill="#FE2B01" />
        <path d="M246.448 256.939C233.33 251.582 218.815 240.069 206.359 232.756C199.363 228.649 185.416 220.171 200.329 214.61C215.513 208.948 231.163 204.664 246.741 199.957L343.86 171.136L386.915 158.495C392.17 156.905 406.318 150.869 410.281 153.381C411.445 155.959 410.363 158.949 409.359 161.479C399.949 185.18 390.062 208.649 380.843 232.417C375.04 247.376 368.395 262.371 362.248 277.216C356.044 291.67 351.048 306.8 344.242 321.035C342.033 325.81 336.686 327.83 331.883 325.56C320.998 320.415 311.456 311.79 301.492 305.04C299.009 303.355 296.25 300.69 293.896 299.245C283.279 306.11 267.948 319.57 258.411 328.265C261.579 315.77 264.824 303.29 268.147 290.835C268.743 288.615 271.793 276.97 272.563 276.036C280.636 266.25 295.439 254.535 304.621 246.095C330.342 222.452 355.521 199.06 381.891 176.241L381.308 173.521C369.19 179.944 354.17 190.448 341.789 197.702C324.254 207.976 304.847 219.297 287.884 230.332L264.022 246.019C258.276 249.792 252.625 253.853 246.448 256.939Z" fill="#EBEBEB" />
      </g>
      <defs>
        <clipPath id="ll-clip"><rect width="598" height="615" fill="white" /></clipPath>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Product Section
// ---------------------------------------------------------------------------
type RoomId = "general" | "engineering" | "design";
type Message = { u: string; t: string; m: string; edited?: boolean; reply?: { u: string; m: string }; file?: { name: string; size: string } };

const MESSAGES_BY_ROOM: Record<RoomId, Message[]> = {
  general: [
    { u: "maya",  t: "09:14", m: "New Prosody config is deployed — federation to the Berlin instance is green." },
    { u: "devon", t: "09:15", m: "Confirmed from our side. 100 bots, zero dropped stanzas over 30 min." },
    { u: "lina",  t: "09:17", m: "Can I get presence in this thread? My AFK flipped weird between tabs.", reply: { u: "maya", m: "Sure — looking at the multi-tab reducer now." } },
    { u: "maya",  t: "09:19", m: "Looking at the multi-tab reducer now.", edited: true },
    { u: "devon", t: "09:22", m: "Dropping the load-test CSV here →", file: { name: "federation_run_03.csv", size: "812 KB" } },
  ],
  engineering: [
    { u: "kwesi", t: "11:02", m: "Soft-delete tombstones landed. Messages show \"[removed]\" without shifting indexes." },
    { u: "maya",  t: "11:04", m: "Nice. Also means infinite-scroll cursors stay stable. No jump." },
    { u: "kwesi", t: "11:06", m: "Next: room-membership checks on file reads. Revoke access → revoke downloads." },
  ],
  design: [
    { u: "noa",  t: "14:30", m: "Moderation dashboard mock is ready. Owner / admin / member rows with ban + remove." },
    { u: "lina", t: "14:32", m: "Love the tombstone treatment. Deleted messages feel honest, not gone." },
  ],
};

function SidebarChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "transform 150ms", transform: open ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ProductSection() {
  const publicRooms = [
    { id: "general" as RoomId,     name: "general" },
    { id: "engineering" as RoomId, name: "engineering" },
  ];
  const privateRooms = [
    { id: "design" as RoomId, name: "design" },
  ];
  const contacts = [
    { u: "maya",  status: "online" },
    { u: "devon", status: "online" },
    { u: "lina",  status: "afk" },
    { u: "noa",   status: "offline" },
  ];

  const [active, setActive] = useState<RoomId>("general");
  const [pubOpen, setPubOpen] = useState(true);
  const [privOpen, setPrivOpen] = useState(true);
  const [conOpen, setConOpen] = useState(true);
  const msgs = MESSAGES_BY_ROOM[active];
  const isPrivate = privateRooms.some((r) => r.id === active);

  return (
    <section className="section" id="product">
      <div className="container">
        <Reveal className="section-header">
          <div className="eyebrow-label">A tour</div>
          <h2>Public rooms, private rooms, DMs — in one window.</h2>
          <p className="section-sub">
            Pick a room on the left. Switch between public and private,
            see presence dots flip between online and AFK, scroll through
            real-looking messages with edits, replies, and file attachments.
          </p>
        </Reveal>

        <Reveal>
          <div className="chat-window">
            {/* macOS-style title bar */}
            <div className="chat-titlebar">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
              <span className="chat-titlebar-title">chatty · localhost:3000</span>
            </div>

            <div className="chat-body">
              {/* ---- Sidebar ---- */}
              <aside className="chat-sidebar">
                {/* Header: logo + app name */}
                <div className="chat-sidebar-brand">
                  <ChattyLogo size={20} />
                  <span className="chat-sidebar-brand-name">Chatty</span>
                </div>
                <div className="chat-sidebar-divider" />

                {/* Public Rooms */}
                <div className="chat-sidebar-section">
                  <button className="chat-sidebar-header-btn" onClick={() => setPubOpen(!pubOpen)}>
                    <SidebarChevron open={pubOpen} />
                    <span>Public Rooms</span>
                  </button>
                  {pubOpen && publicRooms.map((r) => (
                    <button
                      key={r.id}
                      className={`chat-room${active === r.id ? " active" : ""}`}
                      onClick={() => setActive(r.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
                      </svg>
                      <span className="chat-room-name">{r.name}</span>
                    </button>
                  ))}
                  {/* Browse rooms link */}
                  {pubOpen && (
                    <button className="chat-room chat-browse-btn">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                      <span className="chat-room-name">Browse rooms</span>
                    </button>
                  )}
                </div>

                {/* Private Rooms */}
                <div className="chat-sidebar-section">
                  <button className="chat-sidebar-header-btn" onClick={() => setPrivOpen(!privOpen)}>
                    <SidebarChevron open={privOpen} />
                    <span>Private Rooms</span>
                  </button>
                  {privOpen && privateRooms.map((r) => (
                    <button
                      key={r.id}
                      className={`chat-room${active === r.id ? " active" : ""}`}
                      onClick={() => setActive(r.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span className="chat-room-name">{r.name}</span>
                    </button>
                  ))}
                </div>

                {/* Contacts */}
                <div className="chat-sidebar-section">
                  <button className="chat-sidebar-header-btn" onClick={() => setConOpen(!conOpen)}>
                    <SidebarChevron open={conOpen} />
                    <span>Contacts</span>
                  </button>
                  {conOpen && contacts.map((p) => (
                    <button key={p.u} className="chat-room chat-contact">
                      <span className="chat-contact-avatar">
                        <BeamAvatar name={p.u} size={20} round />
                        <span className={`presence-dot-mini ${p.status}`} />
                      </span>
                      <span className="chat-room-name">{p.u}</span>
                    </button>
                  ))}
                </div>

                {/* Bottom user profile */}
                <div className="chat-sidebar-footer">
                  <div className="chat-sidebar-divider" />
                  <div className="chat-user-row">
                    <BeamAvatar name="alice" size={28} round />
                    <div className="chat-user-info">
                      <span className="chat-user-name">alice</span>
                      <span className="chat-user-email">alice@chatty.local</span>
                    </div>
                    <button className="icon-btn" title="Settings" style={{ marginLeft: "auto" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </aside>

              {/* ---- Main area ---- */}
              <div className="chat-main">
                {/* Channel header */}
                <div className="chat-channel-bar">
                  <div>
                    <div className="chat-channel-name">
                      {isPrivate
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-muted)" }}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></svg>
                      }
                      <span>{active}</span>
                    </div>
                    <div className="chat-channel-desc">
                      {active === "general"     && "Team-wide announcements and watercooler"}
                      {active === "engineering" && "Backend + infra, Prosody, Drizzle"}
                      {active === "design"      && "Private · 6 members · invitation-only"}
                    </div>
                  </div>
                  <div className="chat-channel-actions">
                    <button className="icon-btn" title="Members"><Icon name="users" size={14} /></button>
                    <button className="icon-btn" title="Info"><Icon name="eye" size={14} /></button>
                  </div>
                </div>

                {/* Messages */}
                <div className="chat-scroll">
                  <div className="chat-scroll-hint">— loaded 847 earlier messages —</div>
                  {msgs.map((m, i) => (
                    <div key={i} className="chat-msg">
                      <BeamAvatar name={m.u} size={30} round />
                      <div className="chat-msg-body">
                        <div className="chat-msg-head">
                          <span className="chat-msg-user">{m.u}</span>
                          <span className="chat-msg-time">{m.t}</span>
                          {m.edited && <span className="chat-msg-edited">(edited)</span>}
                        </div>
                        {m.reply && (
                          <div className="chat-msg-reply-inline">
                            <span className="chat-msg-reply-author">{m.reply.u}:</span>
                            <span className="chat-msg-reply-preview">{m.reply.m}</span>
                          </div>
                        )}
                        <div className="chat-msg-text">{m.m}</div>
                        {m.file && (
                          <div className="chat-msg-file">
                            <div className="chat-msg-file-icon"><Icon name="layers" size={16} /></div>
                            <div>
                              <div className="chat-msg-file-name">{m.file.name}</div>
                              <div className="chat-msg-file-meta">{m.file.size} · Room-gated</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Composer */}
                <div className="chat-composer">
                  <div className="chat-composer-box">
                    <div className="chat-composer-input">
                      <span className="chat-composer-placeholder">Message #{active}</span>
                      <span className="demo-cursor" />
                    </div>
                    <div className="chat-composer-toolbar">
                      <div className="chat-composer-toolbar-left">
                        <button className="icon-btn" title="Attach">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                        </button>
                        <button className="icon-btn" title="Emoji">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
                          </svg>
                        </button>
                      </div>
                      <div className="chat-composer-toolbar-right">
                        <button className="icon-btn chat-send-btn" title="Send">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Video Section
// ---------------------------------------------------------------------------
function VideoSection() {
  return (
    <section className="section" id="demo" style={{ paddingTop: 40 }}>
      <div className="container">
        <Reveal className="section-header" style={{ textAlign: "center", maxWidth: "100%" }}>
          <div className="eyebrow-label">See it in action</div>
          <h2>Watch the demo</h2>
          <p className="section-sub" style={{ margin: "0 auto" }}>
            A quick walkthrough of real-time messaging, room management, and more.
          </p>
        </Reveal>
        <Reveal>
          <div className="video-container">
            <video
              controls
              playsInline
              preload="metadata"
              poster="/chat-screenshot.png"
              style={{
                width: "100%",
                maxWidth: "960px",
                margin: "0 auto",
                display: "block",
                borderRadius: "14px",
                border: "1px solid var(--color-border)",
                boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
              }}
            >
              <source src="/chatty-demo.mp4" type="video/mp4" />
            </video>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features orbit
// ---------------------------------------------------------------------------
function Features() {
  const features = [
    { icon: "wave"   as IconName, tag: "Real-time",   title: "Instant messaging",           body: "Socket.io delivery with edit markers and reply threading." },
    { icon: "layers" as IconName, tag: "History",     title: "Infinite scroll, 10k+ deep",  body: "Cursor-based pagination. Load-tested past 10k messages." },
    { icon: "users"  as IconName, tag: "Rooms",       title: "Public catalog, private invites", body: "Searchable public rooms and invite-only private rooms." },
    { icon: "brain"  as IconName, tag: "DMs",         title: "Friends, one-on-one",          body: "Find people by username. Friend requests and blocks. No awkward middle states." },
    { icon: "chip"   as IconName, tag: "Files",       title: "Paste, upload, preview",       body: "Images and files inline. Clipboard paste works. Access is room-scoped — leave the room, lose access." },
    { icon: "eye"    as IconName, tag: "Presence",    title: "Online · AFK · offline",       body: "Presence is derived from real activity across every browser tab you have open. No manual status picker." },
    { icon: "clock"  as IconName, tag: "Sessions",    title: "Every device, revokable",      body: "See every active session with browser and IP. Kill any of them in one click." },
    { icon: "globe"  as IconName, tag: "Federation",  title: "XMPP / Jabber compatible",     body: "Prosody under the hood. Works with any Jabber client. Federates cleanly between instances." },
  ];
  const [active, setActive] = useState(0);
  const feature = features[active];
  const count = features.length;

  return (
    <section className="section" id="features" style={{ paddingTop: 40 }}>
      <div className="container">
        <Reveal className="section-header">
          <div className="eyebrow-label">Features</div>
          <h2>Eight surfaces. One coherent product.</h2>
          <p className="section-sub">
            Every feature was built end-to-end — UI, server, database, tests.
            Hover an item on the orbit to read how it works.
          </p>
        </Reveal>
        <Reveal>
          <div className="orbit-wrap">
            <div className="orbit">
              <div className="orbit-ring orbit-ring-1" />
              <div className="orbit-ring orbit-ring-2" />
              {features.map((f, i) => {
                const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
                const r = 44;
                const x = 50 + Math.cos(angle) * r;
                const y = 50 + Math.sin(angle) * r;
                return (
                  <button
                    key={f.title}
                    className={`orbit-node${i === active ? " active" : ""}`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    aria-label={f.title}
                  >
                    <Icon name={f.icon} size={18} />
                    <span className="orbit-node-label">{f.tag}</span>
                  </button>
                );
              })}
              <div className="orbit-center">
                <div className="orbit-center-icon">
                  <Icon name={feature.icon} size={28} />
                </div>
                <div className="orbit-center-tag">{feature.tag}</div>
                <h3 className="orbit-center-title">{feature.title}</h3>
                <p className="orbit-center-body">{feature.body}</p>
                <div className="orbit-center-counter">
                  <span>{String(active + 1).padStart(2, "0")}</span>
                  <span className="orbit-center-counter-sep">/</span>
                  <span>{String(count).padStart(2, "0")}</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Federation
// ---------------------------------------------------------------------------
function Federation() {
  return (
    <section className="section" id="federation" style={{ paddingTop: 40 }}>
      <div className="container">
        <div className="feature-split">
          <Reveal>
            <div>
              <div className="eyebrow-label">Federation</div>
              <h2 style={{ fontSize: "clamp(30px, 4vw, 44px)", marginBottom: 20 }}>
                Speaks Jabber.<br />Federates with itself.
              </h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
                Every Chatty instance ships with Prosody. Users log in from any
                XMPP client. Two instances talk to each other over standard
                server-to-server federation — so your team in SF chats with the
                one in Berlin without a cloud in the middle.
              </p>
              <div style={{ display: "grid", gap: 14 }}>
                {[
                  { k: "Bring your own client",      v: "Gajim, Conversations, Dino — whatever your people already use." },
                  { k: "Server-to-server by default", v: "One compose flag enables s2s. Certificate pinning handled." },
                  { k: "Tested at load",             v: "100 concurrent bots across two federated instances, 30-minute run, zero errors." },
                ].map((f) => (
                  <div key={f.k} style={{ display: "flex", gap: 12 }}>
                    <div style={{ flexShrink: 0, marginTop: 4, color: "var(--color-accent)" }}>
                      <Icon name="bolt" size={14} />
                    </div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 500, marginBottom: 2 }}>{f.k}</div>
                      <div style={{ color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.5 }}>{f.v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={1}>
            <div className="fed-diagram">
              <svg viewBox="0 0 520 380" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="fedLine" x1="0" x2="1">
                    <stop offset="0%"   stopColor="#fe2c02" stopOpacity="0.1" />
                    <stop offset="50%"  stopColor="#fe2c02" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#fe2c02" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <g transform="translate(80,120)">
                  <rect width="160" height="140" rx="12" fill="#131313" stroke="rgba(255,255,255,0.14)" />
                  <text x="16" y="28" fill="rgba(255,255,255,0.55)" fontSize="10" letterSpacing="1.5" fontFamily="JetBrains Mono">INSTANCE A</text>
                  <text x="16" y="52" fill="#fff" fontSize="16" fontWeight="500" fontFamily="Inter">chatty.sf</text>
                  <g transform="translate(16,70)" fontSize="11" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.75)">
                    <circle cx="4" cy="6"  r="3" fill="#5fd4a5" /><text x="14" y="9">Next.js 15</text>
                    <circle cx="4" cy="26" r="3" fill="#a8c0ff" /><text x="14" y="29">Postgres</text>
                    <circle cx="4" cy="46" r="3" fill="#fe2c02" /><text x="14" y="49">Prosody</text>
                  </g>
                </g>
                <g transform="translate(280,120)">
                  <rect width="160" height="140" rx="12" fill="#131313" stroke="rgba(255,255,255,0.14)" />
                  <text x="16" y="28" fill="rgba(255,255,255,0.55)" fontSize="10" letterSpacing="1.5" fontFamily="JetBrains Mono">INSTANCE B</text>
                  <text x="16" y="52" fill="#fff" fontSize="16" fontWeight="500" fontFamily="Inter">chatty.berlin</text>
                  <g transform="translate(16,70)" fontSize="11" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.75)">
                    <circle cx="4" cy="6"  r="3" fill="#5fd4a5" /><text x="14" y="9">Next.js 15</text>
                    <circle cx="4" cy="26" r="3" fill="#a8c0ff" /><text x="14" y="29">Postgres</text>
                    <circle cx="4" cy="46" r="3" fill="#fe2c02" /><text x="14" y="49">Prosody</text>
                  </g>
                </g>
                <line x1="240" y1="190" x2="280" y2="190" stroke="url(#fedLine)" strokeWidth="2" />
                <text x="260" y="178" fontSize="10" textAnchor="middle" fill="var(--color-accent)" fontFamily="JetBrains Mono" letterSpacing="1">s2s</text>
                <g fontSize="10" fontFamily="JetBrains Mono" fill="rgba(255,255,255,0.55)">
                  <rect x="20"  y="40"  width="72" height="22" rx="6" fill="#0a0a0a" stroke="rgba(255,255,255,0.1)" />
                  <text x="56"  y="55"  textAnchor="middle">Gajim</text>
                  <line x1="92"  y1="51"  x2="120" y2="130" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
                  <rect x="100" y="300" width="72" height="22" rx="6" fill="#0a0a0a" stroke="rgba(255,255,255,0.1)" />
                  <text x="136" y="315" textAnchor="middle">Browser</text>
                  <line x1="136" y1="300" x2="160" y2="260" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
                  <rect x="330" y="40"  width="90" height="22" rx="6" fill="#0a0a0a" stroke="rgba(255,255,255,0.1)" />
                  <text x="375" y="55"  textAnchor="middle">Conversations</text>
                  <line x1="375" y1="62"  x2="360" y2="130" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
                  <rect x="360" y="300" width="72" height="22" rx="6" fill="#0a0a0a" stroke="rgba(255,255,255,0.1)" />
                  <text x="396" y="315" textAnchor="middle">Dino</text>
                  <line x1="396" y1="300" x2="380" y2="260" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
                </g>
              </svg>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tech logos (paths from Simple Icons)
// ---------------------------------------------------------------------------
const TECH_LOGOS: Record<string, { path: string; viewBox?: string }> = {
  nextjs: {
    path: "M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z",
  },
  postgresql: {
    path: "M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698z",
  },
  drizzle: {
    path: "M5.353 11.823a1.036 1.036 0 0 0-.395-1.422 1.063 1.063 0 0 0-1.437.399L.138 16.702a1.035 1.035 0 0 0 .395 1.422 1.063 1.063 0 0 0 1.437-.398l3.383-5.903Zm11.216 0a1.036 1.036 0 0 0-.394-1.422 1.064 1.064 0 0 0-1.438.399l-3.382 5.902a1.036 1.036 0 0 0 .394 1.422c.506.283 1.15.104 1.438-.398l3.382-5.903Zm7.293-4.525a1.036 1.036 0 0 0-.395-1.422 1.062 1.062 0 0 0-1.437.399l-3.383 5.902a1.036 1.036 0 0 0 .395 1.422 1.063 1.063 0 0 0 1.437-.399l3.383-5.902Zm-11.219 0a1.035 1.035 0 0 0-.394-1.422 1.064 1.064 0 0 0-1.438.398l-3.382 5.903a1.036 1.036 0 0 0 .394 1.422c.506.282 1.15.104 1.438-.399l3.382-5.902Z",
  },
  socketio: {
    path: "M11.9362.0137a12.1694 12.1694 0 00-2.9748.378C4.2816 1.5547.5678 5.7944.0918 10.6012c-.59 4.5488 1.7079 9.2856 5.6437 11.6345 3.8608 2.4179 9.0926 2.3199 12.8734-.223 3.3969-2.206 5.5118-6.2277 5.3858-10.2845-.058-4.0159-2.31-7.9167-5.7588-9.9796C16.354.5876 14.1431.0047 11.9362.0137zm-.063 1.696c4.9448-.007 9.7886 3.8137 10.2815 8.9245.945 5.6597-3.7528 11.4125-9.4875 11.5795-5.4538.544-10.7245-4.0798-10.8795-9.5566-.407-4.4338 2.5159-8.8346 6.6977-10.2995a9.1126 9.1126 0 013.3878-.647zm5.0908 3.2248c-2.6869 2.0849-5.2598 4.3078-7.8886 6.4567 1.2029.017 2.4118.016 3.6208.01 1.41-2.165 2.8589-4.3008 4.2678-6.4667zm-5.6647 7.6536c-1.41 2.166-2.86 4.3088-4.2699 6.4737 2.693-2.0799 5.2548-4.3198 7.9017-6.4557a255.4132 255.4132 0 00-3.6318-.018z",
  },
  reactquery: {
    path: "M12 10.8065c.4435 0 .8064.3629.8064.8064 0 .4436-.3629.8065-.8064.8065-.4436 0-.8065-.3629-.8065-.8065 0-.4435.3629-.8064.8065-.8064zm-4.4219.5469h.9805M18.9805 7.75c.3906-1.8945.4765-3.3438.2226-4.3984-.1484-.629-.4218-1.1368-.8398-1.5078-.4414-.3907-1-.582-1.625-.582-1.0352 0-2.1211.4726-3.2813 1.3671-.4726.3633-.9648.8047-1.4726 1.3164-.043-.0508-.086-.1015-.1367-.1445-1.4454-1.2852-2.6602-2.082-3.6993-2.3906-.6171-.1836-1.1953-.1993-1.7226-.0235-.5586.1875-1.004.5742-1.3164 1.1172-.5156.8945-.6524 2.0742-.461 3.5274.0782.5898.2149 1.2343.4024 1.9335a1.1187 1.1187 0 0 0-.2149.047C3.008 8.621 1.711 9.2694.9258 10.0155c-.4649.4414-.7695.9375-.8828 1.4805-.1133.5781 0 1.1562.3125 1.6992.5156.8945 1.4648 1.5977 2.8164 2.1563.543.2226 1.1562.4257 1.8437.6093a1.0227 1.0227 0 0 0-.0703.2266c-.3906 1.8906-.4765 3.3438-.2226 4.3945.1484.629.4257 1.1407.8398 1.5078.4414.3907 1 .582 1.625.582 1.0352 0 2.121-.4726 3.2813-1.3632.4765-.3711.9726-.8164 1.4882-1.336a1.2 1.2 0 0 0 .1953.2266c1.4454 1.2852 2.6602 2.082 3.6993 2.3906.6172.1836 1.1953.1993 1.7226.0235.5586-.1875 1.004-.5742 1.3164-1.1172.5157-.8945.6524-2.0742.461-3.5273-.082-.6133-.2227-1.2813-.4258-2.0118a1.2248 1.2248 0 0 0 .2383-.0468c1.828-.6094 3.125-1.2578 3.9101-2.004.4649-.4413.7696-.9374.8828-1.4804.1133-.5781 0-1.1563-.3125-1.6992-.5156-.8946-1.4648-1.5977-2.8164-2.1563-.5586-.2304-1.1953-.4414-1.9062-.625a.8647.8647 0 0 0 .0586-.1953zM6.9297 13.6875c.164-.0938.375-.0352.4687.1328l.0625.1055c.4805.8515.9805 1.6601 1.5 2.4258.6133.9023 1.3047 1.8164 2.0743 2.7421a.3455.3455 0 0 1-.0391.4844l-.0742.0664c-2.543 2.2227-4.1914 2.664-4.9532 1.332-.746-1.3046-.4765-3.6718.8086-7.1093a.3437.3437 0 0 1 .1524-.1797ZM17.75 16.3008c.1836-.0313.3594.086.3945.2695l.0196.1016c.6289 3.2851.1875 4.9297-1.3243 4.9297-1.4804 0-3.3593-1.4024-5.6484-4.2032a.3271.3271 0 0 1-.0742-.2226c0-.1875.1562-.3399.3437-.3399h.1211a32.9838 32.9838 0 0 0 2.8086-.0976c1.0703-.086 2.1914-.2305 3.3594-.4375zm.871-6.9766a.3528.3528 0 0 1 .4454-.211l.1016.0352c3.2617 1.1094 4.5039 2.332 3.7187 3.6641-.7656 1.3047-2.9922 2.254-6.6836 2.8477-.082.0117-.168-.004-.2383-.047-.168-.0976-.2265-.3085-.125-.4765l.0625-.1054c.504-.8438.957-1.6836 1.3672-2.5235.4766-.9883.9297-2.0508 1.3516-3.1836zM7.797 8.3398c.082-.0117.168.004.2383.047.168.0976.2265.3085.125.4765l-.0625.1054a34.0882 34.0882 0 0 0-1.3672 2.5235c-.4766.9883-.9297 2.0508-1.3516 3.1836a.3528.3528 0 0 1-.4453.211l-.1016-.0352c-3.2617-1.1094-4.5039-2.332-3.7187-3.6641.7656-1.3047 2.9922-2.254 6.6836-2.8477Zm5.2812-3.9843c2.543-2.2227 4.1914-2.664 4.9532-1.332.746 1.3046.4765 3.6718-.8086 7.1093a.3436.3436 0 0 1-.1524.1797c-.164.0938-.375.0352-.4687-.1328l-.0625-.1055c-.4805-.8515-.9805-1.6601-1.5-2.4258-.6133-.9023-1.3047-1.8164-2.0743-2.7421a.3455.3455 0 0 1 .0391-.4844Zm-5.793-2.082c1.4805 0 3.3633 1.4023 5.6485 4.203a.3488.3488 0 0 1 .0781.2188c-.0039.1914-.1562.3438-.3476.3438l-.1172-.004a34.5835 34.5835 0 0 0-2.8086.1016c-1.0742.086-2.1953.2305-3.3633.4375a.343.343 0 0 1-.3945-.2734l-.0196-.0977c-.629-3.2851-.1876-4.9297 1.3242-4.9297Z",
  },
};

function TechLogo({ name, size = 18, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const logo = TECH_LOGOS[name];
  if (!logo) return null;
  return (
    <svg
      width={size} height={size}
      viewBox={logo.viewBox ?? "0 0 24 24"}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path d={logo.path} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------
function Install() {
  const [copied, setCopied] = useState(false);
  const cmd = `# 1. clone
git clone https://github.com/chatty/chatty && cd chatty

# 2. configure
cp .env.example .env

# 3. run
docker compose up`;

  return (
    <section className="section" id="install" style={{ paddingTop: 40 }}>
      <div className="container">
        <Reveal className="section-header">
          <div className="eyebrow-label">Self-hosted</div>
          <h2>One compose file. Zero external services.</h2>
          <p className="section-sub">
            Next.js, Postgres, Drizzle, Socket.io, and Prosody, wired
            together so you never touch them unless you want to. No SaaS,
            no analytics pingback, no telemetry.
          </p>
        </Reveal>
        <div className="feature-split">
          <Reveal>
            <div className="demo-window">
              <div className="demo-titlebar">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
                <span className="title">~/chatty</span>
                <button className="demo-copy" onClick={() => {
                  navigator.clipboard?.writeText(cmd);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                }}>{copied ? "Copied" : "Copy"}</button>
              </div>
              <div className="demo-body" style={{ minHeight: 280 }}>
                {cmd.split("\n").map((line, i) => (
                  <div key={i} className="demo-line" style={{
                    color: line.startsWith("#") ? "#5a6069"
                      : (line.startsWith("git") || line.startsWith("cp") || line.startsWith("docker")) ? "#d0d4db"
                      : "#8a8f98",
                  }}>
                    {line || " "}
                  </div>
                ))}
                <div style={{ height: 14 }} />
                <div className="demo-line demo-k-green">✓ postgres    ready on :5432</div>
                <div className="demo-line demo-k-green">✓ prosody     ready on :5222, :5269</div>
                <div className="demo-line demo-k-green">✓ next        ready on :3000</div>
                <div className="demo-line demo-k-green">✓ socket.io   attached</div>
                <div className="demo-line demo-prompt" style={{ marginTop: 8 }}>
                  <span className="demo-k-blue">$</span><span className="demo-cursor" />
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={1}>
            <div>
              <h3 style={{ fontSize: 28, letterSpacing: "-0.02em", margin: "0 0 16px", fontWeight: 600 }}>
                What runs on your hardware.
              </h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                Six parts, one compose file. Postgres persists, Prosody federates,
                Socket.io handles real-time, Next.js serves the UI. All of it
                runs on your box.
              </p>
              <div className="stack-grid">
                {[
                  { name: "Next.js 15",     role: "App + API routes",    logo: "nextjs",      color: "#d0d4db" },
                  { name: "PostgreSQL",     role: "Persistence",         logo: "postgresql",  color: "#336791" },
                  { name: "Drizzle ORM",    role: "Schema + migrations", logo: "drizzle",     color: "#C5F74F" },
                  { name: "Socket.io",      role: "Real-time transport", logo: "socketio",    color: "#fff" },
                  { name: "TanStack Query", role: "Cache + sync",        logo: "reactquery",  color: "#FF4154" },
                  { name: "Prosody",        role: "XMPP federation",     logo: null,          color: "#fe2c02" },
                ].map((s) => (
                  <div key={s.name} className="stack-item">
                    <div className="stack-logo-wrap" style={{ color: s.color }}>
                      {s.logo ? (
                        <TechLogo name={s.logo} size={18} color={s.color} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="8" rx="2" />
                          <rect x="2" y="14" width="20" height="8" rx="2" />
                          <line x1="6" y1="6" x2="6.01" y2="6" />
                          <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="stack-name">{s.name}</div>
                      <div className="stack-role">{s.role}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, padding: 14, border: "1px dashed var(--color-border-strong)", borderRadius: 10, color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
                <strong style={{ color: "#fff", fontWeight: 500 }}>No outbound traffic.</strong>{" "}
                Chatty never calls home. No third-party SDKs, no analytics,
                no model APIs. Your messages stay on your Postgres.
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------
function FAQ() {
  const items = [
    { q: "Is Chatty really self-hosted?", a: "Yes — all of it. One docker-compose.yml brings up Postgres, Prosody, and the Next.js app. There is no hosted version, no telemetry, and no outbound dependency on any third-party service." },
    { q: "Does it work with existing Jabber clients?", a: "Yes. Prosody is the XMPP backbone, so any standards-compliant Jabber client (Gajim, Conversations, Dino, etc.) can connect as a regular user. You can also federate between Chatty instances over server-to-server." },
    { q: "How are private rooms different from public?", a: "Public rooms show up in a searchable catalog — anyone on the instance can find and join them. Private rooms are invitation-only and don’t appear in the catalog. Room owners have a moderation dashboard to ban, remove, and manage members." },
    { q: "What happens to file access when I lose room membership?", a: "You lose file access too. Every file is room-scoped — the API checks your current membership on every read. There are no shareable signed URLs that leak outside a room." },
    { q: "How is online / AFK / offline determined?", a: "Derived from real activity across every browser tab you have open, aggregated via Socket.io. There’s no manual status picker — it reflects what you’re actually doing, including across multiple devices." },
    { q: "Can I revoke a session?", a: "Yes. The active-session list shows every device logged into your account with browser and IP. One click ends that session everywhere." },
    { q: "How well does it scale?", a: "Load tested with 100 concurrent bots federated across two instances, 30-minute run, zero errors. Individual rooms hold 10,000+ messages with infinite scroll that doesn’t jump or jank." },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="section" id="faq" style={{ paddingTop: 40 }}>
      <div className="container">
        <Reveal className="section-header">
          <div className="eyebrow-label">Frequently asked</div>
          <h2>Questions, answered sharply.</h2>
          <p className="section-sub">Open an issue on GitHub for anything not here. Pull requests welcome.</p>
        </Reveal>
        <Reveal>
          <div>
            {items.map((it, i) => (
              <div
                key={it.q}
                className={`faq-item${open === i ? " open" : ""}`}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <div className="faq-q">
                  <span>{it.q}</span>
                  <span className="faq-toggle"><Icon name="plus" size={20} /></span>
                </div>
                <div className="faq-a">{it.a}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CTABand
// ---------------------------------------------------------------------------
function CTABand() {
  return (
    <section className="cta-band" id="get">
      <div className="cta-band-bg" />
      <div className="cta-band-inner">
        <Reveal><h2>Run it on<br />your own box.</h2></Reveal>
        <Reveal delay={1}><p>Clone the repo, copy the env file, run docker compose up. You&apos;ll have a chat server in under two minutes.</p></Reveal>
        <Reveal delay={2}>
          <div style={{ display: "inline-flex", gap: 10 }}>
            <a href="/register" className="btn btn-primary" style={{ padding: "13px 22px", fontSize: 14 }}>
              Try it now <Icon name="arrow" size={14} />
            </a>
            <a href="#install" className="btn btn-secondary" style={{ padding: "13px 22px", fontSize: 14 }}>
              <Icon name="code" size={14} /> Self-host guide
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="brand" style={{ fontSize: 18 }}>
            <ChattyLogo size={22} />
            <span>chatty</span>
          </div>
          <p className="footer-tag">Classic web chat, built for teams. Self-hosted by design. MIT licensed.</p>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <a href="#features">Features</a>
          <a href="#product">Tour</a>
          <a href="#federation">Federation</a>
          <a href="#install">Install</a>
        </div>
        <div className="footer-col">
          <h4>Get started</h4>
          <a href="/register">Register</a>
          <a href="/login">Sign in</a>
          <a href="#install">Self-host</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="footer-col">
          <h4>Project</h4>
          <a href="#">GitHub</a>
          <a href="#">Report issue</a>
          <a href="#">Contributing</a>
          <a href="#">License</a>
        </div>
      </div>
      <div className="footer-wordmark">chatty</div>
      <div className="footer-bottom">
        <span>© 2026 Chatty. MIT licensed.</span>
        <span>Runs on your hardware · v1.0</span>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// LandingPage
// ---------------------------------------------------------------------------
const HEADLINE: HeroCopy = {
  h1a: "Classic web chat,",
  h1b: "built for teams.",
  sub: "Real-time messaging, public and private rooms, DMs, file sharing, presence, and moderation — all running in a single docker compose on your own hardware.",
};

export default function LandingPage() {
  return (
    <div className="landing-page">
      <Nav />
      <main>
        <Hero heroCopy={HEADLINE} />
        <Stats />
        <ProductSection />
        <VideoSection />
        <Features />
        <Federation />
        <Install />
        <FAQ />
        <CTABand />
      </main>
      <Footer />
    </div>
  );
}

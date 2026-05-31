"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";

const NAV = [
  { href: "/",         icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", label: "Dashboard",    roles: ["admin","researcher","viewer"] },
  { href: "/pipeline", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: "Pipeline",      roles: ["admin"] },
  { href: "/data",     icon: "M3 10h18M3 14h18M10 3v18M14 3v18M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z", label: "Data Browser",  roles: ["admin","researcher"] },
  { href: "/export",   icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4", label: "Export",        roles: ["admin","researcher"] },
  { href: "/audit",    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", label: "Audit Log",     roles: ["admin"] },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      {d.split(" M").map((path, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? path : "M" + path} />
      ))}
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [role, setRole]       = useState<string | null>(null);
  const [username, setUsername] = useState<string>("—");
  const [open, setOpen]       = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/login"); return; }
    const r = api.getRole() ?? "viewer";
    setRole(r);
    setUsername(r === "admin" ? "admin_user" : r === "researcher" ? "researcher_user" : "viewer_user");
  }, [router]);

  // close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [pathname]);

  function logout() {
    api.logout();
    router.push("/login");
  }

  const visibleNav = NAV.filter(n => role && n.roles.includes(role));

  const Sidebar = (
    <aside className="flex flex-col w-[216px] h-full shrink-0" style={{ background: "#51247A" }}>
      {/* Logo */}
      <div className="px-[18px] pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-purple-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[14px] font-bold text-purple-100">ClinicalETL</span>
        </div>
        <p className="text-[9px] text-purple-400 leading-tight">UQ Data Engineer Interview</p>
      </div>

      <div className="h-px mx-0" style={{ background: "#6b2fa0" }} />

      {/* Nav */}
      <nav className="flex-1 px-[6px] py-2 flex flex-col gap-[2px] overflow-y-auto">
        {visibleNav.map(n => {
          const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
          return (
            <button
              key={n.href}
              onClick={() => router.push(n.href)}
              className={`flex items-center gap-2 w-full px-3 py-[9px] rounded-[5px] text-left text-[13px] transition-colors ${
                active ? "text-white font-medium" : "text-purple-200 hover:text-white hover:bg-[#5c2a8a]"
              }`}
              style={active ? { background: "#6b2fa0" } : {}}
            >
              <NavIcon d={n.icon} />
              {n.label}
            </button>
          );
        })}
      </nav>

      <div className="h-px" style={{ background: "#6b2fa0" }} />

      {/* User */}
      <div className="flex items-center gap-[10px] px-[14px] py-[13px]">
        <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-purple-100" style={{ background: "#6b2fa0" }}>
          {username[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-purple-100 truncate">{username}</p>
          <p className="text-[10px] text-purple-400">{role}</p>
        </div>
        <button onClick={logout} className="text-purple-400 hover:text-purple-200 transition-colors">
          <svg className="w-[13px] h-[13px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">

      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <div className="hidden md:flex h-full">
        {Sidebar}
      </div>

      {/* ── Mobile overlay sidebar ──────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          {/* drawer */}
          <div className="relative flex h-full">
            {Sidebar}
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button onClick={() => setOpen(true)} className="p-1 rounded text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#51247A" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-[14px] font-bold" style={{ color: "#51247A" }}>ClinicalETL</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

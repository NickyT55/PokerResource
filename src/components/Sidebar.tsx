import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { usePathname, useParams } from "next/navigation";

// Helper to get nav items based on route/params
function getNavItems(pathname: string, params: Record<string, string | undefined>) {
  const inRoom = pathname.startsWith(`/rooms/`) && params.roomId;
  const inSession = pathname.startsWith(`/rooms/`) && params.roomId && pathname.includes("/sessions/");
  if (inSession) {
    const { roomId, sessionId } = params;
    return [
      { href: `/rooms/${roomId}/sessions/${sessionId}`, label: "Tournament" },
      { href: `/rooms/${roomId}/sessions/${sessionId}/history`, label: "History" },
      { href: `/rooms/${roomId}/sessions/${sessionId}/settings`, label: "Settings" },
      { href: `/rooms/${roomId}/stats`, label: "Room Stats" },
      { href: `/rooms`, label: "Return to Rooms" },
    ];
  } else if (inRoom) {
    return [
      { href: `/rooms/${params.roomId}`, label: "Room Dashboard" },
      { href: `/rooms/${params.roomId}/sessions`, label: "Tournament" },
      { href: `/rooms/${params.roomId}/cash`, label: "Cash Game" },
      { href: `/rooms/${params.roomId}/history`, label: "History" },
      { href: `/rooms/${params.roomId}/settings`, label: "Settings" },
      { href: `/rooms/${params.roomId}/stats`, label: "Room Stats" },
      { href: `/rooms`, label: "Return to Rooms" },
    ];
  }
  return [
    { href: "/rooms", label: "Rooms" },
    { href: "/stats", label: "Stats" },
  ];
}

const Sidebar = () => {
  const { signOut } = useAuth();
  const pathname = usePathname();
  const paramsRaw = useParams();
  // Convert params to Record<string, string|undefined>
  const params: Record<string, string | undefined> = {};
  Object.entries(paramsRaw).forEach(([k, v]) => {
    params[k] = Array.isArray(v) ? v[0] : v;
  });
  const navItems = getNavItems(pathname, params);
  return (
    <aside className="hidden sm:flex w-48 h-full bg-neutral-200/60 backdrop-blur-md p-4 border-r border-neutral-300 flex-col gap-2 shadow-lg">
      <h2 className="font-bold text-lg mb-4 text-gray-800">Poker Tool</h2>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded px-3 py-2 hover:bg-neutral-300/60 transition text-gray-900 font-medium"
        >
          {item.label}
        </Link>
      ))}
      <div className="flex-1" />
      <Link
        href="/profile"
        className="rounded px-3 py-2 hover:bg-neutral-300/60 transition text-gray-900 font-medium mb-2"
      >
        Profile
      </Link>
      <button
        className="w-full mt-4 bg-red-700 hover:bg-red-800 text-white font-bold py-2 rounded shadow"
        onClick={signOut}
      >
        Sign Out
      </button>
    </aside>
  );
};

// Bottom navigation for mobile
export function BottomNav() {
  const { signOut } = useAuth();
  const pathname = usePathname();
  const paramsRaw = useParams();
  // Convert params to Record<string, string|undefined>
  const params: Record<string, string | undefined> = {};
  Object.entries(paramsRaw).forEach(([k, v]) => {
    params[k] = Array.isArray(v) ? v[0] : v;
  });
  const navItems = getNavItems(pathname, params);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex sm:hidden bg-white border-t border-gray-200 shadow divide-x divide-gray-200">
      {navItems.slice(0, 4).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex-1 text-center py-2 px-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          {item.label}
        </Link>
      ))}
      <button
        className="flex-1 text-center py-2 px-1 text-xs font-medium text-red-700 hover:bg-red-50"
        onClick={signOut}
      >
        Sign Out
      </button>
    </nav>
  );
}

export default Sidebar; 
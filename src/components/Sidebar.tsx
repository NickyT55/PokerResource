import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/authContext";
import { usePathname, useParams } from "next/navigation";

const Sidebar = () => {
  const { signOut } = useAuth();
  const pathname = usePathname();
  const params = useParams();
  const inRoom = pathname.startsWith(`/rooms/`) && params.roomId;
  const inSession = pathname.startsWith(`/rooms/`) && params.roomId && pathname.includes("/sessions/");

  let navItems = [
    { href: "/rooms", label: "Rooms" },
    { href: "/stats", label: "Stats" },
  ];
  if (inSession) {
    // Extract roomId and sessionId from params
    const { roomId, sessionId } = params;
    navItems = [
      { href: `/rooms/${roomId}/sessions/${sessionId}`, label: "Tournament" },
      { href: `/rooms/${roomId}/sessions/${sessionId}/history`, label: "History" },
      { href: `/rooms/${roomId}/sessions/${sessionId}/settings`, label: "Settings" },
      { href: `/rooms/${roomId}/stats`, label: "Room Stats" },
      { href: `/rooms`, label: "Return to Rooms" },
    ];
  } else if (inRoom) {
    navItems = [
      { href: `/rooms/${params.roomId}`, label: "Room Dashboard" },
      { href: `/rooms/${params.roomId}/sessions`, label: "Tournament" },
      { href: `/rooms/${params.roomId}/cash`, label: "Cash Game" },
      { href: `/rooms/${params.roomId}/history`, label: "History" },
      { href: `/rooms/${params.roomId}/settings`, label: "Settings" },
      { href: `/rooms/${params.roomId}/stats`, label: "Room Stats" },
      { href: `/rooms`, label: "Return to Rooms" },
    ];
  }

  return (
    <aside className="w-48 h-full bg-neutral-200/60 backdrop-blur-md p-4 border-r border-neutral-300 flex flex-col gap-2 shadow-lg">
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

export default Sidebar; 
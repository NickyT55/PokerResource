"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-green-800 to-yellow-400 text-center px-4 py-8 animate-fade-in">
      <div className="w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl flex flex-col items-center gap-8">
        <div className="w-24 h-24 sm:w-32 sm:h-32 mb-4 animate-bounce-slow">
          {/* Globe SVG for visual engagement */}
          <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="w-full h-full"><g clipPath="url(#a)"><path fillRule="evenodd" clipRule="evenodd" d="M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45q-1.24.21-2.7.34-.31 1.83-.97 3.1M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.48-1.52a7 7 0 0 1-.96 0H7.5a4 4 0 0 1-.84-1.32q-.38-.89-.63-2.08a40 40 0 0 0 3.92 0q-.25 1.2-.63 2.08a4 4 0 0 1-.84 1.31zm2.94-4.76q1.66-.15 2.95-.43a7 7 0 0 0 0-2.58q-1.3-.27-2.95-.43a18 18 0 0 1 0 3.44m-1.27-3.54a17 17 0 0 1 0 3.64 39 39 0 0 1-4.3 0 17 17 0 0 1 0-3.64 39 39 0 0 1 4.3 0m1.1-1.17q1.45.13 2.69.34a6.5 6.5 0 0 0-3.67-3.44q.65 1.26.98 3.1M8.48 1.5l.01.02q.41.37.84 1.31.38.89.63 2.08a40 40 0 0 0-3.92 0q.25-1.2.63-2.08a4 4 0 0 1 .85-1.32 7 7 0 0 1 .96 0m-2.75.4a6.5 6.5 0 0 0-3.67 3.44 29 29 0 0 1 2.7-.34q.31-1.83.97-3.1M4.58 6.28q-1.66.16-2.95.43a7 7 0 0 0 0 2.58q1.3.27 2.95.43a18 18 0 0 1 0-3.44m.17 4.71q-1.45-.12-2.69-.34a6.5 6.5 0 0 0 3.67 3.44q-.65-1.27-.98-3.1" fill="#51cf66"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h16v16H0z"/></clipPath></defs></svg>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg animate-pulse mb-2">Are you ready to play?</h1>
        <p className="text-lg sm:text-xl text-yellow-100 mb-6 animate-fade-in delay-200">Join the ultimate poker tournament experience. Compete, win, and have fun with friends!</p>
        <button
          className="w-full sm:w-auto px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-xl font-bold rounded-full shadow-lg transition-all duration-200 animate-bounce focus:outline-none focus:ring-4 focus:ring-green-300"
          onClick={() => router.push("/auth")}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

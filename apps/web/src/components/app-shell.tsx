"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/deliveries", label: "Deliveries", number: "01" },
  { href: "/knowledge", label: "Knowledge base", number: "02" },
  { href: "/mcp", label: "MCP", number: "03" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="border-b border-slate-800 bg-slate-950 px-5 py-5 text-slate-200 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
        <Link href="/deliveries" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-400 font-black text-slate-950">
            H
          </span>
          <span>
            <span className="block text-lg font-semibold tracking-tight text-white">
              HookLens
            </span>
            <span className="block text-xs text-slate-400">
              Integration operations
            </span>
          </span>
        </Link>

        <nav className="mt-7 flex gap-2 overflow-x-auto lg:flex-col">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/deliveries" &&
                pathname.startsWith("/deliveries/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-indigo-400 text-slate-950 shadow-lg shadow-indigo-950/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span className="font-mono text-[10px] opacity-65">
                  {item.number}
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 hidden rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-400 lg:block">
          <p className="font-semibold text-slate-200">Local demo</p>
          <p className="mt-1">
            Sensitive headers and secret-shaped payload values are masked.
          </p>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}

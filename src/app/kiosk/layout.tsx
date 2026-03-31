import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Staff check-in",
  description: "Check in or out on your phone after scanning the restaurant QR code.",
  appleWebApp: {
    capable: true,
    title: "Staff check-in",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

/**
 * Kiosk is designed for employees’ own phones: full viewport height, safe areas, readable tap targets.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col bg-gradient-to-b from-stone-50 to-stone-100 dark:from-zinc-950 dark:to-zinc-900">
      <header className="shrink-0 border-b border-stone-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-zinc-400">
          Restaurant kiosk
        </p>
        <p className="text-center text-sm font-semibold text-stone-800 dark:text-zinc-100">
          Use your phone — scan the QR at work
        </p>
      </header>
      <div className="flex flex-1 flex-col px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {children}
      </div>
    </div>
  );
}

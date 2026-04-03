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
    { media: "(prefers-color-scheme: light)", color: "#fdfeea" },
    { media: "(prefers-color-scheme: dark)", color: "#0a4646" },
  ],
};

/**
 * Kiosk is designed for employees’ own phones: full viewport height, safe areas, readable tap targets.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="from-background to-muted/40 flex min-h-[100dvh] flex-1 flex-col bg-gradient-to-b">
      <header className="bg-card/90 border-border shrink-0 border-b px-4 py-3 backdrop-blur-md">
        <p className="text-muted-foreground text-center text-xs font-medium tracking-wider uppercase">Restaurant kiosk</p>
        <p className="text-center text-sm font-semibold">Use your phone — scan the QR at work</p>
      </header>
      <div className="flex flex-1 flex-col px-[max(1rem,env(safe-area-inset-left))] pt-2 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col items-stretch justify-center py-4 sm:py-6">{children}</div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, MapPin, QrCode, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: {
    absolute: "WAQT Attendance",
  },
  description:
    "QR-based check-in and check-out for restaurant teams. Location-aware attendance with company and master admin dashboards.",
};

const features = [
  {
    icon: QrCode,
    title: "Scan to check in",
    description:
      "Branch QR codes open a fast kiosk flow on staff phones—selfie verification optional, session-based and easy to refresh.",
  },
  {
    icon: MapPin,
    title: "Location-aware",
    description:
      "Attendance can be tied to branch geofences so check-ins reflect where people actually are.",
  },
  {
    icon: BarChart3,
    title: "Dashboards & exports",
    description:
      "Company admins manage branches, employees, and hours; review logs and insights in one place.",
  },
  {
    icon: Shield,
    title: "Role-based access",
    description:
      "Separate flows for staff, company admins, and platform operators—each sees only what they need.",
  },
];

export default function HomePage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute -top-32 -right-24 h-[min(520px,80vw)] w-[min(520px,80vw)] rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--brand-slate) 45%, transparent) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-40 -left-32 h-[min(480px,90vw)] w-[min(480px,90vw)] rounded-full opacity-35 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--brand-deep) 18%, transparent) 0%, transparent 72%)",
          }}
        />
      </div>

      <header className="relative z-10 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <Link href="/" className="font-semibold tracking-tight">
            WAQT <span className="text-muted-foreground font-normal">Attendance</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link href="/employee">Staff</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-14 sm:px-6 sm:py-20 md:py-24">
          <div className="max-w-2xl">
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-[0.2em] uppercase">
              Restaurant workforce
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-[3.25rem] md:leading-[1.1]">
              Time and attendance,
              <span className="text-muted-foreground"> built for busy floors.</span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-pretty text-lg leading-relaxed">
              WAQT Attendance connects your team with QR check-in, optional photo verification, and
              admin tools—without slowing down service.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                className="h-12 px-8 text-base shadow-sm"
                size="lg"
                asChild
              >
                <Link href="/employee">Staff check-in</Link>
              </Button>
              <Button
                variant="outline"
                className="h-12 border-border px-8 text-base bg-background/50"
                size="lg"
                asChild
              >
                <Link href="/login">Admin sign in</Link>
              </Button>
            </div>
            <p className="text-muted-foreground mt-6 max-w-md text-sm leading-relaxed">
              Kiosk links are opened from your branch QR page—no app store required.
            </p>
          </div>

          <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                size="sm"
                className="border-border/90 bg-card/90 shadow-sm backdrop-blur-sm"
              >
                <CardHeader className="gap-3">
                  <div className="bg-primary/8 text-primary inline-flex size-10 items-center justify-center rounded-xl">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <footer className="relative z-10 border-t border-border/80 py-8">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
            <p>© {new Date().getFullYear()} WAQT Attendance</p>
            <div className="flex gap-6">
              <Link href="/employee" className="hover:text-foreground transition-colors">
                Staff portal
              </Link>
              <Link href="/login" className="hover:text-foreground transition-colors">
                Admin login
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

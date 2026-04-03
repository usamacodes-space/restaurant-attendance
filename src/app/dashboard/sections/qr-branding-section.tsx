"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useRef, useState } from "react";
import { primaryButtonClass } from "../types";

export function QrBrandingSection() {
  const [qrLogoLeftUrl, setQrLogoLeftUrl] = useState("");
  const [draftLeft, setDraftLeft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | "upload" | "save">(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/qr-branding");
    const data = await res.json();
    if (res.ok) {
      const l = data.qrLogoLeftUrl ?? "";
      setQrLogoLeftUrl(l);
      setDraftLeft(l);
      setError(null);
    } else setError(data.error ?? "Failed to load QR branding");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFile(file: File | undefined) {
    if (!file || file.size === 0) return;
    setError(null);
    setBusy("upload");
    const fd = new FormData();
    fd.set("side", "left");
    fd.set("file", file);
    const res = await fetch("/api/admin/qr-branding/upload", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Upload failed");
    void load();
  }

  async function saveUrls(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("save");
    const res = await fetch("/api/admin/qr-branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qrLogoLeftUrl: draftLeft.trim() || null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Save failed");
    setQrLogoLeftUrl(data.qrLogoLeftUrl ?? "");
    setDraftLeft(data.qrLogoLeftUrl ?? "");
  }

  return (
    <Card className="border-border shadow-md">
      <CardHeader className="px-4 pt-6 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">WAQT logo (global)</CardTitle>
        <CardDescription>
          This image appears on every branch QR page on the left of the ×. Each company uploads their own logo
          separately (company admin workspace). It stays the same across all companies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-4 pb-6 sm:px-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-xl border border-border p-4">
          <p className="mb-2 text-sm font-semibold">WAQT logo</p>
          <div className="mb-3 flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
            {qrLogoLeftUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrLogoLeftUrl} alt="" className="max-h-full max-w-full object-contain p-1" />
            ) : (
              <span className="text-muted-foreground px-2 text-center text-xs">No image</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void uploadFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== false}
            onClick={() => fileInputRef.current?.click()}
          >
            {busy === "upload" ? "Uploading…" : "Upload image"}
          </Button>
        </div>

        <form onSubmit={saveUrls} className="space-y-3">
          <p className="text-sm font-semibold">Or set image URL</p>
          <div className="grid max-w-2xl grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label htmlFor="url-waqt">WAQT logo URL</Label>
              <Input id="url-waqt" value={draftLeft} onChange={(e) => setDraftLeft(e.target.value)} placeholder="https://…" />
            </div>
            <Button type="submit" disabled={busy !== false} className={primaryButtonClass}>
              {busy === "save" ? "Saving…" : "Save URL"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

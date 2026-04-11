"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coffee } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import DataCenterPreferencesForm from "@/components/DataCenterPreferencesForm";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [initialZip, setInitialZip] = useState("");
  const [initialNotify, setInitialNotify] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/signup");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setEmail(typeof data.email === "string" ? data.email : "");
        setInitialZip(typeof data.zipCode === "string" ? data.zipCode : "");
        setInitialNotify(Boolean(data.notifyNewDataCenters));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || (user && !loaded)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 font-jakarta">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 font-jakarta">
      <div className="mx-auto max-w-md px-6 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to map
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
          <h1 className="text-2xl font-bold text-zinc-900">Account</h1>
          <p className="mt-1 text-sm text-zinc-600">Your membership preferences</p>

          <div className="mt-8 space-y-2 border-b border-zinc-100 pb-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Email</p>
            <p className="text-sm font-medium text-zinc-900">{email || user.email}</p>
          </div>

          <div className="mt-8">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Data center alerts
            </p>
            <DataCenterPreferencesForm
              key={`${initialZip}-${initialNotify}`}
              initialZip={initialZip}
              initialNotify={initialNotify}
              completeOnboarding={false}
              showDisclaimer
              showBackLink={false}
              notifyCheckboxPrimary="Send me an email notification about new data centers near my ZIP code."
              notifyCheckboxSecondary={null}
              submitLabel="Save preferences"
              onSaved={async () => {
                router.refresh();
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              void createClient().auth.signOut().then(() => {
                router.push("/");
                router.refresh();
              });
            }}
            className="mt-8 w-full rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Sign out
          </button>

          <div className="mt-8 border-t border-zinc-100 pt-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto">
              <a
                href="https://www.buymeacoffee.com/petedamato"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#FF813F] hover:bg-[#ff955c] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                <Coffee className="w-6 h-6" />
                Support this project on BuyMeACoffee
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

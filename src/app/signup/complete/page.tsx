"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import DataCenterPreferencesForm from "@/components/DataCenterPreferencesForm";

export default function SignupCompletePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
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
        if (cancelled) return;
        if (!data) {
          setLoaded(true);
          return;
        }
        if (data.onboardingDone) {
          router.replace("/account");
          return;
        }
        setInitialZip(typeof data.zipCode === "string" ? data.zipCode : "");
        setInitialNotify(Boolean(data.notifyNewDataCenters));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [user, router]);

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
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
          <h1 className="text-xl font-bold text-zinc-900">Almost done</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Add an optional ZIP code and choose whether you want alerts about new data centers nearby.
          </p>
          <div className="mt-8">
            <DataCenterPreferencesForm
              key={`${initialZip}-${initialNotify}`}
              initialZip={initialZip}
              initialNotify={initialNotify}
              completeOnboarding
              submitLabel="Save and continue"
              onSaved={async () => {
                router.push("/");
                router.refresh();
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

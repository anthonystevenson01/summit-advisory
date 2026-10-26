"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND } from "@/app/lib/brand";
import CyclingLoader from "@/app/components/toolkit/shared/CyclingLoader";
import ErrMsg from "@/app/components/toolkit/shared/ErrMsg";

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * One button on the result page for a visitor the server found authorised
 * whose composite has no stored working yet: POSTs to the details route and
 * refreshes the server page on success. State changes only in the async
 * continuation.
 */
export default function OpenFullView({ runId, token }: { runId: string; token?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/built-to-scale/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { runId, token } : { runId }),
      });
      if (!res.ok) {
        let message = GENERIC_MESSAGE;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // no JSON body
        }
        setError(message);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError(GENERIC_MESSAGE);
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div style={{ padding: "24px 0" }}>
        <CyclingLoader dark={false} messages={["Unlocking the scorecard", "Writing the working for each tool", "Sending your copy"]} />
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, textAlign: "center" }}>
      {error ? (
        <ErrMsg msg={error} dark={false} retry={() => setError(null)} />
      ) : (
        <button
          type="button"
          onClick={open}
          style={{ padding: "12px 28px", borderRadius: 6, border: "none", background: BRAND.brandGreen, color: BRAND.white, fontFamily: "var(--font-barlow-condensed), sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: "0.04em", cursor: "pointer" }}
        >
          Open the full view
        </button>
      )}
    </div>
  );
}

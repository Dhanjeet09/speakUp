"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { reportUser, blockUser } from "@/lib/api/reports";
import toast from "react-hot-toast";

const REASONS = [
  { value: "inappropriate_language", label: "Inappropriate language" },
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
] as const;

interface ReportModalProps {
  partnerUserId: string;
  partnerName: string;
  onClose: () => void;
  onEndCall: () => void;
}

export default function ReportModal({
  partnerUserId,
  partnerName,
  onClose,
  onEndCall,
}: ReportModalProps) {
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alsoBlock, setAlsoBlock] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

  async function handleSubmit() {
    if (!reason) return;
    setSubmitting(true);
    try {
      await reportUser(partnerUserId, reason, note || undefined);
      if (alsoBlock) {
        await blockUser(partnerUserId);
      }
      toast.success("Report submitted. Our team will review it.");
      onEndCall();
    } catch {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Report user"
    >
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Report {partnerName}</h2>
        <p className="mt-1 text-sm text-gray-500">
          This will not notify the user. Our team reviews all reports.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Reason for report
          </label>
          {REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                reason === r.value
                  ? "border-danger bg-red-50 text-danger"
                  : "border-gray-300 text-gray-700 hover:border-gray-400"
              }`}
              aria-pressed={reason === r.value}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label
            htmlFor="report-note"
            className="block text-sm font-medium text-gray-700"
          >
            Additional details (optional)
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={280}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="What happened? (max 280 characters)"
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Also block this user from matching with me again
        </label>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="flex-1"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </div>
    </div>
  );
}

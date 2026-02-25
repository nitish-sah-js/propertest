"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

type ViolationType = "TAB_SWITCH" | "FULLSCREEN_EXIT" | "COPY_PASTE";

interface ViolationCounts {
  tabSwitchCount: number;
  fullscreenExitCount: number;
  copyPasteAttempts: number;
  totalViolations: number;
}

interface UseProctoringReturn {
  violations: ViolationCounts;
  warningMessage: string | null;
}

const VIOLATION_MESSAGES: Record<ViolationType, string> = {
  TAB_SWITCH: "Tab switch detected!",
  FULLSCREEN_EXIT: "Fullscreen exit detected!",
  COPY_PASTE: "Copy/paste attempt detected!",
};

export function useProctoring(
  attemptId: string | null,
  maxViolations: number,
  onAutoSubmit: () => void
): UseProctoringReturn {
  const [violations, setViolations] = useState<ViolationCounts>({
    tabSwitchCount: 0,
    fullscreenExitCount: 0,
    copyPasteAttempts: 0,
    totalViolations: 0,
  });
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Refs to avoid stale closures
  const violationsRef = useRef(violations);
  violationsRef.current = violations;
  const autoSubmitCalledRef = useRef(false);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;

  const reportViolation = useCallback(
    async (type: ViolationType) => {
      if (!attemptId || autoSubmitCalledRef.current) return;

      const current = violationsRef.current;
      const newTotal = current.totalViolations + 1;

      // Optimistic update
      setViolations((prev) => ({
        ...prev,
        tabSwitchCount:
          type === "TAB_SWITCH" ? prev.tabSwitchCount + 1 : prev.tabSwitchCount,
        fullscreenExitCount:
          type === "FULLSCREEN_EXIT"
            ? prev.fullscreenExitCount + 1
            : prev.fullscreenExitCount,
        copyPasteAttempts:
          type === "COPY_PASTE"
            ? prev.copyPasteAttempts + 1
            : prev.copyPasteAttempts,
        totalViolations: newTotal,
      }));

      setWarningMessage(VIOLATION_MESSAGES[type]);

      const remaining = maxViolations - newTotal;

      if (remaining > 0) {
        toast.warning(VIOLATION_MESSAGES[type], {
          description: `${remaining} violation${remaining === 1 ? "" : "s"} remaining before auto-submit.`,
          duration: 4000,
        });
      } else {
        toast.error("Maximum violations exceeded!", {
          description: "Your test is being auto-submitted.",
          duration: 5000,
        });
      }

      // Send to API
      try {
        await fetch(`/api/attempts/${attemptId}/violations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });
      } catch {
        // Violation already counted optimistically
      }

      // Auto-submit if max exceeded
      if (newTotal >= maxViolations && !autoSubmitCalledRef.current) {
        autoSubmitCalledRef.current = true;
        onAutoSubmitRef.current();
      }
    },
    [attemptId, maxViolations]
  );

  useEffect(() => {
    if (!attemptId) return;

    // --- Tab switch detection ---
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation("TAB_SWITCH");
      }
    };

    // --- Fullscreen enforcement ---
    const requestFullscreen = () => {
      const elem = document.documentElement;
      if (!document.fullscreenElement) {
        elem.requestFullscreen?.().catch(() => {
          // Browser may block fullscreen without user gesture
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportViolation("FULLSCREEN_EXIT");
        // Re-request fullscreen after a short delay
        setTimeout(requestFullscreen, 1000);
      }
    };

    // --- Copy/paste blocking ---
    const handleCopyPaste = (e: Event) => {
      // Allow copy/paste within Monaco editor
      const target = e.target as HTMLElement;
      if (target?.closest?.(".monaco-editor")) return;

      e.preventDefault();
      reportViolation("COPY_PASTE");
    };

    // --- Right-click disable ---
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // --- Keyboard shortcut blocking ---
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow keyboard shortcuts within Monaco editor
      const target = e.target as HTMLElement;
      if (target?.closest?.(".monaco-editor")) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Block: Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+U, Ctrl+Shift+I, F12
      if (ctrl && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        reportViolation("COPY_PASTE");
        return;
      }
      if (ctrl && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        reportViolation("COPY_PASTE");
        return;
      }
      if (ctrl && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        return;
      }
      if (ctrl && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        return;
      }
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }
      if (ctrl && e.shiftKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        return;
      }
    };

    // Register all listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    // Request fullscreen on mount
    requestFullscreen();

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);

      // Exit fullscreen on unmount
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [attemptId, reportViolation]);

  return { violations, warningMessage };
}

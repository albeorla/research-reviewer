// Preline is a vanilla JS UI library that mounts behaviors onto data-attribute
// driven markup. In a React app we re-run autoInit on every route change so
// dynamically rendered Preline components (modals, tabs, dropdowns) wire up
// correctly.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface PrelineGlobals {
  HSStaticMethods?: { autoInit: () => void };
}

declare const window: Window & PrelineGlobals;

export async function loadPreline(): Promise<void> {
  // Dynamic import keeps Preline out of the initial critical path.
  await import("preline/preline");
}

export function usePrelineAutoInit(): void {
  const location = useLocation();
  useEffect(() => {
    // Preline attaches HSStaticMethods to window once loaded.
    const id = window.setTimeout(() => {
      window.HSStaticMethods?.autoInit();
    }, 0);
    return () => window.clearTimeout(id);
  }, [location.pathname]);
}

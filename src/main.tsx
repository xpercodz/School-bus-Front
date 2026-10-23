import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted fonts. Imported before globals.css so the @font-face rules are
// in place when the theme's font stacks resolve.
//
// One Latin grotesk (IBM Plex Sans) plus its Arabic sibling gives the
// dashboard, the driver roster and Arabic mode a single voice. Figures are set
// in IBM Plex Sans with tabular numerals, so times and counts stay aligned
// without a second monospace face. See AGENTS.md "Convenções" / "Fonts" for the
// precache constraints.
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";

import { App } from "@/App";
import { installEntranceSkip } from "@/lib/motion";
import { requestPersistentStorage } from "@/lib/persistent-storage";
import { reloadOnServiceWorkerUpdate } from "@/lib/service-worker";
import "@/globals.css";

// Fire-and-forget: requests an eviction exemption for the IndexedDB cache that
// holds unsent attendance writes. Startup must not wait on it (see the module).
void requestPersistentStorage();

// Keeps an open page from running stale JS against a freshly deployed worker's
// precache (see the module for the failure this prevents).
reloadOnServiceWorkerUpdate();

// A screen entrance longer than ~400ms gets an out: the first pointer/key/scroll
// finishes whatever entrance is still running (see src/lib/motion.ts).
installEntranceSkip();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

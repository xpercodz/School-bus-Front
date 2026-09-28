import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Self-hosted fonts (replacing next/font). Imported before globals.css so the
// @font-face rules are in place when the theme's font stacks resolve.
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";

import { App } from "@/App";
import "@/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container #root is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

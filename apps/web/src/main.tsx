import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/providers";
import { loadPreline } from "./lib/preline";
import "./styles/app.css";

// Load Preline JS once before mounting the app so HSStaticMethods is available.
loadPreline().finally(() => {
  const root = document.getElementById("root");
  if (!root) throw new Error("#root element not found");
  createRoot(root).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
});

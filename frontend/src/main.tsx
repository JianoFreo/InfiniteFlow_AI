import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./lib/auth";
import { SettingsProvider } from "./lib/settings";
import { UsageProvider } from "./lib/usage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <UsageProvider>
          <App />
        </UsageProvider>
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>,
);

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { ThemeProvider } from "@/components/theme-provider";

// Register service worker
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="tracktos-theme">
    <App />
  </ThemeProvider>
);


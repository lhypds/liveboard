import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "ress";
import "./global.css";
import "./i18n/index.js";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

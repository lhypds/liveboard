import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "ress";
import "./global.css";
import "./i18n/index.js";
import App from "./App.tsx";
import { preventInputZoom } from "./utils/preventInputZoom.ts";

preventInputZoom();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

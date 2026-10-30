import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { RouterProvider } from "./router";
import { ToastProvider } from "./ui/Bits";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/den.css";
import "./styles/pages.css";

const root = document.getElementById("root");
if (!root) throw new Error("ROOT_MISSING");

createRoot(root).render(
  <StrictMode>
    <RouterProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </RouterProvider>
  </StrictMode>,
);

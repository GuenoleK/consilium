import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./shared/styles/reset.scss";
import "./shared/styles/globals.scss";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

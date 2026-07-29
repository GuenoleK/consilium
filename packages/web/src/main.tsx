import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./shared/styles/reset.scss";
import "./shared/styles/globals.scss";
// Consilium is also used through Vite's development server on mobile. StrictMode
// deliberately mounts and runs effects twice in that environment, which starts
// duplicate initial synchronisations and can disrupt a draft while the app opens.
createRoot(document.getElementById("root")!).render(<App />);

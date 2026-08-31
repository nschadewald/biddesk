import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import HowToTest from "./HowToTest";
import "./styles.css";

// Two pages, no router: the Worker serves index.html for any path, and the one
// other page this application has is picked here. A router would be a
// dependency in exchange for nothing.
const page =
  window.location.pathname.replace(/\/+$/, "") === "/how-to-test" ? <HowToTest /> : <App />;

createRoot(document.getElementById("root")!).render(<StrictMode>{page}</StrictMode>);

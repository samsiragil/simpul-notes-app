import React from "react";
import ReactDOM from "react-dom/client";
import "./config/style"; // memuat font
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/note.css";
import App from "./App";
import { initRepo } from "./db";
import { useApp } from "./store/app";
import { useSettings } from "./store/settings";

async function boot() {
  await useSettings.getState().init();
  try {
    await initRepo();
    await useApp.getState().init();
  } catch (e) {
    useApp.setState({ error: String(e), ready: true });
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

void boot();

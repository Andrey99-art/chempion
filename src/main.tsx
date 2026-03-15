// src/main.tsx
//
// Точка входа React-приложения.
// StrictMode — режим разработки, дважды вызывает рендер для поиска багов.
// В production он не влияет на производительность.

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css"; // Tailwind CSS стили

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
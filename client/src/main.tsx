import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add font loading
const fontStylesheet = document.createElement('link');
fontStylesheet.rel = 'stylesheet';
fontStylesheet.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@300;400;500&display=swap';
document.head.appendChild(fontStylesheet);

// Add page title
const titleElement = document.createElement('title');
titleElement.textContent = 'Golden Pearl Radio Dubai';
document.head.appendChild(titleElement);

// Add favicon
const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/svg+xml';
favicon.href = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 32 32"%3E%3Crect width="32" height="32" fill="%23F05E31" rx="4"/%3E%3Cpath fill="%23F2E4C9" d="M16 26c5.523 0 10-4.477 10-10S21.523 6 16 6 6 10.477 6 16s4.477 10 10 10Z"/%3E%3Cpath fill="%23F05E31" d="M16 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"/%3E%3Cpath fill="%23F2E4C9" d="M18 16a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/%3E%3C/svg%3E';
document.head.appendChild(favicon);

createRoot(document.getElementById("root")!).render(<App />);

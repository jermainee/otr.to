import * as React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Chat from "./src/Chat";
import InstallButton from "./src/InstallButton";

import "./src/bulma.scss";
// After bulma, so they override it.
import "./src/theme.css";
import "./src/chat.css";

createRoot(document.getElementById("root")).render(
    <Router>
        <Routes>
            <Route path="/" element={<Chat />} />
        </Routes>
    </Router>
);

createRoot(document.getElementById("install")).render(<InstallButton />);

// Opens the app without a connection and makes it installable (public/sw.js).
// After the page has loaded, so it doesn't compete with it for bandwidth.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

import * as React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Chat from "./src/Chat";

import "bulma";
import "./github-button.js";

createRoot(document.getElementById("root")).render(
    <Router>
        <Routes>
            <Route path="/" element={<Chat />} />
        </Routes>
    </Router>
);

import * as React from "react";
import * as ReactDOM from "react-dom";
import { BrowserRouter as Router, Route } from "react-router-dom";
import Chat from "./src/Chat";

import "bulma";
import "./github-button.js";

ReactDOM.render(
    <Router>
        <div>
            <Route path="/" exact component={Chat} />
        </div>
    </Router>,
    document.getElementById("root")
);

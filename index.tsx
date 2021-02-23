import * as React from "react";
import * as ReactDOM from "react-dom";
import { BrowserRouter as Router, Route } from "react-router-dom";
import Chat from "./src/Chat";
import NotFound from "./src/NotFound";

import "bulma";

ReactDOM.render(
    <Router>
        <div>
            <Route path="/" exact component={Chat} />
            <Route component={NotFound} />
        </div>
    </Router>,
    document.getElementById("root")
);

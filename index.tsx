import * as React from "react";
import * as ReactDOM from "react-dom";
import { BrowserRouter as Router, Route } from "react-router-dom";
import Chat from "./src/Chat";
import Shout from "./src/Shout";

import "bulma";
import "./github-button.js";

ReactDOM.render(
    <Router>
        <div>
            <Route path="/c/:code" render={(props) => <Chat code={props.match.params.code} />} />
            <Route path="/shout/:room?" render={(props) => <Shout room={props.match.params.room} />} />
            <Route path="/" exact component={Chat} />
        </div>
    </Router>,
    document.getElementById("root")
);
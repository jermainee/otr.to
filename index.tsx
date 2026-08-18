import * as React from "react";
import * as ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import Chat from "./src/Chat";

import "bulma";
import "./github-button.js";

function ShoutPlaceholder() {
    return (
        <div className="container content" style={{ padding: '2rem', textAlign: 'center' }}>
            <h1 className="title is-4">Shout</h1>
            <p>Room-based group chat is coming soon.</p>
            <Link to="/" className="button is-primary">Back to chat</Link>
        </div>
    );
}

ReactDOM.render(
    <Router>
        <div>
            <Route path="/c/:code" render={(props) => <Chat code={props.match.params.code} />} />
            <Route path="/shout" component={ShoutPlaceholder} />
            <Route path="/" exact component={Chat} />
        </div>
    </Router>,
    document.getElementById("root")
);
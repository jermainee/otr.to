import * as React from "react";

export default class NotFound extends React.Component {
    public render() {
        return (
            <div className="hero is-large has-text-centered">
                <div className="hero-body">
                    <div className="title">404</div>
                    <div className="subtitle">Page not found</div>
                    <a className="button is-primary" href="/" title="Start chatting">Start chatting</a>
                </div>
            </div>
        );
    }
}

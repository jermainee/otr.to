import * as React from "react";
import Message from "./Struct/Message";

interface IMessagesProps {
    messages: Message[];
}

export default class Messages extends React.Component<IMessagesProps> {
    public render() {
        return (
            <div className="messages" style={{ height: '100%', width: '100%' }}>
                {this.props.messages.map((message, index) => {
                    if (message.isSystem) {
                        return (
                            <div key={index}
                                 className="has-text-centered"
                                 style={{ padding: '.5rem', fontSize: '.8rem' }}
                            >
                                { message.text }
                            </div>
                        );
                    }

                    return (
                        <div key={index}
                             className={ message.isSender ? 'has-text-right' : 'has-text-left' }
                             style={{ padding: '.5rem' }}
                        >
                            <span className={ "tag is-medium " + (message.isSender ? 'is-success' : 'is-light') }>
                                { message.text }
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }
}

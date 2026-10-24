import * as React from "react";
import Message from "./Struct/Message";
import FileTransfer from "./Struct/FileTransfer";
import ChatHelper from "./Service/ChatHelper";
import {FileIcon} from "./Icons";

interface IMessagesProps {
    messages: Message[];
    transfers: Map<string, FileTransfer>;
    /** Whether to name who wrote what, which a chat of more than two people needs. */
    showAuthors: boolean;
    onDownload: (transfer: FileTransfer) => void;
}

/** Whether two neighbouring messages come from the same person and run together. */
const sameAuthor = (a: Message | undefined, b: Message | undefined): boolean =>
    a !== undefined && b !== undefined && !a.isSystem && !b.isSystem
    && a.isSender === b.isSender && a.author === b.author;

export default class Messages extends React.Component<IMessagesProps> {
    public render() {
        const {messages, showAuthors} = this.props;

        return (
            <div className="chat-log" role="log" aria-label="Conversation">
                {messages.map((message, index) => {
                    if (message.isSystem) {
                        return <p key={index} className="chat-notice">{message.text}</p>;
                    }

                    const isFollowed = sameAuthor(message, messages[index + 1]);
                    const name = showAuthors && message.author !== null ? ChatHelper.nickname(message.author) : null;
                    const classes = [
                        'chat-row',
                        message.isSender ? 'is-own' : 'is-peer',
                        sameAuthor(messages[index - 1], message) ? 'is-continued' : '',
                        isFollowed ? 'is-followed' : '',
                    ];

                    return (
                        <div key={index} className={classes.filter(Boolean).join(' ')}>
                            <span className="is-sr-only">{message.isSender ? 'You' : name ?? 'They'}: </span>
                            {message.fileId === null
                                ? <p className="chat-bubble chat-text">{message.text}</p>
                                : this.renderFile(message.fileId)}
                            {/* Once under the last message of a run; screen readers heard it up front. */}
                            {name !== null && !isFollowed && (
                                <p className="chat-author" aria-hidden="true">{name}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    private renderFile(fileId: string) {
        const transfer = this.props.transfers.get(fileId);

        if (transfer === undefined) {
            return null;
        }

        const isIncoming = transfer.direction === 'incoming';
        const canSave = isIncoming && transfer.isComplete && !transfer.isSaved;

        return (
            <div className="chat-bubble chat-file">
                <span className="icon chat-file-icon"><FileIcon/></span>
                <div className="chat-file-body">
                    <p className="chat-file-name">{transfer.name}</p>
                    <p className="chat-file-meta">
                        {ChatHelper.formatFileSize(transfer.size)}, {this.describe(transfer)}
                    </p>
                    {isIncoming && !transfer.isComplete && (
                        <progress className="progress is-small is-primary" value={transfer.progress} max={100}
                                  aria-label={'Receiving ' + transfer.name}>
                            {transfer.progress}%
                        </progress>
                    )}
                    {canSave && (
                        <button type="button" className="button is-small is-primary"
                                onClick={() => this.props.onDownload(transfer)}>
                            Download
                        </button>
                    )}
                </div>
            </div>
        );
    }

    private describe(transfer: FileTransfer): string {
        if (transfer.direction === 'outgoing') {
            return transfer.isComplete ? 'sent' : 'sending';
        }

        if (!transfer.isComplete) {
            return transfer.progress + '% received';
        }

        return transfer.isSaved ? 'saved' : 'received';
    }
}

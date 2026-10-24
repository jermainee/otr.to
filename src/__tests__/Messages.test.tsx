import * as React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import Messages from "../Messages";
import Message from "../Struct/Message";
import FileTransfer from "../Struct/FileTransfer";

const transfer = (changes: Partial<FileTransfer> = {}): FileTransfer => ({
    id: 'file-1',
    name: 'notes.txt',
    size: 2048,
    type: 'text/plain',
    direction: 'incoming',
    chunks: [],
    totalChunks: 1,
    receivedChunks: 0,
    isComplete: false,
    isSaved: false,
    progress: 0,
    ...changes,
});

const renderMessages = (messages: Message[], transfers: FileTransfer[] = [], onDownload = jest.fn()) =>
    render(<Messages messages={messages}
                     transfers={new Map(transfers.map(file => [file.id, file]))}
                     onDownload={onDownload}/>);

const row = (text: string) => screen.getByText(text).closest('.chat-row');

describe('Messages', () => {
    it('renders nothing for an empty conversation', () => {
        const {container} = renderMessages([]);

        expect(container.querySelector('.chat-log').children).toHaveLength(0);
    });

    it('puts own messages on one side and the peer’s on the other', () => {
        renderMessages([new Message('mine', true), new Message('theirs', false)]);

        expect(row('mine')).toHaveClass('is-own');
        expect(row('theirs')).toHaveClass('is-peer');
    });

    it('tells screen readers who said what', () => {
        renderMessages([new Message('mine', true), new Message('theirs', false)]);

        expect(row('mine')).toHaveTextContent('You: mine');
        expect(row('theirs')).toHaveTextContent('They: theirs');
    });

    it('runs consecutive messages from one side together', () => {
        renderMessages([new Message('one', true), new Message('two', true), new Message('reply', false)]);

        expect(row('one')).toHaveClass('is-followed');
        expect(row('one')).not.toHaveClass('is-continued');
        expect(row('two')).toHaveClass('is-continued');
        expect(row('two')).not.toHaveClass('is-followed');
        expect(row('reply').className).toBe('chat-row is-peer');
    });

    it('shows system messages as notices outside any bubble', () => {
        renderMessages([new Message('You’re connected.', true, true)]);

        const notice = screen.getByText('You’re connected.');

        expect(notice).toHaveClass('chat-notice');
        expect(notice.closest('.chat-bubble')).toBeNull();
    });

    it('keeps the order it was given', () => {
        renderMessages([new Message('first', true), new Message('second', false)]);

        expect(screen.getByText('first').compareDocumentPosition(screen.getByText('second')))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('shows a file in the conversation with its size and progress', () => {
        renderMessages([new Message('notes.txt', false, false, 'file-1')], [transfer({progress: 40})]);

        expect(row('notes.txt')).toHaveClass('is-peer');
        expect(screen.getByText('2 KB, 40% received')).toBeInTheDocument();
        expect(screen.getByRole('progressbar', {name: 'Receiving notes.txt'})).toHaveValue(40);
    });

    it('offers a received file for download, and only once', () => {
        const onDownload = jest.fn();
        const received = transfer({isComplete: true, progress: 100});

        const {rerender} = renderMessages([new Message('notes.txt', false, false, 'file-1')], [received], onDownload);
        fireEvent.click(screen.getByRole('button', {name: 'Download'}));

        expect(onDownload).toHaveBeenCalledWith(received);

        rerender(<Messages messages={[new Message('notes.txt', false, false, 'file-1')]}
                           transfers={new Map([['file-1', {...received, isSaved: true}]])}
                           onDownload={onDownload}/>);

        expect(screen.queryByRole('button', {name: 'Download'})).not.toBeInTheDocument();
        expect(screen.getByText('2 KB, saved')).toBeInTheDocument();
    });

    it('shows an own file as sending, then sent', () => {
        const message = new Message('notes.txt', true, false, 'file-1');
        const {rerender} = renderMessages([message], [transfer({direction: 'outgoing'})]);

        expect(row('notes.txt')).toHaveClass('is-own');
        expect(screen.getByText('2 KB, sending')).toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

        rerender(<Messages messages={[message]}
                           transfers={new Map([['file-1', transfer({direction: 'outgoing', isComplete: true})]])}
                           onDownload={jest.fn()}/>);

        expect(screen.getByText('2 KB, sent')).toBeInTheDocument();
    });
});

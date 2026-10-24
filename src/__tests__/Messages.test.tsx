import * as React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import Messages from "../Messages";
import ChatHelper from "../Service/ChatHelper";
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

const renderMessages = (messages: Message[], transfers: FileTransfer[] = [], onDownload = jest.fn(), showAuthors = false) =>
    render(<Messages messages={messages}
                     transfers={new Map(transfers.map(file => [file.id, file]))}
                     showAuthors={showAuthors}
                     onDownload={onDownload}/>);

const renderGroup = (messages: Message[]) => renderMessages(messages, [], jest.fn(), true);

/** A message from someone else in the chat. */
const from = (author: string, text: string) => new Message(text, false, false, null, author);

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
                           showAuthors={false}
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
                           showAuthors={false}
                           onDownload={jest.fn()}/>);

        expect(screen.getByText('2 KB, sent')).toBeInTheDocument();
    });
});

describe('Messages in a group', () => {
    const otter = ChatHelper.nickname('otter-peer-id');
    const owl = ChatHelper.nickname('owl-peer-id');

    it('names nobody while it is just the two of you', () => {
        renderMessages([from('otter-peer-id', 'hi'), new Message('hello', true)]);

        expect(document.querySelector('.chat-author')).toBeNull();
        expect(row('hi')).toHaveTextContent('They: hi');
    });

    it('names who wrote a message, small and under the bubble', () => {
        renderGroup([from('otter-peer-id', 'hi')]);

        const name = row('hi').querySelector('.chat-author');

        expect(name).toHaveTextContent(otter);
        expect(name.previousElementSibling).toHaveClass('chat-bubble');
    });

    it('names a run of messages once, under its last one', () => {
        renderGroup([from('otter-peer-id', 'one'), from('otter-peer-id', 'two')]);

        expect(row('one').querySelector('.chat-author')).toBeNull();
        expect(row('two').querySelector('.chat-author')).toHaveTextContent(otter);
    });

    it('does not run two people’s messages together', () => {
        renderGroup([from('otter-peer-id', 'one'), from('owl-peer-id', 'two')]);

        expect(row('one')).not.toHaveClass('is-followed');
        expect(row('two')).not.toHaveClass('is-continued');
        expect(row('one').querySelector('.chat-author')).toHaveTextContent(otter);
        expect(row('two').querySelector('.chat-author')).toHaveTextContent(owl);
    });

    it('does not name own messages', () => {
        renderGroup([new Message('mine', true)]);

        expect(row('mine').querySelector('.chat-author')).toBeNull();
        expect(row('mine')).toHaveTextContent('You: mine');
    });

    it('tells screen readers the name up front instead of “They”', () => {
        renderGroup([from('otter-peer-id', 'hi')]);

        expect(row('hi').querySelector('.is-sr-only')).toHaveTextContent(otter + ':');
        expect(row('hi').querySelector('.chat-author')).toHaveAttribute('aria-hidden', 'true');
    });

    it('names who sent a file, too', () => {
        renderMessages([new Message('notes.txt', false, false, 'file-1', 'owl-peer-id')], [transfer()], jest.fn(), true);

        expect(row('notes.txt').querySelector('.chat-author')).toHaveTextContent(owl);
    });
});

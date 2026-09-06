import * as React from "react";
import {render, screen} from "@testing-library/react";
import Messages from "../Messages";
import Message from "../Struct/Message";

describe('Messages', () => {
    it('renders nothing for an empty conversation', () => {
        const {container} = render(<Messages messages={[]}/>);

        expect(container.querySelector('.messages').children).toHaveLength(0);
    });

    it('aligns own messages right and the peer’s left', () => {
        render(<Messages messages={[new Message('mine', true), new Message('theirs', false)]}/>);

        expect(screen.getByText('mine').closest('div')).toHaveClass('has-text-right');
        expect(screen.getByText('theirs').closest('div')).toHaveClass('has-text-left');
    });

    it('marks own messages with the primary tag colour', () => {
        render(<Messages messages={[new Message('mine', true), new Message('theirs', false)]}/>);

        expect(screen.getByText('mine')).toHaveClass('is-primary');
        expect(screen.getByText('theirs')).toHaveClass('is-light');
    });

    it('centres system messages and leaves them untagged', () => {
        render(<Messages messages={[new Message('Connected to Peer', true, true)]}/>);

        const systemMessage = screen.getByText('Connected to Peer');

        expect(systemMessage).toHaveClass('has-text-centered');
        expect(systemMessage.querySelector('.tag')).toBeNull();
    });

    it('keeps the order it was given', () => {
        render(<Messages messages={[new Message('first', true), new Message('second', false)]}/>);

        expect(screen.getByText('first').compareDocumentPosition(screen.getByText('second')))
            .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
});

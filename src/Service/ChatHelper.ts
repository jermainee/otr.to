export default class ChatHelper
{
    public static generatePeerId(): string
    {
        return Math.random().toString(36).substring(2, 15)
            + 'otrto'
            + Math.random().toString(36).substring(2, 15);
    }
}

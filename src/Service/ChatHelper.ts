export default class ChatHelper
{
    public static generatePeerId(): string
    {
        return 'otrto' + Math.random().toString(36).substring(2, 15)
            + Math.random().toString(36).substring(2, 15);
    }
}

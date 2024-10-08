export default class ChatHelper
{
    public static generatePeerId(): string
    {
        return Math.random().toString(36).substring(2, 24);
    }
}

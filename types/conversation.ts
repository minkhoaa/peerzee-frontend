
export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    seq: string;
}

export interface Conversation {
    id: string;
    type: string;
    lastMessageAt: string | null;
    lastSeq: string;
}
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Socket } from "socket.io-client";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import api from "@/lib/api";

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    seq: string;
    createdAt: string;
    updatedAt: string;
}

interface Conversation {
    id: string;
    type: string;
    lastMessageAt: string | null;
    lastSeq: string;
    name?: string;
    lastMessage?: string;
}

export default function ChatPage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newUserId, setNewUserId] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const [newConvName, setNewConvName] = useState("");
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const uid = localStorage.getItem("userId");
        if (!token || !uid) {
            router.push("/login");
            return;
        }
        setUserId(uid);
        const socket = connectSocket(token);
        socketRef.current = socket;
        socket.on("connect", () => {
            console.log("Connected to socket");
            setIsConnected(true)
        });
        socket.on("disconnect", () => {
            console.log("Disconnected from socket");
            setIsConnected(false)
        });
        socket.on("message:new", (data) => {
            console.log("Received message", data);
            setMessages((prev) => {
                if (prev.some(m => m.id === data.id))
                    return prev;
                return [...prev, data];
            });
            setConversations(prev => prev.map(c => c.id === data.conversation_id ?
                { ...c, lastMessage: data.body, lastMessageAt: data.createdAt } : c))
        });
        socket.on('conversation:new', (data) => {
            console.log("Received conversation", data);
            setConversations((prev) => {
                if (prev.some(c => c.id === data.id)) return prev;
                return [...prev, data];
            });
        });


        setLoading(false);
        return () => {
            disconnectSocket();
        }
    }, [router]);
    useEffect(() => {
        if (!userId) return;
        const loadConversations = async () => {
            const res = await api.get<Conversation[]>(`/conversation`);
            setConversations(res.data);
        }
        loadConversations();
    }, [userId]);

    const handleLogout = () => {
        localStorage.clear();
        router.push("/login");
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeConversation || !socketRef.current) return;
        socketRef.current.emit("conversation:send", {
            conversation_id: activeConversation.id,
            body: newMessage,
        });

        setNewMessage("");
    };

    const handleCreate = () => {
        if (!newUserId.trim() || !socketRef.current) return;
        socketRef.current.emit("conversation:create", {
            type: 'private',
            name: newConvName.trim(),
            participantUserIds: [newUserId.trim()],
        },
            (response: {
                conversationId: string, type: string, name: string,
                lastMessageAt: string | null, lastSeq: string
            }) => {
                const newConv: Conversation = {
                    id: response.conversationId,
                    type: response.type,
                    lastMessageAt: response.lastMessageAt,
                    lastSeq: response.lastSeq,
                    name: response.name,
                }

                setActiveConversation(newConv);
            }
        );
        setNewUserId("");
        setNewConvName("");
        setShowModal(false);
    };

    const handleSelectConversation = (conv: Conversation) => {
        setActiveConversation(conv);
        socketRef.current?.emit("conversation:join", { conversation_id: conv.id },
            (messages: Message[]) => {
                setMessages(messages || []);
            });
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold text-gray-800">Peerzee
                            <span className={`ml-2 text-xs ${isConnected ? "text-green-500" : "text-red-500"}`}>
                                {isConnected ? "●" : "○"}
                            </span>                        </span>
                        <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                            Logout
                        </button>
                    </div>
                    <button onClick={() => setShowModal(true)} className="w-full py-2.5 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors">
                        + New Chat
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversations.map((c) => (
                        <div
                            key={c.id}
                            onClick={() => { handleSelectConversation(c); }}
                            className={`px-4 py-3 cursor-pointer transition-colors ${activeConversation?.id === c.id ? "bg-gray-100" : "hover:bg-gray-50"}`}
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-800">{c.name}</span>
                                <div className="flex justify-between">
                                    <span className="text-xs  text-gray-500">{c.lastMessage}</span>
                                    <span className="text-xs text-gray-500">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">User: {userId?.slice(0, 12)}...</p>
                </div>
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col">
                {activeConversation ? (
                    <>
                        <div className="px-6 py-4 bg-white border-b border-gray-200">
                            <h2 className="font-semibold text-gray-800">{activeConversation.name}</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 flex flex-col">
                            {messages.map((m) => (
                                <div key={m.id} className={`mb-3 flex flex-col ${m.sender_id === userId ? "items-end" : "items-start"}`}>
                                    <span className={`inline-block px-4 py-2.5 rounded-2xl text-sm ${m.sender_id === userId ? "bg-gray-800 text-white" : "bg-white text-gray-800 border border-gray-200"}`}>
                                        {m.body}
                                    </span>
                                    <span className="text-xs text-gray-400 mt-1">{new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200">
                            <div className="flex gap-3">
                                <input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent"
                                />
                                <button type="submit" className="px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors">
                                    Send
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-gray-500">Select a conversation to start chatting</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-xl w-80 shadow-lg">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">New Chat</h3>
                        {/* Input tên conversation */}
                        <input
                            value={newConvName}
                            onChange={(e) => setNewConvName(e.target.value)}
                            placeholder="Conversation name"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800 mb-3"
                        />
                        <input
                            value={newUserId}
                            onChange={(e) => setNewUserId(e.target.value)}
                            placeholder="Enter User ID"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800 mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleCreate} className="flex-1 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors">
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

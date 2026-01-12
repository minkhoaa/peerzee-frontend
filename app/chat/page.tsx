"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
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
    isEdited?: boolean;
    isDeleted?: boolean;
}

interface Conversation {
    id: string;
    type: string;
    lastMessageAt: string | null;
    lastSeq: string;
    name?: string;
    lastMessage?: string;
    participantIds?: string[];
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
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState<string>("");
    const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef(false);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ id: string, email: string, fullName?: string }[]>([]);
    const [searching, setSearching] = useState(false);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await api.get(`/user/search?q=${encodeURIComponent(searchQuery)}`);
                setSearchResults(res.data);
            } catch (err) {
                console.error(err);
            }
            setSearching(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);
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
        socket.on('typing:update', (data: {
            conversation_id: string, user_id: string; isTyping: boolean
        }) => {
            console.log("Received typing update", data);
            setTypingUsers((prev) => {
                const current = prev[data.conversation_id] || [];
                if (data.isTyping) {
                    if (!current.includes(data.user_id)) {
                        return {
                            ...prev,
                            [data.conversation_id]: [...current, data.user_id]
                        };
                    }
                } else {
                    return {
                        ...prev,
                        [data.conversation_id]: prev[data.conversation_id].filter((id) => id !== data.user_id)
                    };
                }
                return prev;
            });
        })
        socket.on('message:edit', (data: {
            id: string,
            body: string,
            isEdited: boolean,
            conversation_id: string
        }) => {
            console.log("Received message edit", data);
            setMessages(prev => prev.map(k => k.id === data.id ? { ...k, body: data.body, isEdited: data.isEdited } : k))
        })
        socket.on('message:delete', (data: {
            id: string,
            conversation_id: string
        }) => {
            console.log("Received message delete", data);
            setMessages(prev => prev.map(k => k.id === data.id ? { ...k, isDeleted: true } : k))
        })
        socket.on('user:online-list', (userIds: string[]) => setOnlineUsers(new Set(userIds)))

        socket.on('user:online', ({ userId, isOnline }: { userId: string, isOnline: boolean }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (isOnline)
                    next.add(userId);
                else
                    next.delete(userId);
                return next;
            })
        })

        setLoading(false);
        return () => {
            disconnectSocket();
            socket.off('user:online-list')
            socket.off('user:online')
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
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        if (!activeConversation || !socketRef.current) return;
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socketRef.current.emit('typing:start', {
                conversation_id: activeConversation.id
            })
        }
        if (typingTimeoutRef.current)
            clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            socketRef.current?.emit('typing:stop', {
                conversation_id: activeConversation.id
            })
        }, 1000);
    };


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
        if (typingTimeoutRef.current)
            clearTimeout(typingTimeoutRef.current);
        if (isTypingRef.current && activeConversation)
            isTypingRef.current = false;
        socketRef.current?.emit('typing:stop', {
            conversation_id: activeConversation.id
        })
        setNewMessage("");
    };
    const handleEdit = (m: Message) => {
        if (!activeConversation || !socketRef.current) return;
        socketRef.current.emit("message:edit", {
            message_id: m.id,
            body: m.body.trim(),
            conversation_id: activeConversation.id,
        });
    };
    const handleEditClick = (m: Message) => {
        setEditingMessageId(m.id);
        setEditContent(m.body);
    };
    const handleEditSubmit = () => {
        if (!activeConversation || !socketRef.current) return;
        socketRef.current.emit("message:edit", {
            message_id: editingMessageId,
            body: editContent.trim(),
            conversation_id: activeConversation.id,
        });
        setEditingMessageId(null);
        setEditContent("");
    };
    const handleEditCancel = () => {
        setEditingMessageId(null);
        setEditContent("");
    };
    const handleDelete = (m: Message) => {
        if (!activeConversation || !socketRef.current) return;
        socketRef.current.emit("message:delete", {
            message_id: m.id,
            conversation_id: activeConversation.id,
        });
    };
    const TypingIndicator = () => {
        const typing = activeConversation ? typingUsers[activeConversation.id] || [] : [];
        return (
            <div className="px-4 py-2 text-sm text-gray-500 italic animate-pulse">
                {typing.length === 1
                    ? `${typing[0].slice(0, 8)}... is typing...`
                    : `${typing.length >= 1 ? typing.length + 'people are typing' : ''}`}
            </div>
        );
    }
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
        <div className="flex h-screen bg-white">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-base font-semibold text-gray-800">Peerzee
                            <span className={`ml-2 text-[10px] ${isConnected ? "text-green-500" : "text-gray-300"}`}>
                                {isConnected ? "●" : "○"}
                            </span>
                        </span>
                        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                            Logout
                        </button>
                    </div>
                    <button onClick={() => setShowModal(true)} className="w-full py-2 text-sm font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
                        + New Chat
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversations.map((c) => {
                        const otherUserId = c.participantIds?.find(id => id !== userId) || '';
                        return (
                            <div
                                key={c.id}
                                onClick={() => { handleSelectConversation(c); }}
                                className={`px-3 py-2.5 cursor-pointer transition-colors flex gap-2.5 ${activeConversation?.id === c.id ? "bg-gray-100" : "hover:bg-gray-50"}`}
                            >


                                <div className="relative">

                                    <div className="flex justify-center items-center rounded-md w-8 h-8 bg-gray-100 text-gray-600 font-medium text-xs shrink-0">
                                        {c.name?.slice(0, 1)?.toUpperCase() || c.type}
                                    </div>
                                    <div className={`absolute bottom-0.5 -left-0.5 border-2 p-1 border-white w-2 h-2 rounded-full ${onlineUsers.has(otherUserId) ? "bg-green-500" : "bg-gray-300"}`} />
                                </div>

                                <div className="flex flex-1 flex-col min-w-0">
                                    <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                                    <div className="flex justify-between gap-2">
                                        <span className="text-xs text-gray-400 truncate">{c.lastMessage}</span>
                                        <span className="text-[10px] text-gray-400 shrink-0">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="p-3 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400">User: {userId?.slice(0, 12)}...</p>
                </div>
            </div>

            {/* Main */}
            < div className="flex-1 flex flex-col bg-[#FAFAFA]" >
                {
                    activeConversation ? (
                        <>
                            <div className="px-5 py-3 bg-white border-b border-gray-200">
                                <h2 className="text-sm font-semibold text-gray-800">{activeConversation.name}</h2>
                            </div>

                            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col">

                                {messages.map((m) => (
                                    <div key={m.id} className={`mb-3 flex group relative flex-col ${m.sender_id === userId ? "items-end" : "items-start"}`}>
                                        {m.isDeleted ? (
                                            <span className="text-xs text-gray-400 italic py-2">
                                                Message deleted
                                            </span>) : editingMessageId === m.id ? (<div className="flex flex-col gap-2 w-64">
                                                <textarea
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none bg-white"
                                                    rows={2}
                                                    autoFocus
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={handleEditCancel}
                                                        className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleEditSubmit}
                                                        className="px-3 py-1 text-xs bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>) : (
                                            <div className={`relative max-w-[75%] px-3.5 py-2.5 text-sm ${m.sender_id === userId ? "bg-[#1F1F1F] text-white rounded-lg rounded-br-sm" : "bg-gray-100 text-gray-700 rounded-lg rounded-bl-sm"}`}>
                                                <p className="leading-relaxed">{m.body}</p>
                                                <div className={`flex items-center gap-1 mt-1 ${m.sender_id === userId ? "justify-end" : "justify-start"}`}>
                                                    {m.isEdited && (
                                                        <span className={`text-[10px] ${m.sender_id === userId ? "text-gray-400" : "text-gray-400"}`}>(edited)</span>
                                                    )}
                                                    <span className={`text-[10px] ${m.sender_id === userId ? "text-gray-400" : "text-gray-400"}`}>
                                                        {new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {m.sender_id === userId && editingMessageId !== m.id && !m.isDeleted && (
                                            <div className="hidden group-hover:flex absolute -top-7 right-0 bg-white border border-gray-200 rounded-md overflow-hidden">
                                                <button className="px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors border-r border-gray-200" onClick={() => handleEditClick(m)}>Edit</button>
                                                <button className="px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-50 hover:text-red-500 transition-colors" onClick={() => handleDelete(m)}>Delete</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <TypingIndicator />
                            <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200">
                                <div className="flex gap-2 items-center">
                                    <input
                                        value={newMessage}
                                        onChange={handleInputChange}
                                        placeholder="Type a message..."
                                        className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 placeholder-gray-400"
                                    />
                                    <button type="submit" className="px-4 py-2 bg-[#1F1F1F] text-white text-sm font-medium rounded-md hover:bg-black transition-colors">
                                        Send
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-[#FAFAFA]">
                            <p className="text-gray-400 text-sm">Select a conversation to start chatting</p>
                        </div>
                    )
                }
            </div >

            {/* Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
                        <div className="bg-white p-5 rounded-lg w-80 border border-gray-200 shadow-lg">
                            <h3 className="text-sm font-semibold text-gray-800 mb-4">New Chat</h3>
                            {/* Input tên conversation */}
                            <input
                                value={newConvName}
                                onChange={(e) => setNewConvName(e.target.value)}
                                placeholder="Conversation name"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 mb-2 bg-gray-50"
                            />
                            {/* Search với Dropdown */}
                            <div className="relative mb-3">
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by email..."
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 bg-gray-50"
                                />

                                {/* Dropdown Results */}
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-24 overflow-y-auto z-10">
                                        {searchResults.map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => {
                                                    setNewUserId(user.id);
                                                    setSearchQuery(user.email);
                                                    setSearchResults([]);
                                                }}
                                                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 border-b border-gray-50 last:border-b-0"
                                            >
                                                <div className="font-medium text-gray-800">{user.email}</div>
                                                {user.fullName && user.fullName !== 'string' && (
                                                    <div className="text-xs text-gray-400">{user.fullName}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Loading */}
                                {searching && (
                                    <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 text-xs text-gray-400 bg-white border border-gray-200 rounded-md shadow-lg">
                                        Searching...
                                    </div>
                                )}
                            </div>

                            {/* Selected indicator */}
                            {newUserId && (
                                <p className="text-xs text-green-600 mb-3">✓ Selected: {searchQuery}</p>
                            )}

                            <div className="flex gap-2">
                                <button onClick={() => setShowModal(false)} className="flex-1 py-2 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleCreate} className="flex-1 py-2 text-sm bg-[#1F1F1F] text-white rounded-md hover:bg-black transition-colors">
                                    Create
                                </button>
                            </div>

                        </div>
                    </div>
                )
            }

        </div >
    );
}

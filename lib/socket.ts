import { io, Socket } from "socket.io-client";


let socket: Socket | null = null;
export function getSocket() {
    return socket;
}
export function connectSocket(token: string) {
    if (socket?.connected) return socket;
    socket = io('http://localhost:9000', {
        auth: { token },
        transports: ['websocket'],
    });
    return socket;
}
export function disconnectSocket() {
    if (socket?.connected) socket.disconnect();
    socket = null;
}
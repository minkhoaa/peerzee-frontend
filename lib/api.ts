import axios from "axios";
import type { LoginDto, LoginResponse, RegisterDto, RegisterResponse, UpdateUserProfileDto } from "@/types";
import { Conversation } from "@/types/conversation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000";
const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

api.interceptors.request.use(
    (config) => {
        if (typeof window !== "undefined") {
            const token = localStorage.getItem("token");
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== "undefined") {
                localStorage.removeItem("token");
                localStorage.removeItem("refreshToken");
                localStorage.removeItem("userId");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default api;

export const authApi = {
    login: (data: LoginDto) =>
        api.post<LoginResponse>("/user/login", data),

    register: (data: RegisterDto) =>
        api.post<RegisterResponse>("/user/register", data),

    getProfile: (userId: string) =>
        api.get(`/user/user-profile/${userId}`),

    updateProfile: (userId: string, data: UpdateUserProfileDto) =>
        api.put(`/user/profile/${userId}`, data),
};
export const chatApi = {
    getConversations: () => api.get<Conversation[]>("/conversation"),
};

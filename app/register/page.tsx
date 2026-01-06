"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { AxiosError } from "axios";
import type { RegisterDto } from "@/types";

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        display_name: "",
        phone: "",
        bio: "",
        location: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            const payload: RegisterDto = {
                email: formData.email,
                password: formData.password,
                display_name: formData.display_name,
                phone: formData.phone,
                bio: formData.bio,
                location: formData.location,
            };
            await authApi.register(payload);
            router.push("/login");
        } catch (err) {
            const axiosError = err as AxiosError<{ message: string }>;
            setError(axiosError.response?.data?.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent";

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
            <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-sm">
                <h1 className="text-2xl text-center font-semibold text-gray-800 mb-6">Create Account</h1>

                {error && <p className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</p>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Email</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="you@example.com" required />
                    </div>

                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Display Name</label>
                        <input type="text" name="display_name" value={formData.display_name} onChange={handleChange} className={inputClass} placeholder="John Doe" required />
                    </div>

                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Phone</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} placeholder="+84 xxx xxx xxx" required />
                    </div>

                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Password</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className={inputClass} placeholder="••••••••" minLength={6} required />
                    </div>

                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Confirm Password</label>
                        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className={inputClass} placeholder="••••••••" required />
                    </div>

                    <div className="mb-4">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Bio</label>
                        <textarea name="bio" value={formData.bio} onChange={handleChange} className={inputClass + " resize-none"} placeholder="Tell us about yourself..." rows={2} required />
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-medium text-gray-700">Location</label>
                        <input type="text" name="location" value={formData.location} onChange={handleChange} className={inputClass} placeholder="Ho Chi Minh City" required />
                    </div>

                    <button type="submit" disabled={loading} className="w-full py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:bg-gray-400">
                        {loading ? "Creating account..." : "Create Account"}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600">
                    Already have an account?{" "}
                    <Link href="/login" className="text-gray-800 font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}

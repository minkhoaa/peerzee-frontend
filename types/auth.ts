// ========== Auth DTOs ==========

// POST /user/login
export interface LoginDto {
    email: string;
    password: string;
    device: string;
}

export interface LoginResponse {
    user_id: string;
    token: string;
    refreshToken: string;
}

// POST /user/register
export interface RegisterDto {
    email: string;
    phone: string;
    password: string;
    location: string;
    display_name: string;
    bio: string;
}

export interface RegisterResponse {
    id: string;
    email: string;
    phone: string;
    profile_id: string;
}

// ========== Profile DTOs ==========

// PUT /user/profile/:user_id
export interface UpdateUserProfileDto {
    display_name: string;
    bio: string;
    location: string;
}

// POST /user/add-tag
export interface TagDto {
    tag_type: string;
    tag_value: string;
}

export interface AddTagDto {
    user_id: string;
    tags: TagDto[];
}

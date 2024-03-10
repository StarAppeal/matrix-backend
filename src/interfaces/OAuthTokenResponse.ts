export interface OAuthTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    expires_at?: number;
    error?: string;
    error_description?: string;
}
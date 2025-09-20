import axios, { AxiosError } from "axios";
import {CurrentlyPlaying} from "../interfaces/CurrentlyPlaying";

export class SpotifyApiService {
    private readonly apiUrl = "https://api.spotify.com/v1";

    public async getCurrentlyPlaying(accessToken: string): Promise<CurrentlyPlaying | null> {
        try {
            const response = await axios.get<CurrentlyPlaying>(`${this.apiUrl}/me/player/currently-playing`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                },
                params: {
                    additional_types: "episode"
                }
            });

            if (response.status === 204) {
                return null;
            }

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error("Spotify API Error:", error.response?.status, error.response?.data);
                throw error;
            }
            throw error;
        }
    }
}
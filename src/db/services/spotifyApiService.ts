import axios from "axios";

export interface CurrentlyPlaying {
    timestamp: number;
    context?: {
        type: string;
        uri: string;
    };
    progress_ms?: number;
    item?: {
        name: string;
        artists: {
            name: string;
            uri: string;
        }[];
        album: {
            name: string;
            uri: string;
        };
        duration_ms: number;
    };
    is_playing: boolean;
}


export async function getCurrentlyPlaying(accessToken: string) {
    try {
        const response = await axios.get<CurrentlyPlaying>("https://api.spotify.com/v1/me/player/currently-playing", {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }, params: {
                additional_types: "episode"
            }
        });

        if (response.status === 204) {
            console.log("Es wird gerade nichts abgespielt.");
            return null;
        }

        return response.data;
    } catch (error: any) {
        console.error("Fehler bei der Anfrage:", error.response?.status, error.response?.data);
    }
}

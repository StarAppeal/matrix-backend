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
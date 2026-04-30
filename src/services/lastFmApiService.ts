import axios from "axios";
import { MusicState } from "../interfaces/MusicState";
import logger from "../utils/logger";

export class LastFmApiService {
    private readonly apiUrl = "https://ws.audioscrobbler.com/2.0/";

    constructor(private readonly apiKey: string) {
        if (!this.apiKey) {
            logger.error("CRITICAL: LAST_FM_API_KEY is missing!");
        }
    }

    public async getCurrentlyPlaying(username: string): Promise<MusicState> {
        try {
            const response = await axios.get(this.apiUrl, {
                params: {
                    method: "user.getrecenttracks",
                    user: username,
                    api_key: this.apiKey,
                    format: "json",
                    limit: 1,
                },
            });

            const tracks = response.data?.recenttracks?.track;

            if (tracks && tracks.length > 0) {
                const latestTrack = tracks[0];
                const isPlaying = latestTrack["@attr"]?.nowplaying === "true";

                if (isPlaying) {
                    return {
                        isPlaying: true,
                        title: latestTrack.name,
                        artist: latestTrack.artist["#text"],
                        imageUrl: latestTrack.image[3]["#text"], // 3 = extralarge
                    };
                }
            }

            return { isPlaying: false };
        } catch (error) {
            logger.error(`Last.fm API Error for user ${username}:`, error);
            return { isPlaying: false };
        }
    }

    public async validateUsername(username: string): Promise<boolean> {
        try {
            const response = await axios.get(this.apiUrl, {
                params: {
                    method: "user.getinfo",
                    user: username,
                    api_key: this.apiKey,
                    format: "json",
                },
            });

            if (response.data && response.data.error === 6) {
                return false;
            }

            return !!response.data?.user;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.data && error.response.data.error === 6) {
                    return false;
                }
            }

            logger.error(`Error validating Last.fm username ${username}:`, error);
            return false;
        }
    }
}

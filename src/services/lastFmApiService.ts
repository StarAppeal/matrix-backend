import { MusicState } from "../interfaces/MusicState";
import logger from "../utils/logger";
import { HttpClient } from "../utils/httpClient";
import { LastFmRecentTracksResponse } from "../interfaces/lastFmRecentTracksResponse";

export class LastFmApiService {

    constructor(private readonly apiKey: string, private readonly httpClient: HttpClient) {
        if (!this.apiKey) {
            logger.error("CRITICAL: LAST_FM_API_KEY is missing!");
        }
    }

    public async getCurrentlyPlaying(username: string): Promise<MusicState> {
        try {
            const response = await this.httpClient.get<LastFmRecentTracksResponse>("", {
                params: {
                    method: "user.getrecenttracks",
                    user: username,
                    api_key: this.apiKey,
                    format: "json",
                    limit: 1,
                },
            });

            const tracks = response.recenttracks?.track;

            if (tracks && tracks.length > 0) {
                const latestTrack = tracks[0];
                const isPlaying = latestTrack["@attr"]?.nowplaying === "true";

                if (isPlaying) {
                    return {
                        isPlaying: true,
                        title: latestTrack.name,
                        artist: latestTrack.artist["#text"],
                        imageUrl: latestTrack.image[3]["#text"],
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
            const response = await this.httpClient.get<{
                user?: unknown;
            }>("", {
                params: {
                    method: "user.getinfo",
                    user: username,
                    api_key: this.apiKey,
                    format: "json",
                },
            });

            return !!response.user;
        } catch (_) {
            return false;
        }
    }
}

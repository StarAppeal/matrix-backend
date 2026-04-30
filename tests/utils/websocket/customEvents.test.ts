import { describe, it, expect, vi, beforeEach } from "vitest";
import { SingleMusicUpdateEvent } from "../../../src/utils/websocket/websocketCustomEvents/singleMusicUpdateEvent";
import { SingleWeatherUpdateEvent } from "../../../src/utils/websocket/websocketCustomEvents/singleWeatherUpdateEvent";
import { ExtendedWebSocket } from "../../../src/interfaces/extendedWebsocket";
import { MusicState } from "../../../src/interfaces/MusicState";
import { CurrentWeather } from "openweather-api-node";

vi.mock("../../../src/utils/logger", () => ({
    default: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe("Custom WebSocket Events", () => {
    let mockWs: ExtendedWebSocket;

    beforeEach(() => {
        mockWs = {
            send: vi.fn(),
            payload: { uuid: "test-uuid", username: "test-user" },
            user: { uuid: "test-uuid", location: { lat: 10, lon: 20 } },
        } as unknown as ExtendedWebSocket;
    });

    describe("SingleMusicUpdateEvent", () => {
        it("should send the correct JSON payload to the websocket", async () => {
            const event = new SingleMusicUpdateEvent(mockWs);
            const mockState: MusicState = { isPlaying: true, title: "Test", artist: "Artist" };

            await event.handler(mockState);

            expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "MUSIC_UPDATE", payload: mockState }), {
                binary: false,
            });
        });
    });

    describe("SingleWeatherUpdateEvent", () => {
        it("should send the correct JSON payload to the websocket", async () => {
            const event = new SingleWeatherUpdateEvent(mockWs);
            const mockWeather = { weather: { temp: { cur: 20 } } } as unknown as CurrentWeather;

            await event.handler(mockWeather);

            expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: "WEATHER_UPDATE", payload: mockWeather }), {
                binary: false,
            });
        });
    });
});

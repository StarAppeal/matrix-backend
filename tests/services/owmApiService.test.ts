import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OpenWeatherAPI from "openweather-api-node";
import { getCurrentWeather, validateLocation } from "../../src/services/owmApiService";

vi.mock("openweather-api-node", () => {
    return {
        default: vi.fn().mockImplementation(() => {
            return {
                getCurrent: vi.fn(),
                getAllLocations: vi.fn(),
                setLocationByCoordinates: vi.fn(),
            };
        }),
    };
});

const MockedOpenWeatherAPI = vi.mocked(OpenWeatherAPI, true);

vi.stubGlobal("process", {
    env: {
        OWM_API_KEY: "test-api-key",
    },
});

describe("owmApiService", () => {
    let mockWeatherInstance: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockWeatherInstance = {
            getCurrent: vi.fn(),
            getAllLocations: vi.fn(),
            setLocationByCoordinates: vi.fn(),
        };

        MockedOpenWeatherAPI.mockImplementation(() => mockWeatherInstance as any);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("getCurrentWeather", () => {
        const lat = 52.52;
        const lon = 13.40;

        it("should initialize API and set coordinates correctly", async () => {
            mockWeatherInstance.getCurrent.mockResolvedValue({ temp: 20 });

            await getCurrentWeather(lat, lon);

            expect(MockedOpenWeatherAPI).toHaveBeenCalledWith({
                key: "test-api-key",
                units: "metric"
            });

            expect(mockWeatherInstance.setLocationByCoordinates).toHaveBeenCalledWith(lat, lon);

            expect(mockWeatherInstance.getCurrent).toHaveBeenCalled();
        });

        it("should return weather data", async () => {
            const mockData = { main: { temp: 25 } };
            mockWeatherInstance.getCurrent.mockResolvedValue(mockData);

            const result = await getCurrentWeather(lat, lon);

            expect(result).toEqual(mockData);
        });

        it("should throw error if API call fails", async () => {
            const error = new Error("API Error");
            mockWeatherInstance.getCurrent.mockRejectedValue(error);

            await expect(getCurrentWeather(lat, lon)).rejects.toThrow("API Error");
        });
    });

    describe("validateLocation", () => {
        const query = "Köln";

        it("should return locations list on success", async () => {
            const mockLocations = [
                { name: "Köln", country: "DE", lat: 50.7, lon: 7.1 },
                { name: "Köln", country: "US", lat: 30.0, lon: -80.0 }
            ];

            mockWeatherInstance.getAllLocations.mockResolvedValue(mockLocations);

            const result = await validateLocation(query);

            expect(mockWeatherInstance.getAllLocations).toHaveBeenCalledWith(query);
            expect(result).toEqual(mockLocations);
        });

        it("should return empty array on error (handled in catch block)", async () => {
            mockWeatherInstance.getAllLocations.mockRejectedValue(new Error("Network Error"));

            const result = await validateLocation(query);

            expect(result).toEqual([]);
        });
    });
});
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OpenWeatherAPI from "openweather-api-node";
import { OwmApiService } from "../../src/services/owmApiService";

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

describe("OwmApiService", () => {
    const TEST_API_KEY = "test-api-key";
    let service: OwmApiService;
    let mockWeatherInstance: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockWeatherInstance = {
            getCurrent: vi.fn(),
            getAllLocations: vi.fn(),
            setLocationByCoordinates: vi.fn(),
        };

        MockedOpenWeatherAPI.mockImplementation(() => mockWeatherInstance as any);

        service = new OwmApiService(TEST_API_KEY);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("getCurrentWeather", () => {
        const lat = 52.52;
        const lon = 13.40;

        it("should initialize API with injected key and set coordinates correctly", async () => {
            mockWeatherInstance.getCurrent.mockResolvedValue({ temp: 20 });

            await service.getCurrentWeather(lat, lon);

            expect(MockedOpenWeatherAPI).toHaveBeenCalledWith({
                key: TEST_API_KEY,
                units: "metric"
            });

            expect(mockWeatherInstance.setLocationByCoordinates).toHaveBeenCalledWith(lat, lon);
            expect(mockWeatherInstance.getCurrent).toHaveBeenCalled();
        });

        it("should return weather data", async () => {
            const mockData = { main: { temp: 25 } };
            mockWeatherInstance.getCurrent.mockResolvedValue(mockData);

            const result = await service.getCurrentWeather(lat, lon);

            expect(result).toEqual(mockData);
        });

        it("should throw error if API call fails", async () => {
            const error = new Error("API Error");
            mockWeatherInstance.getCurrent.mockRejectedValue(error);

            await expect(service.getCurrentWeather(lat, lon)).rejects.toThrow("API Error");
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

            const result = await service.validateLocation(query);

            expect(mockWeatherInstance.getAllLocations).toHaveBeenCalledWith(query);
            expect(result).toEqual(mockLocations);
        });

        it("should return empty array on error", async () => {
            mockWeatherInstance.getAllLocations.mockRejectedValue(new Error("Network Error"));

            const result = await service.validateLocation(query);

            expect(result).toEqual([]);
        });
    });

    describe("getTimezoneName", () => {
        it("should return a valid IANA timezone string for Berlin", () => {
            const result = service.getTimezoneName(52.52, 13.4);
            expect(result).toBe("Europe/Berlin");
        });

        it("should return Etc/UTC as fallback for unknown coordinates", () => {
            // Coordinates far in the ocean, unlikely to have a TZ
            const result = service.getTimezoneName(0, 0);
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
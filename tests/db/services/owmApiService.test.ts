import {describe, it, expect, vi, beforeEach} from "vitest";
import OpenWeatherAPI from "openweather-api-node";
import {getCurrentWeather} from "../../../src/db/services/owmApiService";

vi.mock("openweather-api-node", () => {
    return {
        default: vi.fn().mockImplementation((ignored: any) => {
            return {
                getCurrent: vi.fn(),
            };
        }),
    };
});

const MockedOpenWeatherAPI = vi.mocked(OpenWeatherAPI, true); // true = deep mock

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
        } as Partial<OpenWeatherAPI> as OpenWeatherAPI;

        MockedOpenWeatherAPI.mockImplementation(() => mockWeatherInstance);
    });

    describe("getCurrentWeather", () => {
        it("should initialize OpenWeatherAPI with correct API key", async () => {
            const location = "Berlin";
            const mockWeatherData = {
                name: "Berlin",
                main: {
                    temp: 20.5,
                    feels_like: 19.8,
                    humidity: 65,
                    pressure: 1013,
                },
                weather: [
                    {
                        main: "Clear",
                        description: "clear sky",
                        icon: "01d",
                    },
                ],
                wind: {
                    speed: 3.2,
                    deg: 180,
                },
            };

            mockWeatherInstance.getCurrent.mockResolvedValue(mockWeatherData);

            const result = await getCurrentWeather(location);

            expect(MockedOpenWeatherAPI).toHaveBeenCalledWith({
                key: "test-api-key",
            });
            expect(result).toEqual(mockWeatherData);
        });

        it("should call getCurrent with correct parameters", async () => {
            const location = "London";
            const mockWeatherData = {
                name: "London",
                main: {temp: 15.2},
                weather: [{main: "Clouds"}],
            };

            mockWeatherInstance.getCurrent.mockResolvedValue(mockWeatherData);

            await getCurrentWeather(location);

            expect(mockWeatherInstance.getCurrent).toHaveBeenCalledWith({
                locationName: location,
                units: "metric",
            });
        });

        it("should return weather data for valid location", async () => {
            const location = "Tokyo";
            const mockWeatherData = {
                name: "Tokyo",
                main: {
                    temp: 25.3,
                    feels_like: 27.1,
                    humidity: 78,
                    pressure: 1008,
                },
                weather: [
                    {
                        main: "Rain",
                        description: "light rain",
                        icon: "10d",
                    },
                ],
                wind: {
                    speed: 2.1,
                    deg: 90,
                },
                clouds: {
                    all: 75,
                },
            };

            mockWeatherInstance.getCurrent.mockResolvedValue(mockWeatherData);

            const result:any = await getCurrentWeather(location);

            expect(result).toEqual(mockWeatherData);
            expect(result.name).toBe("Tokyo");
            expect(result.main.temp).toBe(25.3);
            expect(result.weather[0].main).toBe("Rain");
        });

        it("should handle API errors", async () => {
            const location = "InvalidLocation";
            const apiError = new Error("City not found");

            mockWeatherInstance.getCurrent.mockRejectedValue(apiError);

            await expect(getCurrentWeather(location)).rejects.toThrow("City not found");

            expect(mockWeatherInstance.getCurrent).toHaveBeenCalledWith({
                locationName: location,
                units: "metric",
            });
        });

        it("should handle network errors", async () => {
            const location = "Paris";
            const networkError = new Error("Network timeout");

            mockWeatherInstance.getCurrent.mockRejectedValue(networkError);

            await expect(getCurrentWeather(location)).rejects.toThrow("Network timeout");
        });

        it("should work with different location formats", async () => {
            const locations = [
                "New York",
                "New York, US",
                "40.7128,-74.0060", // coordinates
                "10001", // zip code
            ];

            const mockWeatherData = {name: "Test Location", main: {temp: 20}};
            mockWeatherInstance.getCurrent.mockResolvedValue(mockWeatherData);

            for (const location of locations) {
                await getCurrentWeather(location);

                expect(mockWeatherInstance.getCurrent).toHaveBeenCalledWith({
                    locationName: location,
                    units: "metric",
                });
            }

            expect(mockWeatherInstance.getCurrent).toHaveBeenCalledTimes(locations.length);
        });

        it("should always use metric units", async () => {
            const location = "Sydney";
            mockWeatherInstance.getCurrent.mockResolvedValue({});

            await getCurrentWeather(location);

            const callArgs = mockWeatherInstance.getCurrent.mock.calls[0][0];
            expect(callArgs.units).toBe("metric");
        });

        it("should handle empty location string", async () => {
            const location = "";
            const apiError = new Error("Invalid location");

            mockWeatherInstance.getCurrent.mockRejectedValue(apiError);

            await expect(getCurrentWeather(location)).rejects.toThrow("Invalid location");

            expect(mockWeatherInstance.getCurrent).toHaveBeenCalledWith({
                locationName: "",
                units: "metric",
            });
        });

        it("should handle special characters in location", async () => {
            const location = "São Paulo";
            const mockWeatherData = {
                name: "São Paulo",
                main: {temp: 22.5},
            };

            mockWeatherInstance.getCurrent.mockResolvedValue(mockWeatherData);

            const result = await getCurrentWeather(location);

            expect(result).toEqual(mockWeatherData);
            expect(mockWeatherInstance.getCurrent).toHaveBeenCalledWith({
                locationName: "São Paulo",
                units: "metric",
            });
        });
    });

    describe("OpenWeatherAPI initialization", () => {
        it("should create instance with environment API key", () => {
            getCurrentWeather("test");

            expect(MockedOpenWeatherAPI).toHaveBeenCalledWith({
                key: "test-api-key",
            });
        });

        it("should handle missing API key", () => {
            vi.stubGlobal("process", {
                env: {
                    OWM_API_KEY: undefined,
                },
            });

            getCurrentWeather("test");

            expect(MockedOpenWeatherAPI).toHaveBeenCalledWith({
                key: undefined,
            });

            vi.stubGlobal("process", {
                env: {
                    OWM_API_KEY: "test-api-key",
                },
            });
        });
    });
});
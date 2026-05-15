import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { WebSocket } from "ws";
import { ExtendedWebSocket } from "../../src/interfaces/extendedWebsocket";
import { WebsocketClientService } from "../../src/services/websocketClientService";
import { WebsocketOutboundType } from "../../src/utils/websocket/websocketCustomEvents/websocketOutboundType";

vi.mock("../../../src/utils/logger", () => ({
    default: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe("WebsocketClientService", () => {
    let mockClient: Mocked<ExtendedWebSocket>;
    let service: WebsocketClientService;

    beforeEach(() => {
        vi.clearAllMocks();

        mockClient = {
            readyState: WebSocket.OPEN,
            send: vi.fn(),
            user: {
                uuid: "user-123",
                timezone: "Europe/Berlin",
                lastState: undefined,
            },
        } as unknown as Mocked<ExtendedWebSocket>;

        service = new WebsocketClientService(mockClient);
    });

    describe("updateUser", () => {
        it("should update the user object on the client", () => {
            const newUser = { uuid: "user-123", timezone: "America/New_York" } as any;
            service.updateUser(newUser);
            expect(mockClient.user).toEqual(newUser);
        });
    });

    describe("sendPayload", () => {
        it("should format and send the payload if socket is OPEN", () => {
            service.sendPayload(WebsocketOutboundType.STATE, { mode: "idle" });

            expect(mockClient.send).toHaveBeenCalledOnce();
            expect(mockClient.send).toHaveBeenCalledWith(
                JSON.stringify({ type: WebsocketOutboundType.STATE, payload: { mode: "idle" } }),
                { binary: false }
            );
        });

        it("should NOT send the payload if socket is NOT OPEN", () => {
            (mockClient as any).readyState = WebSocket.CLOSED;

            service.sendPayload(WebsocketOutboundType.STATE, { mode: "idle" });

            expect(mockClient.send).not.toHaveBeenCalled();
        });
    });

    describe("getSettings", () => {
        it("should return the user's timezone", () => {
            const settings = service.getSettings();
            expect(settings).toEqual({ timezone: "Europe/Berlin" });
        });
    });

});

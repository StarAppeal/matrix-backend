import { describe, it, expect } from "vitest";
import request from "supertest";

import { JwtTokenPropertiesExtractor } from "../../src/rest/jwtTokenPropertiesExtractor";
// @ts-ignore
import { createTestApp } from "../helpers/testSetup";

describe("JwtTokenPropertiesExtractor", () => {

    describe("Standard Payload Extraction", () => {
        const standardPayload = {
            id: "test-user-id-123",
            username: "testuser",
            uuid: "test-user-uuid-456",
        };
        const jwtExtractor = new JwtTokenPropertiesExtractor();
        const app = createTestApp(jwtExtractor.createRouter(), "/jwt", standardPayload);

        it.each([
            { endpoint: "id", expectedValue: standardPayload.id },
            { endpoint: "username", expectedValue: standardPayload.username },
            { endpoint: "uuid", expectedValue: standardPayload.uuid },
        ])("GET /$endpoint should return the correct value from JWT payload", async ({ endpoint, expectedValue }) => {
            const response = await request(app).get(`/jwt/${endpoint}`).expect(200);
            expect(response.body.data).toBe(expectedValue);
        });
    });

    describe("Edge Case Payload Extraction", () => {
        const edgeCasePayload = {
            id: 12345,
            username: undefined,
            uuid: "",
        };
        const jwtExtractor = new JwtTokenPropertiesExtractor();
        const edgeCaseApp = createTestApp(jwtExtractor.createRouter(), "/jwt", edgeCasePayload);

        it.each([
            { endpoint: "id", expectedValue: edgeCasePayload.id },
            { endpoint: "username", expectedValue: edgeCasePayload.username },
            { endpoint: "uuid", expectedValue: edgeCasePayload.uuid },
        ])("should handle $endpoint with edge case value '$expectedValue' gracefully", async ({ endpoint, expectedValue }) => {
            const response = await request(edgeCaseApp).get(`/jwt/${endpoint}`).expect(200);

            if (expectedValue === undefined) {
                expect(response.body.data).toBeUndefined();
            } else {
                expect(response.body.data).toBe(expectedValue);
            }
        });

        it("should handle null values gracefully", async () => {
            const jwtExtractor = new JwtTokenPropertiesExtractor();
            const nullPayloadApp = createTestApp(jwtExtractor.createRouter(), "/jwt", { id: null });

            const response = await request(nullPayloadApp).get('/jwt/id').expect(200);
            expect(response.body.data).toBeNull();
        });
    });
});
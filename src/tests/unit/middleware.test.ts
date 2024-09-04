import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import middleware from "../../middleware"; // Adjust the path as necessary

// Mock `authMiddleware` from "@clerk/nextjs"
jest.mock("@clerk/nextjs", () => ({
    authMiddleware: jest.fn((config) => async (req: NextRequest, event: NextFetchEvent) => {
        // Directly invoke `afterAuth` logic here to test custom behaviors
        return config.afterAuth({}, req);
    }),
}));

// Mock NextResponse methods
jest.mock("next/server", () => ({
    NextResponse: {
        rewrite: jest.fn(),
        redirect: jest.fn(),
        next: jest.fn(),
    },
}));

describe("Middleware", () => {
    it("redirects to /agency/sign-in when visiting /sign-in", async () => {
        // Use environment variables for URL and host
        const domain = process.env.NEXT_PUBLIC_DOMAIN; // "localhost:3000"
        const scheme = process.env.NEXT_PUBLIC_SCHEME; // "http://"

        if (!domain || !scheme) {
            throw new Error("Environment variables for domain or scheme are not defined.");
        }

        // Arrange: Mock request object with explicit NextRequest type
        const req: NextRequest = {
            nextUrl: new URL(`${scheme}${domain}/sign-in`), // Use environment variables here
            headers: new Headers({ host: domain }), // Use environment variable for host
            url: `${scheme}${domain}/sign-in`,
            method: 'GET', // Required property of NextRequest
            // Add required properties to satisfy NextRequest
            clone: jest.fn(),
            body: null,
            cookies: {
                get: jest.fn(),
                has: jest.fn(),
                delete: jest.fn(),
                set: jest.fn(),
                clear: jest.fn(),
                toJSON: jest.fn(),
            },
            json: jest.fn(),
            text: jest.fn(),
            formData: jest.fn(),
            arrayBuffer: jest.fn(),
        } as unknown as NextRequest; // Casting to NextRequest for simplicity

        // Mock NextFetchEvent object (required as the second parameter)
        const event = {
            passThroughOnException: jest.fn(),
        } as any;

        // Act: Call the middleware function with the mocked request and event
        const result = await middleware(req, event);

        // Assert: Check if NextResponse.redirect was called with the correct URL
        expect(NextResponse.redirect).toHaveBeenCalledWith(
            new URL("/agency/sign-in", req.url)
        );
    });
});
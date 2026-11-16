const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const {
    loginLimiter,
    registrationLimiter
} = require("../middleware/authRateLimiters");

async function verifyLimiter(limiter, path, allowedRequests) {
    const app = express();

    app.use(limiter);

    app.post(path, (req, res) => {
        res.status(200).json({ success: true });
    });

    const server = app.listen(0, "127.0.0.1");

    try {
        await new Promise((resolve, reject) => {
            server.once("listening", resolve);
            server.once("error", reject);
        });

        const address = server.address();
        const url = `http://127.0.0.1:${address.port}${path}`;

        for (let i = 0; i < allowedRequests; i++) {
            const response = await fetch(url, { method: "POST" });
            assert.equal(
                response.status,
                200,
                `Request ${i + 1} should be allowed`
            );
        }

        const blockedResponse = await fetch(url, { method: "POST" });

        assert.equal(
            blockedResponse.status,
            429,
            "Request beyond the limit should be blocked"
        );

        const body = await blockedResponse.json();

        assert.equal(body.success, false);
        assert.ok(body.message);
    } finally {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
}

test("login limiter allows 10 requests and blocks the 11th", async () => {
    await verifyLimiter(loginLimiter, "/login-test", 10);
});

test("registration limiter allows 5 requests and blocks the 6th", async () => {
    await verifyLimiter(registrationLimiter, "/register-test", 5);
});

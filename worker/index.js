export default {
    async fetch(request, environment) {
        const response = await environment.ASSETS.fetch(request);
        const headers = new Headers(response.headers);

        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    },
};

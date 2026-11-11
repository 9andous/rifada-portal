import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Argon2 ships a native binding; keep it out of the bundle.
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
  // Baseline security headers (the app sits behind Caddy, which does not add these). CSP is sent
  // in Report-Only first so inline scripts/styles are not broken; promote it to Content-Security-Policy
  // once a nonce/hash policy is verified. HSTS is ignored by browsers over plain HTTP (dev).
  async headers() {
    const csp = [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  turbopack: {
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

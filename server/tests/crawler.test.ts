import { describe, it, expect } from "vitest";
import { validateSafeUrl, extractCleanText } from "../src/pipeline/crawler.js";

describe("Crawler & SSRF Protection (Section 11 Compliance)", () => {
  it("rejects non-http/https protocols", async () => {
    const fileResult = await validateSafeUrl("file:///etc/passwd", false);
    expect(fileResult.safe).toBe(false);

    const ftpResult = await validateSafeUrl("ftp://ftp.example.com", false);
    expect(ftpResult.safe).toBe(false);
  });

  it("blocks localhost and loopback addresses in production mode", async () => {
    const res1 = await validateSafeUrl("http://localhost:3000", false);
    expect(res1.safe).toBe(false);

    const res2 = await validateSafeUrl("http://127.0.0.1:8080", false);
    expect(res2.safe).toBe(false);
  });

  it("permits local addresses when allowLocalUrls is true (for batch evaluation)", async () => {
    const res = await validateSafeUrl("http://localhost:8099/acme/", true);
    expect(res.safe).toBe(true);
    expect(res.url?.port).toBe("8099");
  });

  it("extracts and cleans HTML, stripping script, style, and navigation tags", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Acme Careers</title>
          <style>.hero { color: red; }</style>
        </head>
        <body>
          <nav><a href="/">Home</a><a href="/login">Login</a></nav>
          <main>
            <h1>Join Our Engineering Team</h1>
            <p>We build resilient distributed systems using Node.js and TypeScript.</p>
          </main>
          <script>console.log("tracking code");</script>
          <footer>Copyright 2026 Acme Corp</footer>
        </body>
      </html>
    `;

    const { title, text } = extractCleanText(html);
    expect(title).toBe("Acme Careers");
    expect(text).toContain("Join Our Engineering Team");
    expect(text).toContain("We build resilient distributed systems");
    expect(text).not.toContain("tracking code");
    expect(text).not.toContain("color: red");
    expect(text).not.toContain("Copyright 2026");
  });
});

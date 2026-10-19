import { fetchTeraBoxData } from "./lib/terabox";
import { isValidShareUrl, extractSurl, extractHost } from "./lib/utils";

const port = Number(process.env.PORT) || 5000;

// In-memory cache for resolved links (TTL: 2 hours)
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_DURATION = 2 * 60 * 60 * 1000;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle pre-flight CORS
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve Frontend
    if (pathname === "/" || pathname === "/index.html") {
      const htmlFile = Bun.file("./public/index.html");
      if (await htmlFile.exists()) {
        return new Response(htmlFile, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...corsHeaders,
          },
        });
      }
      return new Response("Frontend index.html not found.", { status: 404 });
    }

    // Health check endpoint
    if (pathname === "/health") {
      return Response.json(
        {
          status: "ok",
          service: "tbdl",
          version: "1.0.1",
          cached_items: cache.size,
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders }
      );
    }

    // Core API Endpoint: GET or POST /api
    if (pathname === "/api") {
      const startTime = Date.now();
      let targetUrlRaw: string | null = null;

      if (req.method === "POST") {
        try {
          const body: any = await req.json();
          targetUrlRaw = body?.url || null;
        } catch {
          return Response.json(
            { status: "error", message: "Invalid JSON body. Expected { 'url': '...' }" },
            { status: 400, headers: corsHeaders }
          );
        }
      } else {
        targetUrlRaw = url.searchParams.get("url");
      }

      if (!targetUrlRaw || !targetUrlRaw.trim()) {
        return Response.json(
          {
            status: "error",
            message: "Missing required parameter 'url'",
            example: "/api?url=https://terabox.app/s/1HSEb8PZRUE7Z1Tvd3ZtT0g",
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const targetUrl = targetUrlRaw.trim();

      if (!targetUrl.startsWith("http") || !isValidShareUrl(targetUrl)) {
        return Response.json(
          {
            status: "error",
            url: targetUrl,
            message: "Invalid or unsupported TeraBox share URL.",
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const surl = extractSurl(targetUrl);
      if (!surl) {
        return Response.json(
          {
            status: "error",
            url: targetUrl,
            message: "Could not extract share code (surl) from URL.",
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const host = extractHost(targetUrl);
      const customNdus =
        url.searchParams.get("ndus") ||
        req.headers.get("x-terabox-ndus") ||
        (req.method === "POST" ? (await req.clone().json().catch(() => ({})))?.ndus : null);

      const cacheKey = customNdus ? `${surl}:${customNdus.slice(-8)}` : surl;

      // Check cache
      let resultData: any;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        resultData = cached.data;
      } else {
        resultData = await fetchTeraBoxData(surl, host, customNdus);
        if (resultData.status === "success") {
          cache.set(cacheKey, { data: resultData, expiry: Date.now() + CACHE_DURATION });
        }
      }

      const responseTime = ((Date.now() - startTime) / 1000).toFixed(3) + "s";

      if (resultData.status === "error") {
        return Response.json(
          {
            status: "error",
            url: targetUrl,
            surl,
            error: resultData.error,
            errno: resultData.errno,
            response_time: responseTime,
            timestamp: new Date().toISOString(),
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const primary = resultData.primary_file;

      return Response.json(
        {
          status: "success",
          response_time: responseTime,
          url: targetUrl,
          surl,
          filename: primary?.server_filename,
          size: primary?.size,
          bytes: primary?.bytes,
          download: primary?.dlink,
          thumbs: primary?.thumbs,
          list: resultData.list || [],
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders }
      );
    }

    return Response.json(
      { status: "error", message: "Route not found" },
      { status: 404, headers: corsHeaders }
    );
  },
});

console.log(`🚀 TBDL Server running at http://localhost:${port}`);

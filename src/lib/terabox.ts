import { loadCookies, formatBytes } from "./utils";

export interface TeraBoxFile {
  fs_id?: string;
  server_filename: string;
  size: string;
  bytes: number;
  dlink: string;
  thumbs?: Record<string, string> | string;
  category?: number;
  is_dir?: number;
}

export interface TeraBoxResult {
  status: "success" | "error";
  error?: string;
  errno?: number;
  list?: TeraBoxFile[];
  primary_file?: TeraBoxFile;
}

export async function fetchTeraBoxData(surl: string): Promise<TeraBoxResult> {
  let short_url = surl;
  if (surl.startsWith("1")) {
    short_url = surl.substring(1);
  }

  const cookies = loadCookies();
  const ndusCookie = cookies["ndus"];

  if (!ndusCookie) {
    console.warn("[WARN] 'ndus' cookie is not set. Requests may fail or be challenged by TeraBox.");
  }

  const cookieHeader = ndusCookie ? `ndus=${ndusCookie}` : "";

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  const firstUrl = `https://dm.terabox.app/sharing/link?surl=${surl}`;

  try {
    const pageResponse = await fetch(firstUrl, { headers });
    const text = await pageResponse.text();

    // Look for jsToken via urlencoded match or direct match
    let jsToken = "";
    const match1 = text.match(/fn%28%22(.*?)%22%29/);
    if (match1 && match1[1]) {
      jsToken = match1[1];
    } else {
      const match2 = text.match(/jsToken\s*[:=]\s*["']([^"']+)["']/);
      if (match2 && match2[1]) {
        jsToken = match2[1];
      }
    }

    if (!jsToken) {
      return {
        status: "error",
        error:
          "Failed to extract jsToken. A valid 'ndus' session cookie is required, or TeraBox Cloudflare verification is active.",
      };
    }

    const apiUrl = new URL("https://dm.terabox.app/share/list");
    apiUrl.searchParams.append("app_id", "250528");
    apiUrl.searchParams.append("jsToken", jsToken);
    apiUrl.searchParams.append("site_referer", "https://www.terabox.app/");
    apiUrl.searchParams.append("shorturl", short_url);
    apiUrl.searchParams.append("root", "1");

    const apiHeaders: Record<string, string> = {
      Host: "dm.terabox.app",
      "User-Agent": headers["User-Agent"],
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `https://dm.terabox.app/sharing/link?surl=${short_url}&clearCache=1`,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://dm.terabox.app",
    };

    if (cookieHeader) {
      apiHeaders["Cookie"] = cookieHeader;
    }

    const apiResponse = await fetch(apiUrl.toString(), {
      headers: apiHeaders,
    });

    const data: any = await apiResponse.json();

    if (data.errno && data.errno !== 0) {
      return {
        status: "error",
        errno: data.errno,
        error: data.errmsg || `TeraBox API returned error code ${data.errno}`,
      };
    }

    if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
      return {
        status: "error",
        error: "No downloadable files found in this share link (folder might be empty or expired).",
      };
    }

    const formattedList: TeraBoxFile[] = data.list.map((item: any) => ({
      fs_id: item.fs_id,
      server_filename: item.server_filename || "unknown_file",
      size: formatBytes(item.size),
      bytes: Number(item.size) || 0,
      dlink: item.dlink || "",
      thumbs: item.thumbs || undefined,
      category: item.category,
      is_dir: item.isdir,
    }));

    return {
      status: "success",
      list: formattedList,
      primary_file: formattedList[0],
    };
  } catch (error: any) {
    return {
      status: "error",
      error: error?.message || String(error),
    };
  }
}

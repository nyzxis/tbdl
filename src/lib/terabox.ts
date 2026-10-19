import { loadCookies, formatBytes } from "./utils";

export interface TeraBoxFile {
  fs_id?: string;
  server_filename: string;
  size: string;
  bytes: number;
  dlink: string;
  thumbs?: Record<string, string> | string;
  category?: number;
  is_dir?: number | string;
  path?: string;
}

export interface TeraBoxResult {
  status: "success" | "error";
  error?: string;
  errno?: number;
  list?: TeraBoxFile[];
  primary_file?: TeraBoxFile;
}

export async function fetchTeraBoxData(
  surl: string, 
  preferredHost?: string,
  customNdus?: string
): Promise<TeraBoxResult> {
  let short_url = surl;
  if (surl.startsWith("1")) {
    short_url = surl.substring(1);
  }

  const cookies = loadCookies();
  const ndusCookie = customNdus?.trim() || cookies["ndus"];

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

  // Determine host to use
  let host = preferredHost || "dm.terabox.app";
  if (!host.startsWith("dm.") && host.includes("1024tera")) {
    host = "dm.1024tera.com";
  } else if (!host.startsWith("dm.") && host.includes("terabox")) {
    host = "dm.terabox.app";
  }

  const hostsToTry = [host, "dm.1024tera.com", "dm.terabox.app", "www.terabox.app"];
  const uniqueHosts = [...new Set(hostsToTry)];

  let jsToken = "";
  let activeHost = uniqueHosts[0];

  for (const h of uniqueHosts) {
    try {
      const pageUrl = `https://${h}/sharing/link?surl=${surl}&clearCache=1`;
      const pageResponse = await fetch(pageUrl, { headers });
      const text = await pageResponse.text();

      const match1 = text.match(/fn%28%22(.*?)%22%29/);
      if (match1 && match1[1]) {
        jsToken = match1[1];
        activeHost = h;
        break;
      }

      const match2 = text.match(/jsToken\s*[:=]\s*["']([^"']+)["']/);
      if (match2 && match2[1]) {
        jsToken = match2[1];
        activeHost = h;
        break;
      }
    } catch {
      // try next host
    }
  }

  if (!jsToken) {
    return {
      status: "error",
      error:
        "Failed to extract security token. TeraBox may be challenging requests or requires an updated 'ndus' session cookie.",
    };
  }

  const apiHeaders: Record<string, string> = {
    Host: activeHost,
    "User-Agent": headers["User-Agent"],
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `https://${activeHost}/sharing/link?surl=${short_url}&clearCache=1`,
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: `https://${activeHost}`,
  };

  if (cookieHeader) {
    apiHeaders["Cookie"] = cookieHeader;
  }

  try {
    // 1. Fetch root directory / share metadata
    const apiUrl = new URL(`https://${activeHost}/share/list`);
    apiUrl.searchParams.append("app_id", "250528");
    apiUrl.searchParams.append("jsToken", jsToken);
    apiUrl.searchParams.append("site_referer", `https://${activeHost}/`);
    apiUrl.searchParams.append("shorturl", short_url);
    apiUrl.searchParams.append("root", "1");

    const apiResponse = await fetch(apiUrl.toString(), { headers: apiHeaders });
    const data: any = await apiResponse.json();

    if (data.errno && data.errno !== 0) {
      return {
        status: "error",
        errno: data.errno,
        error: data.errmsg || `TeraBox API error code ${data.errno}`,
      };
    }

    if (!data.list || !Array.isArray(data.list) || data.list.length === 0) {
      return {
        status: "error",
        error: "No files found in this share link (it may have expired or is empty).",
      };
    }

    let items: any[] = data.list;

    // 2. If the first item is a folder (isdir === 1 or "1"), expand the folder
    const firstItem = items[0];
    if (firstItem && (firstItem.isdir === 1 || firstItem.isdir === "1")) {
      const folderPath = firstItem.path || `/${firstItem.server_filename}`;
      const subUrl = new URL(`https://${activeHost}/share/list`);
      subUrl.searchParams.append("app_id", "250528");
      subUrl.searchParams.append("jsToken", jsToken);
      subUrl.searchParams.append("site_referer", `https://${activeHost}/`);
      subUrl.searchParams.append("shorturl", short_url);
      subUrl.searchParams.append("root", "0");
      subUrl.searchParams.append("dir", folderPath);

      try {
        const subResponse = await fetch(subUrl.toString(), { headers: apiHeaders });
        const subData: any = await subResponse.json();
        if (subData.list && Array.isArray(subData.list) && subData.list.length > 0) {
          items = subData.list;
        }
      } catch {
        // keep original items if subfolder fetch fails
      }
    }

    const formattedList: TeraBoxFile[] = items.map((item: any) => ({
      fs_id: String(item.fs_id || ""),
      server_filename: item.server_filename || "unknown_file",
      size: formatBytes(item.size),
      bytes: Number(item.size) || 0,
      dlink: item.dlink || "",
      thumbs: item.thumbs || undefined,
      category: item.category,
      is_dir: item.isdir,
      path: item.path,
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

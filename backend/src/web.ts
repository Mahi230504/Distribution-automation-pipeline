import { lookup } from "node:dns/promises";
import https from "node:https";
import { load } from "cheerio";
// Node may request an array during automatic address-family selection.
// Preserve the pinned, validated address in both lookup callback shapes.
export function pinnedLookup(address: string): NonNullable<https.RequestOptions["lookup"]> {
  return (_host, options, callback) => {
    if (options.all) callback(null, [{ address, family: 4 }]);
    else callback(null, address, 4);
  };
}
// Public HTTPS only; pin the validated IPv4 address to prevent DNS rebinding.
export async function publicPage(
  input: string,
  depth = 0,
): Promise<{ url: string; text: string }> {
  if (depth > 4) throw new Error("Too many source redirects");
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error("Source must use public HTTPS");
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  const blocked = (ip: string) => {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  };
  if (!addresses.length || addresses.some((a) => blocked(a.address)))
    throw new Error("Source resolves to a non-public address");
  const response = await new Promise<{
    status: number;
    location?: string;
    body: string;
  }>((resolve, reject) => {
    const req = https.get(
      url,
      {
        lookup: pinnedLookup(addresses[0].address),
        headers: { "User-Agent": "VPOStudio/0.1" },
      },
      (res) => {
        if ((res.statusCode ?? 500) < 300 &&
          !/^(text\/html|application\/xhtml\+xml|text\/plain)(;|$)/i.test(res.headers["content-type"] ?? "")) {
          res.resume();
          reject(new Error("Source is not a readable HTML or text page"));
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
          if (body.length > 1000000)
            req.destroy(new Error("Source exceeds size limit"));
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 500,
            location: res.headers.location,
            body,
          }),
        );
        res.on("error", reject);
      },
    );
    req.setTimeout(6000, () =>
      req.destroy(new Error("Source request timed out")),
    );
    req.on("error", reject);
  });
  if (response.status >= 300 && response.status < 400 && response.location)
    return publicPage(new URL(response.location, url).href, depth + 1);
  if (response.status >= 400)
    throw new Error(`Source returned HTTP ${response.status}`);
  const $ = load(response.body);
  $("script,style,nav,footer,header").remove();
  return {
    url: url.href,
    text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 50000),
  };
}

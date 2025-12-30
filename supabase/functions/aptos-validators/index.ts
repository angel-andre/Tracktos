import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Network = "mainnet" | "testnet";

interface ValidatorNode {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
}

interface NetworkStats {
  totalValidators: number;
  countries: number;
  cities: number;
  totalStaked: number;
  aprReward: number;
  epoch: number;
  epochProgress: number;
}

const geoCache = new Map<string, { lat: number; lng: number }>();

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ");
}

function parseNumberFromText(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseIntFromText(text: string): number {
  const cleaned = text.replace(/[^0-9]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseLocationsFromHtml(html: string): Array<{ city: string; country: string }> {
  // Location cells render as plain text like: ">Toronto, Canada<"
  const re = />\s*([^<>]{2,80}?),\s*([^<>]{2,80}?)\s*</g;
  const out: Array<{ city: string; country: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(html))) {
    const city = (m[1] || "").trim();
    const country = (m[2] || "").trim();

    // Filter out numeric / non-location matches (e.g., "846,867,841")
    if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(city)) continue;
    if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(country)) continue;
    if (/\d/.test(country)) continue;

    // Exclude obvious non-locations
    const cityN = normalize(city);
    const countryN = normalize(country);
    if (cityN.includes("apt") || cityN.includes("epoch") || cityN.includes("nodes")) continue;
    if (countryN.includes("apt") || countryN.includes("reward") || countryN.includes("complete")) continue;

    out.push({ city, country });
  }

  return out;
}

async function geocode(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const key = `${city}|${country}`;
  const cached = geoCache.get(key);
  if (cached) return cached;

  // Free geocoding (no API key) via Open-Meteo
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city,
  )}&count=10&language=en&format=json`;

  const resp = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      // User-Agent helps some providers; safe to include
      "User-Agent": "lovable-app-validator-geo",
    },
  });

  if (!resp.ok) return null;
  const json: any = await resp.json().catch(() => null);
  const results: any[] = Array.isArray(json?.results) ? json.results : [];
  if (!results.length) return null;

  const best =
    results.find((r) => normalize(String(r?.country ?? "")) === normalize(country)) ?? results[0];

  const lat = Number(best?.latitude);
  const lng = Number(best?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const value = { lat, lng };
  geoCache.set(key, value);
  return value;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (i < items.length) {
      const currentIndex = i++;
      const item = items[currentIndex];
      const res = await mapper(item);
      results[currentIndex] = res;
    }
  });

  await Promise.all(workers);
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { network?: Network };
    const network: Network = body.network === "testnet" ? "testnet" : "mainnet";

    const url = `https://explorer.aptoslabs.com/validators?network=${network}`;
    console.log(`[aptos-validators] Fetching ${url}`);

    const resp = await fetch(url, {
      headers: {
        "User-Agent": "lovable-app-validator-geo",
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Explorer fetch failed: ${resp.status} ${text.slice(0, 200)}`);
    }

    const html = await resp.text();

    // Parse headline stats
    const totalValidators = parseIntFromText(html.match(/(\d+)\s*Nodes/)?.[1] ?? "0");
    const countries = parseIntFromText(html.match(/(\d+)\s*Countries/)?.[1] ?? "0");
    const cities = parseIntFromText(html.match(/(\d+)\s*Cities/)?.[1] ?? "0");
    const epoch = parseIntFromText(html.match(/Epoch\s*(\d+)/)?.[1] ?? "0");
    const epochProgress = parseNumberFromText(html.match(/(\d+(?:\.\d+)?)%\s*complete/)?.[1] ?? "0");

    const stakedMatch = html.match(/([\d,]+)[^<]{0,30}APT\s*Staked/i)?.[1] ?? "0";
    const totalStaked = parseIntFromText(stakedMatch);

    const aprReward = parseNumberFromText(html.match(/(\d+(?:\.\d+)?)%\s*APR\s*Reward/i)?.[1] ?? "0");

    // Parse validator locations and aggregate by city
    const locations = parseLocationsFromHtml(html);
    console.log(`[aptos-validators] Parsed ${locations.length} location cells`);

    const byCity = new Map<string, { city: string; country: string; count: number }>();
    for (const loc of locations) {
      const key = `${loc.city}|${loc.country}`;
      const current = byCity.get(key);
      if (current) current.count += 1;
      else byCity.set(key, { city: loc.city, country: loc.country, count: 1 });
    }

    const cityEntries = Array.from(byCity.values());

    const withGeo = await mapWithConcurrency(cityEntries, 6, async (entry) => {
      const geo = await geocode(entry.city, entry.country);
      if (!geo) {
        console.log(`[aptos-validators] Geocode missing: ${entry.city}, ${entry.country}`);
        return null;
      }
      const node: ValidatorNode = {
        city: entry.city,
        country: entry.country,
        lat: geo.lat,
        lng: geo.lng,
        count: entry.count,
      };
      return node;
    });

    const validators = withGeo.filter(Boolean) as ValidatorNode[];

    const stats: NetworkStats = {
      totalValidators: totalValidators || locations.length,
      countries,
      cities: cities || cityEntries.length,
      totalStaked,
      aprReward,
      epoch,
      epochProgress,
    };

    console.log(
      `[aptos-validators] Returning ${validators.length} city markers for ${stats.totalValidators} validators`,
    );

    return new Response(JSON.stringify({ validators, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[aptos-validators] Error:", message);

    return new Response(JSON.stringify({ error: message, validators: [], stats: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

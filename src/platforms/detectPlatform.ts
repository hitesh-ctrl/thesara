import type { PlatformAdapter } from "./PlatformAdapter";
import { NetflixAdapter } from "./NetflixAdapter";
import { DisneyPlusAdapter } from "./DisneyPlusAdapter";
import { PrimeVideoAdapter } from "./PrimeVideoAdapter";
import { HBOMaxAdapter } from "./HBOMaxAdapter";
import { AppleTVAdapter } from "./AppleTVAdapter";

interface PlatformEntry {
  hostPatterns: RegExp[];
  create: () => PlatformAdapter;
}

const PLATFORMS: PlatformEntry[] = [
  {
    hostPatterns: [/\.netflix\.com$/],
    create: () => new NetflixAdapter(),
  },
  {
    hostPatterns: [/\.disneyplus\.com$/, /\.hotstar\.com$/],
    create: () => new DisneyPlusAdapter(),
  },
  {
    hostPatterns: [/\.primevideo\.com$/, /\.amazon\.com$/],
    create: () => new PrimeVideoAdapter(),
  },
  {
    hostPatterns: [/\.max\.com$/, /\.hbomax\.com$/],
    create: () => new HBOMaxAdapter(),
  },
  {
    hostPatterns: [/\.tv\.apple\.com$/],
    create: () => new AppleTVAdapter(),
  },
];

/**
 * Returns the appropriate PlatformAdapter for the current page, or null if
 * the page is not a supported streaming platform.
 */
export function detectPlatform(): PlatformAdapter | null {
  const host = location.hostname;
  for (const entry of PLATFORMS) {
    if (entry.hostPatterns.some((re) => re.test(host))) {
      const adapter = entry.create();
      console.log(
        `%c[Thesara] Platform detected: ${adapter.name}`,
        "color: #e50914; font-weight: bold;",
      );
      return adapter;
    }
  }
  console.warn(`[Thesara] Unsupported platform: ${host}`);
  return null;
}

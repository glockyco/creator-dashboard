export type NativeDestination = { label: string; href: string };

const allowedHosts: Record<string, true> = {
  'github.com': true,
  'search.google.com': true,
  'dash.cloudflare.com': true
};

function destination(label: string, href: string): NativeDestination {
  const url = new URL(href);
  if (url.protocol !== 'https:' || !allowedHosts[url.hostname]) {
    throw new Error(`Invalid native destination: ${label}`);
  }
  return { label, href: url.href };
}

// Product entry points avoid guessing private Cloudflare account and GSC property identifiers.
export const nativeDestinations = [
  destination('GitHub @glockyco', 'https://github.com/glockyco'),
  destination('Search Console', 'https://search.google.com/search-console'),
  destination('Cloudflare Analytics', 'https://dash.cloudflare.com/')
];

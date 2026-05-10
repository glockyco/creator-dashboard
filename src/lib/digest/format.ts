import type { DigestData } from './query';

export type DiscordEmbed = { title: string; color?: number; fields: Array<{ name: string; value: string; inline?: boolean }> };
export type DiscordMessage = { content: string; embeds: DiscordEmbed[] };

type MetricState = { latest: number | null; previous: number | null; delta: number | null };

const GL_COLOR = 0x6366f1;
const WOW_COLOR = 0xf59e0b;

export function formatDigest(data: DigestData, dateKey: string): DiscordMessage {
  return {
    content: `Creator Dashboard daily digest — ${dateKey} — last 24h`,
    embeds: [
      {
        title: 'glockyco',
        color: GL_COLOR,
        fields: [
          { name: 'GitHub', value: githubField(data) },
          { name: 'Search', value: `glockyco.com: ${searchLine(data, ['gsc-glockyco-com', 'bing-glockyco-com'])}` },
          { name: 'Site', value: `glockyco.com: ${siteLine(data, 'cf-analytics-glockyco-com')}` }
        ]
      },
      {
        title: 'WoW_Much',
        color: WOW_COLOR,
        fields: [
          { name: 'Steam guides', value: steamGuidesField(data) },
          { name: 'Steam reviews', value: steamReviewsField(data) },
          { name: 'Thunderstore', value: thunderstoreField(data) },
          { name: 'Wiki', value: wikiField(data) },
          { name: 'Search and sites', value: wowSearchAndSitesField(data) }
        ]
      },
      {
        title: 'Posts',
        fields: [{ name: 'New posts', value: postsField(data) }]
      },
      {
        title: 'Health',
        fields: [
          { name: 'Runs', value: runsField(data) },
          { name: 'Failures last 24h', value: failuresField(data) },
          { name: 'Needs attention', value: attentionField(data) }
        ]
      }
    ]
  };
}

function githubField(data: DigestData): string {
  const followers = metric(data, 'github-glockyco', 'followers');
  const stars = metric(data, 'github-glockyco', 'total_stars');
  const repos = metric(data, 'github-glockyco', 'public_repos');
  return [`Followers: ${formatState(followers)}`, `Stars: ${formatState(stars)}`, `Repos: ${formatLatest(repos.latest)}`].join('\n');
}

function steamGuidesField(data: DigestData): string {
  const erenshor = metric(data, 'steam-guide-erenshor', 'views');
  const ak = metric(data, 'steam-guide-ak', 'views');
  const totalDelta = sumNumbers([erenshor.delta, ak.delta]);
  return [`Steam guide views: ${formatSigned(totalDelta)}`, `Erenshor: ${formatState(erenshor)}`, `AK: ${formatState(ak)}`].join('\n');
}

function steamReviewsField(data: DigestData): string {
  const reviewEvents = data.events.filter((event) => event.kind === 'review').length;
  const erenshorTotal = metric(data, 'steam-reviews-erenshor', 'review_total').latest;
  const akTotal = metric(data, 'steam-reviews-ak', 'review_total').latest;
  return [`Steam review events: ${reviewEvents}`, `Totals: Erenshor ${formatLatest(erenshorTotal)}, AK ${formatLatest(akTotal)}`].join('\n');
}

function thunderstoreField(data: DigestData): string {
  const downloads = metric(data, 'thunderstore-wowmuch', 'total_downloads');
  const packages = metric(data, 'thunderstore-wowmuch', 'package_count');
  return [`Downloads: ${formatState(downloads)}`, `Packages: ${formatLatest(packages.latest)}`].join('\n');
}

function wikiField(data: DigestData): string {
  const edits = data.events.filter((event) => event.kind === 'wiki_edit');
  const titles = edits.slice(0, 3).map((event) => (event.url ? `[${event.title ?? 'Untitled'}](${event.url})` : (event.title ?? 'Untitled'))).join(', ');
  return [`Wiki edit events: ${edits.length}`, titles || 'No wiki edits'].join('\n');
}

function wowSearchAndSitesField(data: DigestData): string {
  return [
    `AK search: ${searchLine(data, ['gsc-ak-compendium', 'gsc-ak-compendium-org', 'bing-ak-compendium', 'bing-ak-compendium-org'])}`,
    `Erenshor search: ${searchLine(data, ['gsc-erenshor-maps', 'bing-erenshor-maps'])}`,
    `AK site: ${siteLine(data, 'cf-analytics-ak-compendium')}`,
    `Erenshor site: ${siteLine(data, 'cf-analytics-erenshor-maps')}`
  ].join('\n');
}

function searchLine(data: DigestData, sourceIds: string[]): string {
  const clicks = sumLatest(data, sourceIds, 'clicks');
  const impressions = sumLatest(data, sourceIds, 'impressions');
  return `${formatLatest(clicks)} clicks / ${formatLatest(impressions)} impressions`;
}

function siteLine(data: DigestData, sourceId: string): string {
  const visits = metric(data, sourceId, 'visits').latest;
  const pageviews = metric(data, sourceId, 'pageviews').latest;
  return `${formatLatest(visits)} visits / ${formatLatest(pageviews)} pageviews`;
}

function postsField(data: DigestData): string {
  if (data.posts.length === 0) return 'No new posts';
  return data.posts.slice(0, 5).map((post) => `${post.author} · ${post.platform} · [${post.title}](${post.url})`).join('\n');
}

function runsField(data: DigestData): string {
  const counts = countBy(data.runs.map((run) => run.last_status));
  const failing = data.runs.filter((run) => run.consecutive_failures > 0).length;
  return `${formatCounts(counts)}\nSources with consecutive failures: ${failing}`;
}

function failuresField(data: DigestData): string {
  if (data.failures.length === 0) return 'No failures recorded';
  return formatCounts(countBy(data.failures.map((failure) => failure.tier)));
}

function attentionField(data: DigestData): string {
  const failures = data.runs.filter((run) => run.consecutive_failures > 0 || run.last_status === 'failed').slice(0, 5);
  if (failures.length === 0) return 'No source needs attention';
  return failures.map((run) => `${run.source_id}: ${run.last_error ?? run.last_status}`).join('\n');
}

function metric(data: DigestData, sourceId: string, name: string): MetricState {
  const points = data.metrics.filter((point) => point.source_id === sourceId && point.metric === name).sort((a, b) => a.ts - b.ts);
  const latest = points.at(-1)?.value ?? null;
  const previous = points.length >= 2 ? points.at(-2)?.value ?? null : null;
  return { latest, previous, delta: latest !== null && previous !== null ? latest - previous : null };
}

function sumLatest(data: DigestData, sourceIds: string[], name: string): number | null {
  const values = sourceIds.map((sourceId) => metric(data, sourceId, name).latest).filter((value): value is number => value !== null);
  return values.length > 0 ? sumNumbers(values) : null;
}

function sumNumbers(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function formatState(state: MetricState): string {
  return `${formatLatest(state.latest)}${state.delta === null ? '' : ` (${formatSigned(state.delta)})`}`;
}

function formatLatest(value: number | null): string {
  return value === null ? 'n/a' : formatNumber(value);
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value)}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  return entries.length === 0 ? 'none' : entries.map(([key, value]) => `${key}: ${value}`).join(', ');
}

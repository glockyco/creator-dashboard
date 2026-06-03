// Shared by the production fetcher (github.ts) and the fixture-capture script
// (scripts/capture-fixture.ts) so a regenerated fixture always matches the shape
// fetchGithub parses (data.viewer.*). Keep this dependency-free: capture-fixture
// runs under `node --experimental-strip-types`, which cannot resolve the
// extensionless relative imports inside github.ts.
export const GITHUB_QUERY =
  'query { viewer { followers { totalCount } contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } } repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100, orderBy: {field: STARGAZERS, direction: DESC}) { totalCount nodes { name stargazerCount isArchived url } } } }';

import { z } from 'zod';
import { githubHeaders } from '../auth/github';
import { fetchJson } from '../http';
import type { FetcherInput, FetcherOutput } from '../types';
import { GITHUB_QUERY } from './github-query';

const Response = z.object({
  data: z.object({
    viewer: z.object({
      followers: z.object({ totalCount: z.number().int() }),
      contributionsCollection: z.object({
        contributionCalendar: z.object({
          weeks: z.array(
            z.object({
              contributionDays: z.array(z.object({ date: z.string(), contributionCount: z.number().int() }))
            })
          )
        })
      }),
      repositories: z.object({
        totalCount: z.number().int(),
        nodes: z.array(
          z.object({
            name: z.string(),
            stargazerCount: z.number().int(),
            isArchived: z.boolean(),
            url: z.string().url()
          })
        )
      })
    })
  })
});

export async function fetchGithub({ source, env, now }: FetcherInput): Promise<FetcherOutput> {
  const data = await fetchJson('https://api.github.com/graphql', {
    method: 'POST',
    headers: githubHeaders(env),
    body: JSON.stringify({ query: GITHUB_QUERY }),
    schema: Response
  });

  const viewer = data.data.viewer;
  const activeRepos = viewer.repositories.nodes.filter((repo) => !repo.isArchived);
  const contributionPoints = viewer.contributionsCollection.contributionCalendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      source_id: source.id,
      metric: 'contributions',
      ts: new Date(`${day.date}T00:00:00Z`).getTime(),
      value: day.contributionCount,
      dimensions: null
    }))
  );
  const repoStarPoints = activeRepos.map((repo) => ({
    source_id: source.id,
    metric: 'repo_stars',
    ts: now,
    value: repo.stargazerCount,
    dimensions: { repo: repo.name, archived: repo.isArchived ? 'true' : 'false' }
  }));

  return {
    metric_points: [
      { source_id: source.id, metric: 'followers', ts: now, value: viewer.followers.totalCount, dimensions: null },
      {
        source_id: source.id,
        metric: 'total_stars',
        ts: now,
        value: activeRepos.reduce((sum, repo) => sum + repo.stargazerCount, 0),
        dimensions: null
      },
      {
        source_id: source.id,
        metric: 'public_repos',
        ts: now,
        value: viewer.repositories.totalCount,
        dimensions: null
      },
      ...contributionPoints,
      ...repoStarPoints
    ],
    events: []
  };
}

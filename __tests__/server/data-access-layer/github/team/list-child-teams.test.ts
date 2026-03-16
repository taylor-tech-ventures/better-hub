import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { listChildTeams } from '../../../../../server/data-access-layer/github/team/list-child-teams';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const TEAM_SLUG = 'parent-team';

const CHILD_TEAMS_RESPONSE = [
  {
    id: 10,
    slug: 'child-one',
    name: 'Child One',
    description: 'First child team',
    privacy: 'closed',
  },
  {
    id: 11,
    slug: 'child-two',
    name: 'Child Two',
    description: null,
    privacy: 'secret',
  },
];

describe('listChildTeams', () => {
  it('returns child teams successfully', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/teams`)
      .query(true)
      .reply(200, CHILD_TEAMS_RESPONSE);

    const result = await listChildTeams({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      team_slug: TEAM_SLUG,
    });

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: 10,
          slug: 'child-one',
          name: 'Child One',
          description: 'First child team',
          privacy: 'closed',
        },
        {
          id: 11,
          slug: 'child-two',
          name: 'Child Two',
          description: null,
          privacy: 'secret',
        },
      ],
    });
  });

  it('returns empty array when team has no children', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/teams`)
      .query(true)
      .reply(200, []);

    const result = await listChildTeams({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      team_slug: TEAM_SLUG,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await listChildTeams({
      accessToken: undefined,
      org: ORG,
      team_slug: TEAM_SLUG,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when team does not exist', async () => {
    nock(GITHUB_API)
      .get(`/orgs/${ORG}/teams/${TEAM_SLUG}/teams`)
      .query(true)
      .reply(404, { message: 'Not Found' });

    const result = await listChildTeams({
      accessToken: ACCESS_TOKEN,
      org: ORG,
      team_slug: TEAM_SLUG,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`listing child teams of "${TEAM_SLUG}"`),
      },
    });
  });
});

import nock from 'nock';
import { describe, expect, it } from 'vitest';
import { listRepoCollaborators } from '../../../../../server/data-access-layer/github/user/list-repo-collaborators';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const OWNER = 'test-org';
const REPO = 'my-repo';

const COLLABORATORS_RESPONSE = [
  {
    login: 'user-one',
    id: 1,
    avatar_url: 'https://avatars.githubusercontent.com/u/1',
    permissions: {
      admin: true,
      maintain: true,
      push: true,
      triage: true,
      pull: true,
    },
    role_name: 'admin',
  },
  {
    login: 'user-two',
    id: 2,
    avatar_url: 'https://avatars.githubusercontent.com/u/2',
    permissions: {
      admin: false,
      maintain: false,
      push: true,
      triage: false,
      pull: true,
    },
    role_name: 'write',
  },
];

describe('listRepoCollaborators', () => {
  it('returns collaborators successfully', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/collaborators`)
      .query(true)
      .reply(200, COLLABORATORS_RESPONSE);

    const result = await listRepoCollaborators({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toEqual({
      success: true,
      data: [
        {
          login: 'user-one',
          id: 1,
          avatar_url: 'https://avatars.githubusercontent.com/u/1',
          permissions: {
            admin: true,
            maintain: true,
            push: true,
            triage: true,
            pull: true,
          },
          role_name: 'admin',
        },
        {
          login: 'user-two',
          id: 2,
          avatar_url: 'https://avatars.githubusercontent.com/u/2',
          permissions: {
            admin: false,
            maintain: false,
            push: true,
            triage: false,
            pull: true,
          },
          role_name: 'write',
        },
      ],
    });
  });

  it('returns empty array when repo has no collaborators', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/collaborators`)
      .query(true)
      .reply(200, []);

    const result = await listRepoCollaborators({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns TOKEN_EXPIRED error when access token is missing', async () => {
    const result = await listRepoCollaborators({
      accessToken: undefined,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: GitHubErrorCode.TOKEN_EXPIRED },
    });
  });

  it('returns NOT_FOUND error when repo does not exist', async () => {
    nock(GITHUB_API)
      .get(`/repos/${OWNER}/${REPO}/collaborators`)
      .query(true)
      .reply(404, { message: 'Not Found' });

    const result = await listRepoCollaborators({
      accessToken: ACCESS_TOKEN,
      owner: OWNER,
      repo: REPO,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: GitHubErrorCode.NOT_FOUND,
        message: expect.stringContaining(`listing collaborators for ${OWNER}/${REPO}`),
      },
    });
  });
});

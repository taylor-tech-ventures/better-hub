import nock from 'nock';
import { describe, expect, it } from 'vitest';
import {
  createGitHubRepo,
  createGitHubRepoFromTemplate,
} from '../../../../../server/data-access-layer/github/repo/create-repo';
import { GitHubErrorCode } from '../../../../../server/data-access-layer/github/types';

const ACCESS_TOKEN = 'gho_test_token';
const GITHUB_API = 'https://api.github.com';
const ORG = 'test-org';
const REPO_NAME = 'new-repo';

const CREATED_REPO_RESPONSE = {
  id: 100,
  name: REPO_NAME,
  full_name: `${ORG}/${REPO_NAME}`,
  private: true,
  html_url: `https://github.com/${ORG}/${REPO_NAME}`,
};

function mockRepoMissing(owner = ORG, repo = REPO_NAME) {
  nock(GITHUB_API)
    .get(`/repos/${owner}/${repo}`)
    .reply(404, { message: 'Not Found' });
}

function mockRepoExists(owner = ORG, repo = REPO_NAME) {
  nock(GITHUB_API)
    .get(`/repos/${owner}/${repo}`)
    .reply(200, { id: 1, name: repo });
}

describe('createGitHubRepo', () => {
  it('creates a new repository successfully', async () => {
    mockRepoMissing();
    nock(GITHUB_API)
      .post(`/orgs/${ORG}/repos`)
      .reply(201, CREATED_REPO_RESPONSE);

    const result = await createGitHubRepo({
      org: ORG,
      name: REPO_NAME,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        id: 100,
        name: REPO_NAME,
        full_name: `${ORG}/${REPO_NAME}`,
      });
    }
  });

  it('returns error when access token is missing', async () => {
    const result = await createGitHubRepo({
      org: ORG,
      name: REPO_NAME,
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.TOKEN_EXPIRED);
      expect(result.error.message).toContain('re-authenticate');
    }
  });

  it('returns error when repo already exists', async () => {
    mockRepoExists();

    const result = await createGitHubRepo({
      org: ORG,
      name: REPO_NAME,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.VALIDATION_ERROR);
      expect(result.error.message).toContain('already exists');
    }
  });

  it('creates repo with custom description and visibility', async () => {
    mockRepoMissing();
    nock(GITHUB_API)
      .post(`/orgs/${ORG}/repos`, (body) => {
        return (
          body.description === 'My description' && body.visibility === 'public'
        );
      })
      .reply(201, { ...CREATED_REPO_RESPONSE, private: false });

    const result = await createGitHubRepo({
      org: ORG,
      name: REPO_NAME,
      description: 'My description',
      visibility: 'public',
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
  });

  it('returns error when GitHub API returns an error', async () => {
    mockRepoMissing();
    nock(GITHUB_API).post(`/orgs/${ORG}/repos`).reply(422, {
      message: 'Unprocessable Entity',
      errors: [{ message: 'name already exists on this account' }],
    });

    const result = await createGitHubRepo({
      org: ORG,
      name: REPO_NAME,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.VALIDATION_ERROR);
      expect(result.error.message).toContain('Error creating repository');
    }
  });
});

describe('createGitHubRepoFromTemplate', () => {
  const TEMPLATE_OWNER = 'template-org';
  const TEMPLATE_REPO = 'template-repo';
  const TARGET_OWNER = 'test-org';
  const TARGET_REPO = 'new-from-template';

  it('creates a repo from a template successfully', async () => {
    // Target repo does not exist
    nock(GITHUB_API)
      .get(`/repos/${TARGET_OWNER}/${TARGET_REPO}`)
      .reply(404, { message: 'Not Found' });
    // First GET: githubExistsRequest check
    nock(GITHUB_API)
      .get(`/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}`)
      .reply(200, { id: 2, name: TEMPLATE_REPO, is_template: true });
    // Second GET: octokit.request for is_template verification
    nock(GITHUB_API)
      .get(`/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}`)
      .reply(200, { id: 2, name: TEMPLATE_REPO, is_template: true });
    // Generate endpoint
    nock(GITHUB_API)
      .post(`/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}/generate`)
      .reply(201, {
        id: 101,
        name: TARGET_REPO,
        full_name: `${TARGET_OWNER}/${TARGET_REPO}`,
      });

    const result = await createGitHubRepoFromTemplate({
      template_owner: TEMPLATE_OWNER,
      template_repo: TEMPLATE_REPO,
      owner: TARGET_OWNER,
      name: TARGET_REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ id: 101, name: TARGET_REPO });
    }
  });

  it('returns error when access token is missing', async () => {
    const result = await createGitHubRepoFromTemplate({
      template_owner: TEMPLATE_OWNER,
      template_repo: TEMPLATE_REPO,
      owner: TARGET_OWNER,
      name: TARGET_REPO,
      accessToken: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.TOKEN_EXPIRED);
      expect(result.error.message).toContain('re-authenticate');
    }
  });

  it('returns error when target repo already exists', async () => {
    nock(GITHUB_API)
      .get(`/repos/${TARGET_OWNER}/${TARGET_REPO}`)
      .reply(200, { id: 99 });

    const result = await createGitHubRepoFromTemplate({
      template_owner: TEMPLATE_OWNER,
      template_repo: TEMPLATE_REPO,
      owner: TARGET_OWNER,
      name: TARGET_REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.VALIDATION_ERROR);
      expect(result.error.message).toContain('already exists');
    }
  });

  it('returns error when template repo does not exist', async () => {
    nock(GITHUB_API)
      .get(`/repos/${TARGET_OWNER}/${TARGET_REPO}`)
      .reply(404, { message: 'Not Found' });
    nock(GITHUB_API)
      .get(`/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}`)
      .reply(404, { message: 'Not Found' });

    const result = await createGitHubRepoFromTemplate({
      template_owner: TEMPLATE_OWNER,
      template_repo: TEMPLATE_REPO,
      owner: TARGET_OWNER,
      name: TARGET_REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.NOT_FOUND);
      expect(result.error.message).toContain('does not exist');
    }
  });

  it('returns error when source repo is not marked as a template', async () => {
    nock(GITHUB_API)
      .get(`/repos/${TARGET_OWNER}/${TARGET_REPO}`)
      .reply(404, { message: 'Not Found' });
    // First GET: githubExistsRequest check — template exists
    nock(GITHUB_API)
      .get(`/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}`)
      .reply(200, { id: 2, name: TEMPLATE_REPO, is_template: false });
    // Second GET: octokit.request for is_template verification
    nock(GITHUB_API)
      .get(`/repos/${TEMPLATE_OWNER}/${TEMPLATE_REPO}`)
      .reply(200, { id: 2, name: TEMPLATE_REPO, is_template: false });

    const result = await createGitHubRepoFromTemplate({
      template_owner: TEMPLATE_OWNER,
      template_repo: TEMPLATE_REPO,
      owner: TARGET_OWNER,
      name: TARGET_REPO,
      accessToken: ACCESS_TOKEN,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(GitHubErrorCode.VALIDATION_ERROR);
      expect(result.error.message).toContain('is not a template repository');
    }
  });
});

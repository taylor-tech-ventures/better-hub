import { RequestError as OctokitError } from '@octokit/request-error';
import type { Endpoints as GitHubApiEndpoints } from '@octokit/types';
import getOctokit from '@/server/data-access-layer/github/client';
import {
  fail,
  GitHubErrorCode,
  type GitHubResult,
  mapStatusToErrorCode,
  ok,
} from '@/server/data-access-layer/github/types';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';

export type CreateRepoResponse =
  GitHubApiEndpoints['POST /orgs/{org}/repos']['response']['data'];
export type CreateRepoParameter =
  GitHubApiEndpoints['POST /orgs/{org}/repos']['parameters'];

export type CreateRepoParameters = {
  org: string;
  name: string;
  description?: string | null;
  visibility?: 'public' | 'private' | 'internal';
  auto_init?: boolean;
};

export type CreateRepoFromTemplateParameters = {
  template_owner: string;
  template_repo: string;
  owner: string;
  name: string;
  description?: string | null;
  include_all_branches?: boolean;
  private?: boolean;
};

/**
 * Creates a new repository in a GitHub organization.
 * Validates that a repository with the same name does not already exist before creating.
 * @param parameters - The organization name, repo name, optional description/visibility/init settings, and access token.
 * @returns A GitHubResult wrapping the newly created repository data.
 */
export async function createGitHubRepo(
  parameters: CreateRepoParameters & { accessToken: string | undefined },
): Promise<GitHubResult<CreateRepoResponse>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      `Error creating the ${params.org}/${params.name} repository. Please re-authenticate.`,
    );
  }
  try {
    const repoExists = await githubExistsRequest(
      'repo',
      { owner: params.org, repo: params.name },
      accessToken,
    );

    if (repoExists) {
      return fail(
        GitHubErrorCode.VALIDATION_ERROR,
        `Repository ${params.org}/${params.name} already exists`,
      );
    }

    const octokit = getOctokit(accessToken);

    const apiParams: {
      org: string;
      name: string;
      description?: string;
      visibility: CreateRepoParameter['visibility'];
      auto_init: boolean;
    } = {
      org: params.org,
      name: params.name,
      visibility: (params.visibility ??
        'private') as CreateRepoParameter['visibility'],
      auto_init: params.auto_init ?? true,
    };

    if (params.description !== null && params.description !== undefined) {
      apiParams.description = params.description;
    }

    const repo = await octokit.request('POST /orgs/{org}/repos', apiParams);

    return ok(repo.data);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error creating repository: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating repository: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Creates a new repository in a GitHub organization from a template repository.
 * Validates that the target repo does not already exist and that the template repo
 * exists and is marked as a template before creating.
 * @param parameters - The template owner/repo, target owner/name, optional description/branch settings, and access token.
 * @returns A GitHubResult wrapping the newly created repository data.
 */
export async function createGitHubRepoFromTemplate(
  parameters: CreateRepoFromTemplateParameters & {
    accessToken: string | undefined;
  },
): Promise<GitHubResult<CreateRepoResponse>> {
  const { accessToken, ...params } = parameters;
  if (!accessToken) {
    return fail(
      GitHubErrorCode.TOKEN_EXPIRED,
      `Error creating the ${params.owner}/${params.name} repository from template. Please re-authenticate.`,
    );
  }
  try {
    const repoExists = await githubExistsRequest(
      'repo',
      { owner: params.owner, repo: params.name },
      accessToken,
    );

    if (repoExists) {
      return fail(
        GitHubErrorCode.VALIDATION_ERROR,
        `Repository ${params.owner}/${params.name} already exists`,
      );
    }

    const templateExists = await githubExistsRequest(
      'repo',
      { owner: params.template_owner, repo: params.template_repo },
      accessToken,
    );

    if (!templateExists) {
      return fail(
        GitHubErrorCode.NOT_FOUND,
        `Template repository ${params.template_owner}/${params.template_repo} does not exist`,
      );
    }

    const octokit = getOctokit(accessToken);

    const templateRepoInfo = await octokit.request(
      'GET /repos/{template_owner}/{template_repo}',
      {
        template_owner: params.template_owner,
        template_repo: params.template_repo,
      },
    );

    if (!templateRepoInfo.data.is_template) {
      return fail(
        GitHubErrorCode.VALIDATION_ERROR,
        `The repository ${params.template_owner}/${params.template_repo} is not a template repository.`,
      );
    }

    const apiParams: {
      template_owner: string;
      template_repo: string;
      owner: string;
      name: string;
      description?: string;
      include_all_branches: boolean;
      private: boolean;
    } = {
      template_owner: params.template_owner,
      template_repo: params.template_repo,
      owner: params.owner,
      name: params.name,
      include_all_branches: params.include_all_branches ?? false,
      private: params.private ?? true,
    };

    if (params.description !== null && params.description !== undefined) {
      apiParams.description = params.description;
    }

    const repo = await octokit.request(
      'POST /repos/{template_owner}/{template_repo}/generate',
      apiParams,
    );

    return ok(repo.data);
  } catch (error) {
    if (error instanceof OctokitError) {
      return fail(
        mapStatusToErrorCode(error.status),
        `Error creating repository from template: ${error.message}`,
      );
    }
    return fail(
      GitHubErrorCode.INTERNAL_ERROR,
      `Error creating repository from template: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

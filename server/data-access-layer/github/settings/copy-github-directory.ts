import { RequestError } from '@octokit/request-error';
import getOctokit from '@/server/data-access-layer/github/client';
import { githubExistsRequest } from '@/server/data-access-layer/github/utils';

export type CopyGitHubDirectoryParameters = {
  owner: string;
  sourceRepo: string;
  targetRepos: string[];
};

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

/**
 * Fetches the contents of a directory in a GitHub repository.
 * Returns an empty array if the path does not exist (404).
 * @param owner - The repository owner.
 * @param repo - The repository name.
 * @param path - The directory path to fetch.
 * @param accessToken - The GitHub OAuth access token.
 * @returns An array of file/directory content objects, or empty if the path does not exist.
 */
async function getDirectoryContents(
  owner: string,
  repo: string,
  path: string,
  accessToken: string,
): Promise<GitHubContent[]> {
  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    const data = response.data;
    if (Array.isArray(data)) {
      return data as GitHubContent[];
    } else {
      return [];
    }
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      return [];
    }
    throw new Error(
      `Failed to fetch directory contents: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Fetches the decoded UTF-8 content of a file in a GitHub repository.
 * @param owner - The repository owner.
 * @param repo - The repository name.
 * @param path - The file path to fetch.
 * @param accessToken - The GitHub OAuth access token.
 * @returns The decoded file content as a UTF-8 string.
 * @throws {Error} If the path is a directory or the content is invalid.
 */
async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  accessToken: string,
): Promise<string> {
  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    const data = response.data;
    if (Array.isArray(data)) {
      throw new Error('Expected file but got directory');
    }

    if (data.type !== 'file' || !data.content) {
      throw new Error('Invalid file content');
    }

    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (error) {
    throw new Error(
      `Failed to fetch file content: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Creates or updates a file in a GitHub repository.
 * If a SHA is provided, the file is updated; otherwise a new file is created.
 * @param owner - The repository owner.
 * @param repo - The repository name.
 * @param path - The file path to create or update.
 * @param content - The UTF-8 string content of the file.
 * @param message - The commit message.
 * @param accessToken - The GitHub OAuth access token.
 * @param sha - The existing file's SHA (required when updating an existing file).
 * @throws {Error} If the GitHub API request fails.
 */
async function createOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  accessToken: string,
  sha?: string,
): Promise<void> {
  try {
    const octokit = getOctokit(accessToken);
    const requestParams: {
      owner: string;
      repo: string;
      path: string;
      message: string;
      content: string;
      sha?: string;
    } = {
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
    };

    if (sha) {
      requestParams.sha = sha;
    }

    await octokit.rest.repos.createOrUpdateFileContents(requestParams);
  } catch (error) {
    throw new Error(
      `Failed to create/update file: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Retrieves the SHA of a file if it already exists in a repository.
 * Returns `undefined` if the file does not exist (e.g., 404 response).
 * @param owner - The repository owner.
 * @param repo - The repository name.
 * @param path - The file path to check.
 * @param accessToken - The GitHub OAuth access token.
 * @returns The file's SHA string, or `undefined` if not found.
 */
async function getExistingFileSha(
  owner: string,
  repo: string,
  path: string,
  accessToken: string,
): Promise<string | undefined> {
  try {
    const octokit = getOctokit(accessToken);
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });

    const data = response.data;
    if (!Array.isArray(data)) {
      return data.sha;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Recursively copies all files from a directory in a source repository to the same path
 * in a target repository, creating or updating files as needed.
 * @param owner - The repository owner.
 * @param sourceRepo - The source repository name.
 * @param targetRepo - The target repository name.
 * @param directoryPath - The directory path to copy (e.g., `.github`).
 * @param accessToken - The GitHub OAuth access token.
 * @returns An array of results for each file copied.
 */
async function copyDirectoryRecursively(
  owner: string,
  sourceRepo: string,
  targetRepo: string,
  directoryPath: string,
  accessToken: string,
): Promise<
  {
    repo: string;
    filePath: string;
    success: boolean;
    error?: string;
  }[]
> {
  const results: {
    repo: string;
    filePath: string;
    success: boolean;
    error?: string;
  }[] = [];

  try {
    const contents = await getDirectoryContents(
      owner,
      sourceRepo,
      directoryPath,
      accessToken,
    );

    if (contents.length === 0) {
      results.push({
        repo: targetRepo,
        filePath: directoryPath,
        success: false,
        error: 'Source directory is empty or does not exist',
      });
      return results;
    }

    for (const item of contents) {
      if (item.type === 'file') {
        try {
          const fileContent = await getFileContent(
            owner,
            sourceRepo,
            item.path,
            accessToken,
          );

          const existingSha = await getExistingFileSha(
            owner,
            targetRepo,
            item.path,
            accessToken,
          );

          await createOrUpdateFile(
            owner,
            targetRepo,
            item.path,
            fileContent,
            `Copy ${item.path} from ${sourceRepo}`,
            accessToken,
            existingSha,
          );

          results.push({
            repo: targetRepo,
            filePath: item.path,
            success: true,
          });
        } catch (error) {
          results.push({
            repo: targetRepo,
            filePath: item.path,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (item.type === 'dir') {
        const subResults = await copyDirectoryRecursively(
          owner,
          sourceRepo,
          targetRepo,
          item.path,
          accessToken,
        );
        results.push(...subResults);
      }
    }
  } catch (error) {
    results.push({
      repo: targetRepo,
      filePath: directoryPath,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}

/**
 * Copies the entire `.github` directory from a source repository to one or more target
 * repositories in the same organization. Validates that the source and each target repository
 * exist before copying.
 * @param parameters - The owner, source repo, target repos, and access token.
 * @returns An array of results per file per target repository.
 */
export async function copyGitHubDirectory(
  parameters: CopyGitHubDirectoryParameters & {
    accessToken: string | undefined;
  },
): Promise<
  {
    repo: string;
    filePath: string;
    success: boolean;
    error?: string;
  }[]
> {
  const { accessToken, ...params } = parameters;

  if (!accessToken) {
    return [
      {
        repo: 'Unknown',
        filePath: '.github',
        success: false,
        error: 'Error copying GitHub directory. Are you logged in?',
      },
    ];
  }

  const copyResults: {
    repo: string;
    filePath: string;
    success: boolean;
    error?: string;
  }[] = [];

  try {
    const sourceExists = await githubExistsRequest(
      'repo',
      { owner: params.owner, repo: params.sourceRepo },
      accessToken,
    );

    if (!sourceExists) {
      return [
        {
          repo: params.sourceRepo,
          filePath: '.github',
          success: false,
          error: `Error: source repository ${params.owner}/${params.sourceRepo} does not exist`,
        },
      ];
    }

    const validTargetRepos: string[] = [];
    for (const targetRepo of params.targetRepos) {
      const targetExists = await githubExistsRequest(
        'repo',
        { owner: params.owner, repo: targetRepo },
        accessToken,
      );

      if (!targetExists) {
        copyResults.push({
          repo: targetRepo,
          filePath: '.github',
          success: false,
          error: `Error: target repository ${params.owner}/${targetRepo} does not exist`,
        });
      } else {
        validTargetRepos.push(targetRepo);
      }
    }

    if (validTargetRepos.length === 0) {
      return copyResults;
    }

    const copyPromises = validTargetRepos.map((targetRepo) =>
      copyDirectoryRecursively(
        params.owner,
        params.sourceRepo,
        targetRepo,
        '.github',
        accessToken,
      ),
    );

    const results = await Promise.all(copyPromises);
    for (const result of results) {
      copyResults.push(...result);
    }
  } catch (error) {
    return [
      {
        repo: 'Unknown',
        filePath: '.github',
        success: false,
        error:
          error instanceof RequestError
            ? `Request failed with status ${error.status}: ${error.message}`
            : String(error),
      },
    ];
  }

  return copyResults;
}

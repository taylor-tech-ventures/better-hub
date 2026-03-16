import type { Endpoints as GitHubAPIEndpointTypes } from '@octokit/types';

export default async function fetchGitHubUserEmail(
  access_token: string,
): Promise<string> {
  try {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${access_token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'gh-admin-app',
      },
      method: 'GET',
    });
    if (!response.ok || response.status !== 200) {
      const text = await response.text();
      throw new Error(
        `GitHub API responded with status ${response.status}\n ${text}`,
      );
    }
    const userEmailsArray =
      (await response.json()) as GitHubAPIEndpointTypes['GET /user/emails']['response']['data'];
    if (userEmailsArray.length === 0) {
      throw new Error('No email addresses found in the GitHub response');
    }

    // If there's only one email, return it
    if (userEmailsArray.length === 1) {
      return userEmailsArray[0].email;
    }
    // Prefer primary email + verified, then primary only, then verified only
    const verifiedPrimaryEmails = userEmailsArray.filter(
      (emailObj) => emailObj.primary && emailObj.verified,
    );
    if (verifiedPrimaryEmails.length > 0) {
      return verifiedPrimaryEmails[0].email;
    }
    const primaryEmails = userEmailsArray.filter(
      (emailObj) => emailObj.primary,
    );
    if (primaryEmails.length > 0) {
      return primaryEmails[0].email;
    }
    const verifiedEmails = userEmailsArray.filter(
      (emailObj) => emailObj.verified,
    );
    if (verifiedEmails.length > 0) {
      return verifiedEmails[0].email;
    }

    // fallback to the first email if no other criteria matched
    return userEmailsArray[0].email;
  } catch (error) {
    throw new Error(`Failed to fetch user emails from GitHub: ${error}`);
  }
}

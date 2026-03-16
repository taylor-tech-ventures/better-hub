---
name: implement-and-verify
description: Implement a feature or fix with full end-to-end verification — static checks, unit tests, live browser testing, commit, PR creation, and GitHub Actions CI feedback loop
disable-model-invocation: true
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*), Bash(pnpm dev:*), Bash(lsof:*), Bash(gh:*)
---
Implement and verify: $ARGUMENTS

Follow this feedback loop until ALL checks pass — static, unit, browser E2E, AND CI. Do NOT stop after implementation or after static checks alone.

## Phase 1: Understand
1. Read relevant source files to understand the current code and patterns
2. If the scope is unclear, ask clarifying questions before proceeding
3. Identify which files need to change, what tests exist, and what UI surfaces are affected

## Phase 2: Plan
4. Create a concise implementation plan (mental or written)
5. Identify what verification will look like:
   - Which static checks and unit tests apply
   - Which pages/flows need browser verification
   - What the expected browser behavior should be after the change

## Phase 3: Implement
6. Make the code changes following project conventions in CLAUDE.md
7. Write or update tests in `__tests__/` mirroring the source path structure
8. Use nock for HTTP mocks — no real network calls in unit tests

## Phase 4: Static Verification (LOOP UNTIL ALL PASS — max 10 iterations)
9. Run `pnpm typecheck` — fix any type errors
10. Run `pnpm test:run` — fix any test failures
11. Run `pnpm lint` — fix any lint issues
12. If any step fails, fix the issue and re-run ALL checks from step 9
13. Repeat until all three pass cleanly — **stop after 10 iterations and report the blocker if still failing**

## Phase 5: Build Verification
14. Run `pnpm check` (full check: tsc + build + wrangler dry-run)
15. If this fails, fix and loop back to step 9 (counts toward the 10-iteration limit above)

## Phase 6: Browser E2E Verification
The dev server (`pnpm dev`) connects to real Cloudflare resources. Use the `$GH_TEST_ORG` GitHub org for testing (defaults to `gh-admin-test` if not set).

### Prerequisites (cloud sessions)
The SessionStart hook (`.claude/hooks/setup-cloud-session.sh`) automatically loads environment variables from `.dev.vars` (local) or from the Claude Code web environment settings (cloud). If the dev server fails to start, check that all required secrets are available — see the "Cloud Session Setup" section in `docs/claude-code-best-practices.md`.

### Start the dev server
16. Check if the dev server is already running: `lsof -i :8787`
17. If not running, start it: `pnpm dev` (run in background, wait for it to be ready)
18. Verify the server is responding: `agent-browser open http://localhost:8787 && agent-browser wait --load networkidle`

### Authenticate with GitHub
19. Run the auth helper script to handle the full GitHub OAuth flow:
    ```bash
    bash .claude/hooks/browser-github-auth.sh gh-admin-e2e
    ```
    This script:
    - Tries restoring saved browser auth state first (fast path)
    - If expired, navigates to the login page and clicks "Sign in with GitHub"
    - Fills GitHub credentials using the agent-browser auth vault (preferred) or `GH_TEST_USERNAME`/`GH_TEST_PASSWORD` env vars
    - Handles the GitHub OAuth authorization page
    - Waits for the callback redirect to `/dashboard`
    - Saves browser state for reuse across subsequent runs

    **If the auth helper fails**, fall back to manual steps:
    ```bash
    agent-browser --session gh-admin-e2e open http://localhost:8787
    agent-browser --session gh-admin-e2e snapshot -i
    # Click the sign-in button, then snapshot the GitHub login page
    # Fill username/password, click sign in, handle OAuth consent
    # Wait for redirect to /dashboard
    agent-browser --session gh-admin-e2e state save /tmp/gh-admin-auth-state.json
    ```

### Verify the change in the browser
20. Navigate to the page(s) affected by the change (use `--session gh-admin-e2e`):
    ```bash
    agent-browser --session gh-admin-e2e open http://localhost:8787/dashboard/chat
    agent-browser --session gh-admin-e2e wait --load networkidle
    ```
21. Take snapshots to identify interactive elements: `agent-browser --session gh-admin-e2e snapshot -i`
22. Exercise the feature — click, fill, submit, interact as a user would
23. After each action, re-snapshot or screenshot to verify the result
24. For visual changes, take screenshots and use `Read` to visually inspect them
25. For data changes, verify the data appears correctly in the UI (tables, cards, metrics)
26. For AI chat changes, send a test message and wait 10-15s for the response

### Verify destructive tool changes (if applicable)
27. If the change involves AI tools that create/modify/delete resources:
    - Test with the `$GH_TEST_ORG` org
    - Verify the approval UI appears for destructive tools
    - After testing, clean up any test resources using `gh` CLI:
      ```bash
      gh repo delete "$GH_TEST_ORG/<test-repo>" --yes
      gh pr close <number> -R "$GH_TEST_ORG/<repo>"
      ```
28. Read-only tools should auto-execute without approval prompts — verify this

### Document results
29. Take a final screenshot of the key affected page(s)
30. Compare before/after if relevant: `agent-browser diff screenshot --baseline before.png`

## Phase 7: CLAUDE.md & Documentation Maintenance

This phase is MANDATORY — do not skip it. Every implementation that changes source files must be checked for documentation impact.

### Identify what needs updating
31. Run the maintenance check script to see which docs are affected:
    ```bash
    bash .claude/hooks/docs-maintenance-check.sh
    ```
    This analyzes your changed files against the Documentation Maintenance matrix in `CLAUDE.md` and outputs exactly which sections/files need review.

32. If the script outputs nothing, no doc updates are needed — skip to Phase 8.

### Review and update documentation
33. For each doc target listed by the script, read the current content and determine if your changes require updates. Focus on:
    - **CLAUDE.md sections**: Architecture descriptions, key directories, API surfaces, conventions, configuration tables
    - **docs/ files**: Detailed guides that reference specific implementations, data flows, or APIs you changed

34. Apply updates using the Documentation Maintenance matrix in `CLAUDE.md` as your guide:

    | If you changed... | Update... |
    |---|---|
    | Durable Object methods / tokens | `CLAUDE.md` (Durable Objects), `docs/architecture.md` |
    | oRPC procedures / middleware | `CLAUDE.md` (Server APIs), `docs/client-orpc-dal-durable-object.md` |
    | Auth flow | `CLAUDE.md` (Authentication Flow), `docs/architecture.md` |
    | DAL functions | `CLAUDE.md` (Data Access Layer), `docs/client-orpc-dal-durable-object.md` |
    | AI tools (contracts/definitions) | `CLAUDE.md` (AI Chat & json-render), `docs/ai-tools.md` |
    | System prompts | `CLAUDE.md` (AI Chat & json-render), `docs/system-prompt.md` |
    | json-render catalog / registry | `CLAUDE.md` (AI Chat & json-render), `docs/architecture.md` |
    | CLI commands | `CLAUDE.md` (Key Directories, Stack), `docs/cli.md` |
    | MCP server / OAuth | `CLAUDE.md` (Durable Objects), `docs/architecture.md` |
    | Hooks / Claude Code config | `CLAUDE.md` (Cloud Session Setup), `docs/claude-code-best-practices.md` |
    | New top-level files/directories | `CLAUDE.md` (Key Directories), `docs/architecture.md` |

35. Rules for documentation updates:
    - Match the existing style and level of detail in each doc file
    - Do NOT add change comments ("// updated for X") — just update the content
    - Keep `CLAUDE.md` concise — detailed explanations belong in `docs/`
    - If you added a new major feature, add a row to the Documentation Maintenance matrix itself

### Verify docs are accurate
36. Re-read the sections you updated and confirm they accurately reflect the implementation
37. Run `pnpm lint` to catch any formatting issues in the updated docs

## Phase 8: Commit & Push

38. Stage all changed files (be specific — avoid `git add -A` which can pick up secrets or build artifacts):
    ```bash
    git add <specific files>
    git status  # confirm staged files look right
    ```
39. Commit with a descriptive message:
    ```bash
    git commit -m "$(cat <<'EOF'
    <summary line — what and why>

    <optional body paragraph if needed>

    https://claude.ai/code/session_01GqbtL441h2BF52V7ohut8n
    EOF
    )"
    ```
40. Push to the feature branch:
    ```bash
    git push -u origin <branch-name>
    ```
    If push fails due to a network error, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s). Do NOT retry on 403 (permission denied) — report the error instead.

## Phase 9: Create Pull Request

41. Create a PR using the GitHub CLI:
    ```bash
    gh pr create --title "<concise title under 70 chars>" --body "$(cat <<'EOF'
    ## Summary
    - <bullet 1>
    - <bullet 2>

    ## Test plan
    - [ ] pnpm typecheck passes
    - [ ] pnpm test:run passes
    - [ ] pnpm lint passes
    - [ ] Browser E2E: <what was verified>

    https://claude.ai/code/session_01GqbtL441h2BF52V7ohut8n
    EOF
    )"
    ```
42. Note the PR URL and number returned by the command.

## Phase 10: GitHub Actions CI Feedback Loop (max 10 polls)

Wait for CI to run and use the results as a feedback loop — if checks fail, fix the issue and iterate.

43. Wait for CI checks to start (they may take 30-60 seconds to appear after push):
    ```bash
    sleep 30
    gh pr checks <PR-number> --watch 2>/dev/null || gh run list --branch <branch-name> --limit 5
    ```

44. **Poll loop** — repeat up to 10 times with 30-second waits between polls:
    ```bash
    # Check status
    gh pr checks <PR-number>
    ```
    Interpret results:
    - All checks **pass** → done, move to Phase 11
    - Any check **in_progress / queued** → wait 30s and poll again (counts toward limit)
    - Any check **fail** → investigate the failure

45. **If a CI check fails**, diagnose it:
    ```bash
    # Find the failing run
    gh run list --branch <branch-name> --limit 3

    # Get the full logs for the failing job
    gh run view <run-id> --log-failed
    ```

46. Fix the root cause locally, then loop back through **Phase 4** (static verification) and **Phase 8** (commit & push). The new push will trigger a fresh CI run — return to step 43.
    - **Do not skip Phase 4** even if the CI failure seems obvious — always re-run typecheck/test/lint before pushing a fix commit.
    - If the same check fails after 3 fix attempts, stop and report the blocker to the user rather than continuing to loop.

47. **Iteration limit**: If CI has not passed after 10 poll cycles (not counting active fix+push loops), stop and report the current status. Do not wait indefinitely for a stuck runner.

## Phase 11: Cleanup & Summary

48. Close the browser session: `agent-browser --session gh-admin-e2e close`
49. Clean up any test data created during E2E testing (repos, PRs, teams, etc.) using `gh` CLI
50. Summarize:
    - What code was changed
    - What static checks passed
    - What was verified in the browser (with key observations)
    - What documentation was updated (list the specific files and sections)
    - PR URL and final CI status
    - Any test data that was created and cleaned up

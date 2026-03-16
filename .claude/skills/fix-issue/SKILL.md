---
name: fix-issue
description: Fix a GitHub issue end-to-end with verification
disable-model-invocation: true
---
Fix the GitHub issue: $ARGUMENTS

## Steps
1. Use `gh issue view $ARGUMENTS` to get issue details
2. Search the codebase for relevant files referenced in or related to the issue
3. Understand the root cause before writing any code
4. Invoke `/implement-and-verify` with a clear description of the fix:
   - Include the root cause, affected files, and issue number for the commit message
   - Example: `/implement-and-verify Fix issue #$ARGUMENTS: <root cause and what to change>`

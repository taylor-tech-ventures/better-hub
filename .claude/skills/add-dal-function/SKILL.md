---
name: add-dal-function
description: Scaffold a new DAL function with tests following project conventions
---
Create a new Data Access Layer function: $ARGUMENTS

## Steps
1. Look at existing DAL functions in `server/data-access-layer/` for patterns (especially `get-user-orgs.ts`)
2. Create the function returning `GitHubResult<T>` using `ok()` / `fail()` / `mapStatusToErrorCode()` helpers
3. Place it in the appropriate subdirectory under `server/data-access-layer/`
4. Create unit tests in `__tests__/server/data-access-layer/` mirroring the source path
5. Tests must use nock for HTTP mocking and cover:
   - Success path
   - Error paths (403, 404, rate limit)
   - Auth guard (if applicable)
6. Run `/implement-and-verify` to complete static verification, build check, documentation updates (`CLAUDE.md` + `docs/client-orpc-dal-durable-object.md`), commit, and PR creation

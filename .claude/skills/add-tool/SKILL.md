---
name: add-tool
description: Add a new AI tool to the agent following the tool architecture
---
Add a new AI tool: $ARGUMENTS

## Steps
1. Review existing tools in `server/agent/tools/` to understand the pattern
2. Add the oRPC contract (Zod schema) in `server/agent/tools/contracts.ts`
3. Add the platform-agnostic tool definition in `server/agent/tools/definitions.ts`
4. Register in `server/agent/tools/index.ts` (AI SDK adapter via `implementTool()`)
5. Register in `server/agent/tools/mcp-adapter.ts` (MCP adapter)
6. If the tool is destructive (create, update, delete), add it to `TOOLS_REQUIRING_APPROVAL` in `packages/shared/config/tool-approval.ts`
7. Add corresponding DAL function if needed (see `/add-dal-function`)
8. Write tests in `__tests__/server/agent/tools/`
9. Run `/implement-and-verify` to complete static verification, build check, browser E2E verification of the tool in the AI chat, documentation updates, commit, and PR creation

# Tool Confirmation System

Destructive and write operations require explicit user approval before execution, implemented via the AI SDK's built-in `needsApproval` mechanism and AI Elements `Confirmation` components.

## How It Works

1. **Server:** Tools listed in `TOOLS_REQUIRING_APPROVAL` have `needsApproval: true` set by `applyApprovalPolicy()`. The AI SDK pauses execution before `execute` runs and streams an `approval-requested` state to the client.
2. **Client:** The chat UI renders Approve/Deny buttons via AI Elements `Confirmation` components. User clicks call `addToolApprovalResponse({ id: approval.id, approved: true/false })`.
3. **Auto-submit:** The conversation auto-continues after all approvals are resolved via `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses`.
4. **Server resumes:** Approved tools execute; denied tools return `output-denied` state.

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/config/tool-approval.ts` | `TOOLS_REQUIRING_APPROVAL` list + `toolNeedsApproval()` helper |
| `server/agent/tools/index.ts` | `applyApprovalPolicy()` sets `needsApproval: true` on matching tools |
| `clients/web/components/ui/chat/interface.tsx` | `MessageParts` renders approval UI for `approval-requested` tool parts |
| `clients/web/components/ui/chat/tool-call.tsx` | Status labels/icons for `approval-requested` and `approval-responded` states |
| `clients/web/components/ui/chat/tool-group-confirmation.tsx` | Grouped confirmation card for multiple tools in one response |

## Confirmation Categories

- **Auto-approved (read-only, 50+ tools):** Execute immediately with no user interaction
- **Confirmation required (29 tools):** Includes delete/update/create repos, team and user management, PR/issue operations, workflow dispatches, security changes, copy/sync operations, and scheduling

See `packages/shared/config/tool-approval.ts` for the full current list.

## MCP Confirmation Pattern

MCP clients use a `confirmed` parameter pattern instead of the web UI:

1. First call to a destructive tool (without `confirmed: true`) returns a human-readable confirmation prompt
2. The AI agent presents this to the user and asks for confirmation
3. Second call with `confirmed: true` executes the action

This keeps the MCP experience self-contained — users never need to leave their AI client.

## Grouped Confirmation

When the AI makes multiple tool calls requiring approval in a single response, they are grouped into a single confirmation card (`ToolGroupConfirmationCard`). Users can exclude individual operations before approving. The prompt input is blocked while confirmations are pending.

## Adding Approval to a New Tool

Add the tool name to `TOOLS_REQUIRING_APPROVAL` in `packages/shared/config/tool-approval.ts`. No other changes needed — `applyApprovalPolicy()` handles the web chat side automatically, and `registerMcpTools()` in `server/agent/tools/mcp-adapter.ts` handles the MCP side.

## Design Decisions

- **No double-confirmation:** The system prompt instructs the agent not to ask "Are you sure?" before executing destructive tools, since the SDK's approval UI already handles this
- **Grouped UX:** Multiple tool calls appear in a single card (not individual confirmation boxes)
- **AI Elements integration:** Uses `Confirmation`, `ConfirmationRequest`, `ConfirmationAccepted`, `ConfirmationRejected`, and `ConfirmationActions` components for state-aware rendering
- **Shared approval list:** The same `TOOLS_REQUIRING_APPROVAL` list governs both web UI (`needsApproval`) and MCP (`confirmed` parameter pattern), ensuring consistent safety policy across surfaces

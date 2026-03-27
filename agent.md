# Agent Architecture Context

This document outlines the internal architecture, safety gates, and responsibilities of the agents within **Sintenel-CLI**. Use this context when modifying agent logic, tools, or system prompts.

## Core Principles

1. **Safety First (Human-in-the-Loop)**
   - No agent is permitted to execute commands or mutate files unless an explicit Execution Plan has been submitted and approved by the human operator.
   - The orchestrator proposes the plan. The system pauses to capture user confirmation (`Y/N`).
2. **Separation of Concerns (Sub-agents)**
   - **Orchestrator**: Acts as the project manager. It holds the core loop, requests plan approval, and orchestrates. It does not perform detailed tasks directly; it delegates.
   - **Scout**: Specialized in read-only tasks. Used for exploring the filesystem, checking configurations, checking network states, and returning pure intelligence back to the Orchestrator.
   - **Fixer**: Specialized in mutations. Used for applying code patches, writing configuration files, removing malicious files, and running system modifications.
3. **Auditability**
   - Every AI interaction, tool call, and system state change is logged via the `appendAuditLog` function.

## Tool Limitations & Roles

### `fileOperator`
- A generic file operation tool built over `node:fs`.
- Supports actions: `read`, `list`, `write`, `patch`, `rename`, `delete`.
- **Scout's instance** of this tool is strictly limited to `read` and `list` by its configuration context.
- **Fixer's instance** can write and mutate, but *only* if the execution plan has been approved by the user.

### `executePowerShell`
- Executes commands in a PowerShell environment.
- Any command run must precisely match (or normalize to match) the commands explicitly approved in the Execution Plan. If an agent tries to run a rogue command, the system will block it.

### `submitExecutionPlan`
- Available **only** to the Orchestrator.
- Requires providing `objective`, `scope`, `rollbackPlan`, `risks`, and a list of requested `commands` that the agents need permission to execute.

## Modifying Prompts

The system prompts for the agents are stored in `src/agents/`.
- `src/agents/orchestrator.ts`: Should always instruct the agent to use `submitExecutionPlan` before delegating write/execute tasks.
- `src/agents/scout.ts`: Should enforce that Scout relies on read-only mechanisms and provides concise security/system intelligence.
- `src/agents/fixer.ts`: Should encourage safe patching behavior, double-checking paths before modifying, and using backup flags where appropriate.

## Testing Your Changes

If you modify agent logic, ensure you run typechecking (`npm run typecheck`) and verify that the approval loop isn't bypassed. The best way to test changes locally is:
```bash
npm run dev -- "Your test goal"
```
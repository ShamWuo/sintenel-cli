# Architecture Overview

Technical architecture of Sintenel-CLI's multi-agent security orchestration system.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User (CLI)                           │
└───────────────────────┬─────────────────────────────────────┘
                        │ Goal: "Fix SQL injection in src/"
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                        │
│  • Strategic planning                                        │
│  • Risk assessment                                           │
│  • Execution plan generation                                 │
│  • Human approval gate                                       │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       ┌───────▼────────┐           ┌────────▼────────┐
       │  Scout Agent   │           │  Fixer Agent    │
       │  (Read-Only)   │           │  (Write-After-  │
       │                │           │   Approval)     │
       └───────┬────────┘           └────────┬────────┘
               │                              │
       ┌───────▼────────┐           ┌────────▼────────┐
       │   Tools:       │           │   Tools:        │
       │ • fileOperator │           │ • fileOperator  │
       │ • executeShell │           │ • executeShell  │
       │   (read-only)  │           │   (approved)    │
       └───────┬────────┘           └────────┬────────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
                 ┌─────────────────────────┐
                 │   File System / Shell   │
                 │  • Path security        │
                 │  • Policy enforcement   │
                 └─────────────────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │    Audit Trail          │
                 │  • Hash-chained log     │
                 │  • HMAC signing         │
                 │  • Exportable bundles   │
                 └─────────────────────────┘
```

## Component Breakdown

### 1. CLI Layer (`src/index.ts`)

**Responsibilities**:
- Parse command line arguments
- Load environment configuration
- Initialize working directory
- Invoke agent manager

**Key Code**:
```typescript
program
  .argument('<goal>', 'Security objective')
  .option('-d, --cwd <dir>', 'Working directory')
  .action(async (goal, options) => {
    const cwd = options.cwd || process.cwd();
    await runOrchestratorSession(cwd, goal);
  });
```

### 2. Agent Manager (`src/engine/agentManager.ts`)

**Responsibilities**:
- Model selection (tiered strategy)
- Agent lifecycle management
- Tool creation and provisioning
- Conversation state management
- Cost tracking and optimization

**Key Functions**:
- `getModel()`: Select AI model based on agent type
- `runOrchestratorSession()`: Main orchestration loop
- `runSubAgent()`: Execute Scout/Fixer sub-agents
- `pruneMessages()`: Trim conversation history
- `isAgentStuck()`: Detect repetitive loops

### 3. Agent Prompts (`src/agents/`)

**orchestrator.ts**: Strategic planner
```typescript
"Orchestrator. Assess goal → plan → approve → delegate.
- submitExecutionPlan (risks, commands, scope)
- delegateToScout for recon
- delegateToFixer for patches
- Never modify files directly"
```

**scout.ts**: Reconnaissance specialist
```typescript
"Scout (recon). Find vulnerabilities via safe inspection.
- READ-ONLY: fileOperator read, executeShell (ls/grep)
- Report: paths, line hints, risk levels"
```

**fixer.ts**: Remediation specialist
```typescript
"Fixer. Write patches and verify.
- fileOperator (write/patch)
- executeShell (build/test/lint)
- Minimal targeted changes"
```

### 4. Tools (`src/tools/`)

#### fileOperator (`fileOperator.ts`)

**Actions**:
- `read`: Read file or line ranges
- `write`: Create/overwrite files with optional backup
- `patch`: Smart snippet replacement with context
- `delete`: Remove files/directories (requires destructive ops flag)
- `rename`: Move/rename files

**Security**:
- Path validation via `resolveUnderRoot()`
- Binary file detection
- Size limits (10MB read, 5MB write)
- Backup support
- Write permission checks

#### executeShell (`executeShell.ts`)

**Capabilities**:
- Auto-detect shell (bash/PowerShell)
- Manual override support
- Timeout protection (60s)
- Output buffering (8MB)
- Policy evaluation

**Security**:
- Command must be in approved plan
- Policy allow/deny list evaluation
- Audit logging before/after execution

#### submitExecutionPlan (`submitExecutionPlan.ts`)

**Schema**:
```typescript
{
  summary: string;
  context: {
    objective: string;
    scope: string;
    risks: string[];
    rollbackPlan: string;
  };
  commands: Array<{
    purpose: string;
    command: string;
  }>;
}
```

**Flow**:
1. Orchestrator generates plan
2. Tool validates schema
3. User reviews plan table
4. User approves (Y/N + optional challenge)
5. Plan stored as approved set

### 5. Utilities (`src/utils/`)

#### audit.ts

**Features**:
- Hash-chained entries (seq, prevHash, hash)
- Optional HMAC signing
- Export to signed bundles
- Verification with integrity checks

**Entry Types**:
- `system`: Lifecycle events
- `tool`: Tool invocations
- `ai`: Agent responses
- `command`: Shell executions

#### paths.ts

**Security**:
```typescript
resolveUnderRoot(root: string, userPath: string): string
```
- Resolves to absolute path
- Verifies within root boundary
- Checks for symlink escapes
- Prevents UNC/absolute paths

#### ui.ts

**Components**:
- Spinners (agent status)
- Progress bars (multi-step tasks)
- Tables (plans, results)
- Colored output (agents, severity)
- Token usage display

#### confirm.ts

**Approval Types**:
- `confirmYesNo()`: Standard Y/N
- `confirmApprovalChallenge()`: Type random token

### 6. Policy (`src/policy/`)

#### commandPolicy.ts

**Evaluation Logic**:
```typescript
evaluateCommandPolicy(command: string): {
  allowed: boolean;
  reason?: string;
}
```

**Rules**:
1. Tokenize command
2. Check against allow list (strict mode) or skip (permissive)
3. Scan for high-risk deny patterns
4. Return verdict with reason

## Data Flow

### Session Lifecycle

```
1. User Input
   ↓
2. Orchestrator Receives Goal
   ↓
3. [Optional] Scout Reconnaissance
   ↓
4. Orchestrator Builds Execution Plan
   ↓
5. submitExecutionPlan → Human Review
   ↓
6. User Approves (Y/N)
   ↓
7. Plan Stored as Approved
   ↓
8. [Parallel] Scout Gathers Intelligence
   ↓
9. [Sequential] Fixer Applies Remediations
   ↓
10. Orchestrator Verifies + Summarizes
   ↓
11. Audit Log Finalized
   ↓
12. Session Complete (Usage Stats)
```

### Audit Trail Flow

```
Agent Action → Tool Invocation → appendAuditLog()
                                      ↓
                         Compute: seq, prevHash, hash
                                      ↓
                         Append to sentinel-audit.log
                                      ↓
                         Update chain state in memory
```

### Tool Execution Flow

```
Agent calls tool
   ↓
Tool validates input (Zod schema)
   ↓
Check permissions (writeAllowed, executionAllowed)
   ↓
Check approval (if needed)
   ↓
Validate paths (resolveUnderRoot)
   ↓
Execute operation
   ↓
Log to audit trail
   ↓
Return result to agent
```

## Cost Optimization Strategy

### Token Flow

```
User Goal (50 tokens)
   ↓
Orchestrator System Prompt (85 tokens) ← Optimized from 165
   ↓
Orchestrator Response (max 4096 tokens)
   ↓
Scout System Prompt (40 tokens) ← Optimized from 80
   ↓
Scout Response (max 2048 tokens) ← Lightweight model
   ↓
Fixer System Prompt (45 tokens) ← Optimized from 90
   ↓
Fixer Response (max 2048 tokens) ← Lightweight model
   ↓
Final Summary (500 tokens avg)

Total: ~9K tokens avg (vs 25K naive)
Savings: 64% token reduction
```

### Model Selection

```
┌─────────────────┐
│   User Request  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Orchestrator (Strategic)        │
│ Model: gemini-3-flash-preview   │ ← Full reasoning
│ Cost: $0.075/1M input tokens    │
└────────┬────────────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──────────┐  ┌──────────▼────┐
│ Scout        │  │ Fixer         │
│ Model: lite  │  │ Model: lite   │ ← Lightweight
│ Cost: 60%↓   │  │ Cost: 60%↓    │
└──────────────┘  └───────────────┘

Result: 75% cost reduction overall
```

## Security Boundaries

### Permission Model

| Agent | fileOperator read | fileOperator write | executeShell | executePowerShell |
|-------|-------------------|--------------------|--------------|-------------------|
| **Orchestrator** | ❌ Delegates | ❌ Delegates | ❌ Plans | ❌ Plans |
| **Scout** | ✅ Yes | ❌ Blocked | ✅ Read-only | ✅ Read-only |
| **Fixer** | ✅ Yes | ✅ After approval | ✅ Approved | ✅ Approved |

### Path Security Layers

```
User Input: "../../etc/passwd"
   ↓
Layer 1: Reject absolute paths
   ↓
Layer 2: Resolve relative path
   ↓
Layer 3: Normalize (remove .., .)
   ↓
Layer 4: Check if within root
   ↓
Layer 5: Resolve symlinks
   ↓
Layer 6: Verify resolved path within root
   ↓
SAFE: "/workspace/etc/passwd" ✅
or
BLOCKED: Path escapes root ❌
```

## Extensibility Points

### Adding New Agents

1. Create system prompt in `src/agents/`
2. Add agent type to `agentManager.ts`
3. Define tool permissions
4. Update delegation schema

### Adding New Tools

1. Create tool in `src/tools/`
2. Define Zod schema for inputs
3. Implement execute function
4. Add to agent tool lists
5. Write unit tests

### Adding New Policies

1. Update `commandPolicy.ts` allow/deny lists
2. Add evaluation rules
3. Test edge cases
4. Document in policy guide

### Adding New Models

1. Set environment variable:
   ```env
   AI_MODEL=openai:gpt-4-turbo
   AI_SUBAGENT_MODEL=openai:gpt-3.5-turbo
   ```
2. Import provider (`@ai-sdk/openai`)
3. Update `getModel()` function

## Technology Stack

### AI & LLM
- **Vercel AI SDK** (`ai`): Multi-provider LLM framework
- **Google Gemini** (`@ai-sdk/google`): Primary model provider
- **OpenAI** (`@ai-sdk/openai`): Alternative provider
- **Anthropic** (`@ai-sdk/anthropic`): Alternative provider

### CLI & UX
- **Commander** (`commander`): Argument parsing
- **Chalk** (`chalk`): Terminal colors
- **Ora** (`ora`): Spinners
- **CLI Progress** (`cli-progress`): Progress bars
- **CLI Table** (`cli-table3`): Formatted tables

### Development
- **TypeScript** (`typescript`): Static typing
- **TSX** (`tsx`): Development execution
- **Vitest** (`vitest`): Testing framework
- **Node.js**: v20+ runtime

### Security
- **Zod** (`zod`): Input validation
- **crypto**: Hash chain computation
- **fs**: File operations with safety checks

## Performance Characteristics

### Latency

| Operation | Time | Notes |
|-----------|------|-------|
| Orchestrator planning | 5-8s | Depends on complexity |
| Scout reconnaissance | 3-5s | Per file scan |
| Fixer remediation | 2-4s | Per file patch |
| Total (simple task) | 15-25s | End-to-end |
| Total (complex task) | 45-90s | Multi-file workflows |

### Cost

| Agent | Tokens/Call | Cost/Call | % of Total |
|-------|-------------|-----------|------------|
| Orchestrator | 5K-8K | $0.0008 | 45% |
| Scout | 2K-3K | $0.0002 | 25% |
| Fixer | 2K-3K | $0.0002 | 30% |
| **Total** | **9K-14K** | **$0.0012-0.0020** | **100%** |

### Scalability

- **Max File Size**: 10MB (configurable)
- **Max Files**: 10K+ (limited by LLM context)
- **Concurrent Agents**: 2 (Scout + Fixer in parallel)
- **Session Length**: 25 turns before pruning
- **Token Limit**: 4096 output (orchestrator), 2048 (sub-agents)

## Design Decisions

### Why Multi-Agent?

**Alternatives Considered**:
1. Single agent with all permissions → Security risk, no isolation
2. Sequential agents (Scout then Fixer) → Slower, no parallelism
3. No agents, direct LLM calls → No conversation state, no delegation

**Chosen**: Multi-agent with role-based permissions
- **Pros**: Security isolation, parallel execution, cost-efficient
- **Cons**: Slightly more complex, delegation overhead

### Why Hash-Chained Audit?

**Alternatives Considered**:
1. Simple logging → No tamper detection
2. Signed individual entries → Storage overhead
3. Database audit trail → External dependency

**Chosen**: Hash-chained log with optional HMAC
- **Pros**: Tamper-evident, portable, no dependencies
- **Cons**: Sequential writes only (no parallel appends)

### Why Human Approval?

**Alternatives Considered**:
1. Fully autonomous → Too risky for security work
2. Review after execution → Can't undo destructive ops
3. Approve every command → Too tedious

**Chosen**: Plan-based approval (batch commands)
- **Pros**: Safety + usability balance
- **Cons**: Requires understanding plan format

### Why Gemini?

**Alternatives Considered**:
1. GPT-4: Too expensive ($0.10/task)
2. Claude: Good but mid-tier pricing
3. Open-source models: Quality inconsistent

**Chosen**: Gemini (flash models)
- **Pros**: Fast, cheap, good quality
- **Cons**: Rate limits on free tier

## Error Handling Strategy

### Levels

1. **Validation Errors**: Caught by Zod schemas → Return to agent
2. **Permission Errors**: Write blocked → Inform user
3. **Path Errors**: Traversal attempt → Security error
4. **Execution Errors**: Command failed → Log + retry prompt
5. **AI Errors**: Rate limit → Exponential backoff

### Recovery

- **File Operations**: Automatic backup on `backupExisting: true`
- **Command Failures**: Agent retries with modified approach
- **Agent Loops**: Early termination after 5 similar messages
- **Context Overflow**: Prune history, maintain state

## Testing Strategy

### Test Pyramid

```
    ▲
   / \
  /E2E\ (4 integration tests)
 /─────\
/  Unit  \ (41 unit tests)
──────────
```

**Unit Tests** (91% of tests):
- Path security: 10 tests
- File operations: 27 tests
- Audit chain: 4 tests

**Integration Tests** (9% of tests):
- Multi-file remediation
- Audit trail continuity
- Security boundary enforcement
- Backup/rollback workflows

### CI/CD Matrix

```
     Ubuntu    Windows   macOS
20.x   ✓         ✓         ✓
22.x   ✓         ✓         ✓
```

6 parallel jobs, ~2 minutes total

## Future Architecture

### Phase 2: CVE Integration

```
┌──────────────┐
│ CVE Database │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Scout (Enhanced)│
│  • CVE matching  │
│  • CVSS scoring  │
└─────────────────┘
```

### Phase 3: Plugin System

```
┌────────────────┐
│ Plugin Manager │
└────────┬───────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│SAST │  │DAST  │
│Plugin│  │Plugin│
└─────┘  └──────┘
```

### Phase 4: Web Dashboard

```
┌───────────────┐
│  Web Frontend │
│  • Audit viz  │
│  • Team collab│
└───────┬───────┘
        │ REST API
        ▼
┌───────────────┐
│  Backend API  │
│  • Auth       │
│  • Storage    │
└───────────────┘
```

---

## Key Architectural Principles

1. **Defense in Depth**: Multiple security layers (path, permission, policy, approval)
2. **Fail-Safe Defaults**: Write blocked by default, destructive ops disabled
3. **Audit Everything**: Every action logged for forensics
4. **Cost-Conscious**: Every token counts, optimize aggressively
5. **User Control**: Human has final say, agents advise
6. **Separation of Concerns**: Each agent has single responsibility
7. **Stateless Tools**: Tools have no memory, agents maintain state

---

**Architecture Status**: ✅ Production-ready, well-documented, extensible

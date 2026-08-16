# MERN Agentic Setup Guide

This guide explains how to use the MERN Agentic Agent (`agentic-mern.ts`) for your MongoDB-Express-React-Node stack.

## What is the MERN Agentic Agent?

It's an AI-powered bot that:
- 🔍 **Diagnoses** CI/CD failures from GitHub Actions logs
- 🤖 **Generates** automatic fixes using Google Gemini AI
- 🧪 **Validates** fixes by running your test suite
- 📝 **Creates PRs** with automatic fixes ready for review
- 🔄 **Learns** from previous attempts to avoid repeating mistakes

## Key Differences from Python Version

| Aspect | Python Version | MERN Version |
|--------|---|---|
| **Language** | Python | TypeScript/JavaScript |
| **Runtime** | Python 3.x | Node.js 18+ |
| **Test Framework** | pytest | Jest |
| **Linting** | Python linters | ESLint |
| **File Types** | `.py` | `.js`, `.jsx`, `.ts`, `.tsx` |
| **Code Analysis** | Python AST | Simple regex/string matching |
| **GitHub Library** | PyGithub | Octokit |
| **LLM Library** | LangChain (Python) | LangChain (TypeScript) |

## Setup Steps

### 1. Install Dependencies

```bash
npm install --save-dev \
  typescript \
  @langchain/google-genai \
  @octokit/rest \
  dotenv \
  adm-zip
```

### 2. Configure Environment Variables

Create a `.env` file in your project root:

```env
# Gemini AI
GEMINI_API_KEY=your_google_api_key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_TEMP=0.2

# GitHub
GITHUB_TOKEN=your_github_token
GITHUB_REPO=owner/repo
GITHUB_BASE_BRANCH=main
WORKFLOW_RUN_ID=  # Optional: specific workflow run ID

# Agentic Settings
MAX_ITERATIONS=3
HITL_ENABLED=true
AUTO_MERGE=false  # Only auto-merge if you trust the agent
```

### 3. Project Structure

```
your-mern-repo/
├── server/                 # Express backend
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── tests/              # Server tests
├── src/                    # React frontend
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── __tests__/          # Client tests
├── agentic-mern.ts         # The agent file
├── package.json
├── jest.config.js          # Jest configuration
├── tsconfig.json           # TypeScript config
└── .env                    # Environment variables
```

### 4. Configure Jest for Both Server & Client

Create `jest.config.js`:

```javascript
module.exports = {
  projects: [
    {
      displayName: "server",
      testEnvironment: "node",
      testMatch: ["<rootDir>/server/**/__tests__/**/*.test.ts"],
      transform: {
        "^.+\\.tsx?$": "ts-jest",
      },
    },
    {
      displayName: "client",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/src/**/__tests__/**/*.test.tsx"],
      transform: {
        "^.+\\.tsx?$": "ts-jest",
      },
      moduleNameMapper: {
        "\\.(css|less|scss)$": "identity-obj-proxy",
      },
    },
  ],
};
```

### 5. Add npm Scripts

Update `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:server": "jest --selectProjects=server",
    "test:client": "jest --selectProjects=client",
    "build:server": "tsc server/**/*.ts --outDir dist/server",
    "build:client": "react-scripts build",
    "agent": "npx ts-node agentic-mern.ts",
    "agent:watch": "npx ts-node-dev agentic-mern.ts"
  }
}
```

## How It Works (The Flow)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. FETCH LOGS NODE                                          │
│    Retrieves failing GitHub Actions logs                    │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ANALYZE CODE NODE                                        │
│    • Parses error logs                                       │
│    • Identifies if issue is in server or client             │
│    • Finds target file to fix                               │
│    • Creates repair strategy                                │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. FIX CODE NODE                                            │
│    • Reads target file                                      │
│    • Gets context from files that import it                 │
│    • Uses Gemini AI to generate surgical edits              │
│    • Applies edits line-by-line                             │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. LINT CHECK NODE                                          │
│    • Runs Node.js syntax validation                         │
│    • Ensures code is valid JavaScript/TypeScript            │
└─────────────┬───────────────────────────────────────────────┘
              │
          ┌───┴─────────┐
          │             │
      Success       Syntax Error
          │             │
          ▼             ▼
┌──────────────┐   Retry Fix Node
│ 5. TEST NODE │   (up to MAX_ITERATIONS)
│ Runs Jest    │
└──────┬───────┘
       │
    ┌──┴──┐
    │     │
 Pass  Fail
    │     │
    ▼     ▼
  Success Retry
```

## Running the Agent

### Option 1: Manually (Development)

```bash
export GEMINI_API_KEY=your_key
export GITHUB_TOKEN=your_token
export GITHUB_REPO=owner/repo

npm run agent
```

### Option 2: GitHub Actions Workflow

Create `.github/workflows/agentic-repair.yml`:

```yaml
name: Agentic Repair

on:
  workflow_run:
    workflows: ["Tests", "Build"]
    types: [completed]

jobs:
  repair:
    if: ${{ github.event.workflow_run.conclusion == 'failure' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm install

      - name: Run Agentic Agent
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPO: ${{ github.repository }}
          WORKFLOW_RUN_ID: ${{ github.event.workflow_run.id }}
        run: npm run agent
```

## Key Configuration Options

| Env Variable | Default | Purpose |
|---|---|---|
| `MAX_ITERATIONS` | 3 | Max repair attempts |
| `GEMINI_MODEL` | gemini-2.0-flash | Which AI model to use |
| `GEMINI_TEMP` | 0.2 | AI creativity (0=deterministic, 1=creative) |
| `HITL_ENABLED` | true | Require human approval before PR |
| `AUTO_MERGE` | false | Auto-merge successful PRs |

## Common Issues & Fixes

### Issue: "No logs found"
- **Cause**: Workflow run ID not found or logs not available
- **Fix**: Ensure `GITHUB_TOKEN` has access, check `WORKFLOW_RUN_ID`

### Issue: "Syntax errors after fix"
- **Cause**: AI generated invalid JavaScript
- **Fix**: Lower `GEMINI_TEMP` (more deterministic) or increase `MAX_ITERATIONS`

### Issue: "Tests still failing"
- **Cause**: AI misunderstood root cause
- **Fix**: Improve error logs sent to agent, add more context files

### Issue: "Can't find files to modify"
- **Cause**: File paths don't match
- **Fix**: Ensure server/ and src/ directories exist

## Advanced Usage

### Custom Test Commands

Modify the `testCodeNode` function to use your specific test command:

```typescript
// For Mocha instead of Jest
const { stdout, stderr } = await execAsync("npm run test:mocha", { ... });

// For specific test suite
const { stdout, stderr } = await execAsync("npm test -- --testPathPattern=server", { ... });
```

### Adding Custom Validation

Extend the agent with additional checks:

```typescript
async function customValidationNode(state: AgenticState) {
  // Your custom validation logic
  // E.g., check TypeScript compilation, ESLint, etc.
}
```

### Memory Persistence

The agent saves audit logs to `agentic_tmp/` for debugging:

```bash
ls agentic_tmp/
# iter_0_analyze_response.json
# iter_0_fix_response.json
# iter_1_analyze_response.json
# final_rca.json
```

## Security Considerations

⚠️ **Important**: Be cautious with auto-merge!

- Always review PRs before auto-merging
- Start with `AUTO_MERGE=false`
- Use branch protection rules
- Test in a staging environment first
- Monitor agent's repair quality over time

## Comparing Python vs TypeScript Agent

### Python Version (Original)
```python
# More Pythonic, simpler for Python projects
# Uses PyGithub (Python-specific)
# Works with pytest/unittest
# Better for Python-only repositories
```

### TypeScript Version (MERN)
```typescript
// Works for both server & client
// Native to Node.js ecosystem
// Works with Jest/Mocha/Vitest
// Better for MERN stack projects
// Can be compiled to JavaScript
```

## Next Steps

1. ✅ Set up environment variables
2. ✅ Configure package.json with npm scripts
3. ✅ Test locally with manual trigger
4. ✅ Set up GitHub Actions workflow
5. ✅ Monitor and tune MAX_ITERATIONS
6. ✅ Enable AUTO_MERGE when confident

## Troubleshooting

Check agent logs:
```bash
# View recent audit files
cat agentic_tmp/final_rca.json

# Stream logs
npm run agent -- 2>&1 | tee agent.log
```

Get detailed error info:
```bash
DEBUG=* npm run agent
```

## See Also

- [LangChain TypeScript Docs](https://js.langchain.com/)
- [Octokit Documentation](https://octokit.github.io/rest.js/)
- [Google Gemini API](https://ai.google.dev/)
- [Jest Documentation](https://jestjs.io/)

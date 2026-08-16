# MERN Agentic Agent - Quick Start Guide

## What You Just Got

I've created a complete autonomous code repair agent for your MERN stack. Here's what's included:

### 📁 Files Created:

1. **`agentic-mern.ts`** - Main agent (TypeScript)
   - Fetches GitHub Actions logs
   - Analyzes failures with Gemini AI
   - Fixes both server & client code
   - Runs tests automatically
   - Creates PRs with fixes

2. **`AGENTIC_MERN_SETUP.md`** - Detailed setup guide
   - Installation steps
   - Environment configuration
   - Project structure
   - Advanced usage

3. **`MERN_AGENTIC_COMPARISON.md`** - Python vs TypeScript comparison
   - Side-by-side examples
   - Real-world scenarios
   - Common fixes

4. **`package-agentic.json`** - Dependencies template
   - All required npm packages
   - Dev tools configuration
   - Build scripts

5. **`jest.config.example.js`** - Jest configuration
   - Server tests (Node.js)
   - Client tests (React)
   - Coverage settings

6. **`tsconfig.example.json`** - TypeScript configuration
   - Strict type checking
   - Path aliases
   - React JSX support

7. **`.github-workflows-agentic-repair.yml`** - GitHub Actions workflow
   - Automatic trigger on test failures
   - Agent execution
   - PR creation

---

## 🚀 Getting Started (5 Steps)

### Step 1: Install Dependencies

```bash
# Copy the example configuration
cp package-agentic.json package.json

# Install all dependencies
npm install
```

### Step 2: Get API Keys

Get these from:
- **Gemini API Key**: https://ai.google.dev/
- **GitHub Token**: https://github.com/settings/tokens (repo + workflow permissions)

### Step 3: Create `.env` File

```env
# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
GEMINI_TEMP=0.2

# GitHub
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO=yourusername/yourrepo
GITHUB_BASE_BRANCH=main

# Agent Settings
MAX_ITERATIONS=3
AUTO_MERGE=false        # Set to true only when confident
HITL_ENABLED=true       # Require human approval
```

### Step 4: Copy Configuration Files

```bash
# TypeScript config
cp tsconfig.example.json tsconfig.json

# Jest config
cp jest.config.example.js jest.config.js
```

### Step 5: Update Project Structure

Ensure your project has this structure:

```
your-project/
├── server/                          # Express backend
│   ├── controllers/
│   │   └── __tests__/
│   │       └── userController.test.ts
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   └── index.ts
├── src/                             # React frontend
│   ├── components/
│   │   └── __tests__/
│   │       └── UserForm.test.tsx
│   ├── hooks/
│   ├── pages/
│   └── index.tsx
├── agentic-mern.ts
├── package.json
├── tsconfig.json
├── jest.config.js
├── .env
└── .github/
    └── workflows/
        └── agentic-repair.yml
```

---

## 🧪 Test the Agent Locally

### Option 1: Simulate a Failure

```bash
# Make your tests fail intentionally
echo "throw new Error('Test failure')" >> server/controllers/test.ts

# Run agent
npm run agent
```

### Option 2: Use Actual Failed Workflow

```bash
# Set a workflow run ID
export WORKFLOW_RUN_ID=12345678

# Run agent
npm run agent
```

### Option 3: Watch Mode (Development)

```bash
npm run agent:watch
```

---

## 📊 How the Agent Works

```
Your test fails ❌
        ↓
GitHub Actions runs workflow
        ↓
Tests fail 🔴
        ↓
Agentic Agent wakes up 🤖
        ↓
┌─────────────────────────────┐
│ 1. Fetches error logs       │
│ 2. Analyzes root cause      │
│ 3. Identifies server/client │
│ 4. Generates fix            │
│ 5. Applies edits            │
│ 6. Syntax check             │
│ 7. Runs tests               │
│ 8. Creates PR               │
└─────────────────────────────┘
        ↓
Tests pass ✅
        ↓
PR created for review 📝
```

---

## 🔧 Common Configuration Scenarios

### Scenario 1: Local Development

```env
MAX_ITERATIONS=1            # Quick feedback
AUTO_MERGE=false            # Never auto-merge locally
HITL_ENABLED=true           # Always require approval
```

**Run:**
```bash
npm run agent:watch
```

### Scenario 2: Staging Environment

```env
MAX_ITERATIONS=3
AUTO_MERGE=false
HITL_ENABLED=true           # Must review before merge
```

**Setup:** GitHub Actions trigger only on `staging` branch

### Scenario 3: Production (Careful!)

```env
MAX_ITERATIONS=3
AUTO_MERGE=true             # Only after extensive testing!
HITL_ENABLED=false          # Auto-merge without approval
```

⚠️ **Only use AUTO_MERGE=true after:**
- Monitoring agent quality for 1 month
- Building confidence in fix patterns
- Setting branch protection rules

---

## 🐛 Debugging

### View Agent Logs

```bash
# Real-time logs
npm run agent:debug

# View last run
cat agentic_tmp/final_rca.json | jq

# See all iterations
ls -la agentic_tmp/
cat agentic_tmp/iter_0_analyze_response.json
```

### Check Test Output

```bash
# Run tests to see actual errors
npm test 2>&1 | head -50

# Run specific test suite
npm run test:server
npm run test:client
```

### Inspect AI's Thinking

```bash
# View what Gemini AI analyzed
cat agentic_tmp/iter_0_analyze_response.json | jq '.response'

# View the fix it generated
cat agentic_tmp/iter_0_fix_response.json | jq '.edits'
```

---

## 📝 What the Agent Can Fix

### Server (Express/Node.js) Fixes
✅ Null/undefined reference errors  
✅ Missing imports or modules  
✅ Type errors in middleware  
✅ Database connection issues  
✅ Route handler errors  
✅ Async/await issues  

### Client (React) Fixes
✅ Missing props validation  
✅ React hook errors  
✅ Component rendering issues  
✅ JSX syntax errors  
✅ Import path issues  

### Both
✅ Missing dependencies  
✅ Configuration errors  
✅ TypeScript type issues  

---

## ⚠️ What the Agent CANNOT Fix

❌ Design changes  
❌ Logic refactoring  
❌ Breaking API changes  
❌ Database migrations  
❌ Infrastructure issues  
❌ Third-party service failures  

---

## 🔐 Security Best Practices

1. **Never use AUTO_MERGE=true initially**
   ```env
   AUTO_MERGE=false
   ```

2. **Require branch protection rules**
   - GitHub → Settings → Branches → Add rule
   - Require approvals before merge
   - Dismiss stale reviews on push

3. **Limit GITHUB_TOKEN permissions**
   - Create token with only `repo` + `workflow` scopes
   - Rotate token periodically

4. **Monitor agent activity**
   - Review all PRs it creates
   - Track fix success rate
   - Disable if quality drops

5. **Keep Gemini API key secure**
   - Use GitHub Secrets, NOT environment file
   - Rotate key monthly

---

## 📊 Monitoring Agent Performance

Track these metrics:

```bash
# Success rate
cat agentic_tmp/final_rca.json | jq '.success'

# Iterations needed
cat agentic_tmp/final_rca.json | jq '.iterations_taken'

# Files modified
cat agentic_tmp/final_rca.json | jq '.files_modified'

# Common errors (search logs)
grep "ERROR" agentic_tmp/*.json
```

---

## 🚀 Next Steps

### Immediate (Day 1)
1. ✅ Copy config files
2. ✅ Set environment variables
3. ✅ Run agent locally on a test failure

### Short-term (Week 1)
1. ✅ Set up GitHub Actions workflow
2. ✅ Monitor first 5 automatic repairs
3. ✅ Adjust MAX_ITERATIONS if needed

### Medium-term (Month 1)
1. ✅ Build confidence in agent quality
2. ✅ Enable AUTO_MERGE (cautiously)
3. ✅ Document patterns it finds
4. ✅ Share results with team

### Long-term (Ongoing)
1. ✅ Track ROI (time saved)
2. ✅ Improve error documentation
3. ✅ Extend agent with custom validators
4. ✅ Integrate with other workflows

---

## 🤔 Common Questions

### Q: Will the agent break my code?
**A:** No. It:
- Creates PRs (doesn't auto-merge initially)
- Runs tests before creating PR
- Requires human review
- Can be disabled anytime

### Q: How much does it cost?
**A:** Very cheap:
- Gemini API: ~$0.075 per 1M input tokens
- Typically <$0.10 per repair
- GitHub Actions: Free tier included

### Q: How long does a repair take?
**A:** Usually 1-3 minutes:
- Log fetching: 10 sec
- AI analysis: 20 sec
- Code generation: 20 sec
- Test execution: 60 sec
- PR creation: 10 sec

### Q: Can it handle complex bugs?
**A:** It's best for:
- Simple syntax errors
- Null reference fixes
- Missing imports
- Type errors

**It struggles with:**
- Complex logic changes
- Multi-file refactors
- Business logic bugs

### Q: What if tests still fail?
**A:** It will retry up to MAX_ITERATIONS times, learning from each attempt.

---

## 📚 Further Reading

- [AGENTIC_MERN_SETUP.md](./AGENTIC_MERN_SETUP.md) - Detailed setup
- [MERN_AGENTIC_COMPARISON.md](./MERN_AGENTIC_COMPARISON.md) - Python vs MERN
- [Google Gemini API Docs](https://ai.google.dev/)
- [LangChain JS Docs](https://js.langchain.com/)
- [Jest Docs](https://jestjs.io/)

---

## 💡 Pro Tips

1. **Start with low stakes**
   - Test on develop branch first
   - Monitor for a week before prod

2. **Document your tests**
   - Better test names = better AI understanding
   - Clear error messages help the agent

3. **Keep error logs clean**
   - Remove noise from logs
   - Focus on actual error messages

4. **Iterate GEMINI_TEMP**
   - Lower (0.1-0.3): More consistent, fewer creative fixes
   - Higher (0.5-1.0): More creative, more risky

5. **Use HITL_ENABLED**
   - Always require human approval initially
   - Great way to learn what agent can do

---

## ✅ Checklist

Before deploying to production:

- [ ] Created `.env` with API keys
- [ ] Installed dependencies with `npm install`
- [ ] Copied config files (tsconfig.json, jest.config.js)
- [ ] Tested agent locally with `npm run agent`
- [ ] Set up GitHub Actions workflow
- [ ] Monitored 10+ agent repairs
- [ ] Set branch protection rules
- [ ] Limited GITHUB_TOKEN permissions
- [ ] Reviewed and approved agent PRs
- [ ] Set AUTO_MERGE=false initially
- [ ] Documented team processes

---

**Ready to automate your bug fixes?** 🚀

```bash
npm run agent
```

Good luck! 🎉

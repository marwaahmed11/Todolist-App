# MERN Agentic Agent - Practical Comparison Guide

## Quick Reference: Python vs MERN Agent

### 1. **Analyzing Errors**

#### Python Version
```python
# Looks for Python-specific errors
error_keywords = ["ImportError", "SyntaxError", "AssertionError", "NameError"]
repo_files = Path('.').rglob('*.py')  # Only .py files
```

#### MERN Version
```typescript
// Looks for JavaScript/Node/React errors
error_keywords = ["TypeError", "ReferenceError", "SyntaxError", "Cannot find module", "React.PropTypes"];
const serverFiles = walkDir("server", [".js", ".ts"]);
const clientFiles = walkDir("src", [".js", ".jsx", ".ts", ".tsx"]);
```

---

### 2. **Identifying Problem Location**

#### Python Example
```
Error: TypeError: object has no attribute 'save'
File: services/user_service.py, line 45
```

❌ **Problem**: User model missing `save()` method

✅ **Fix**: Add method to `User` model class

#### MERN Example
```
Error: TypeError: Cannot read property 'data' of undefined
at UserController.getUsers (server/controllers/userController.ts:23)
```

❌ **Problem**: Response object might be null in middleware

✅ **Fix**: Add null check in userController.ts

---

### 3. **Code Patching Differences**

#### Python Patch Example
```python
# Original (broken)
def save_user(user):
    user.save()  # ❌ AttributeError

# AI generates this fix
def save_user(user):
    if hasattr(user, 'save'):  # ✅ Check exists first
        user.save()
    else:
        db.session.add(user)
        db.session.commit()
```

#### MERN Patch Example
```typescript
// Original (broken)
const getUsers = async (req, res) => {
  const users = await User.find();
  res.json(users);  // ❌ What if req.user is null?
};

// AI generates this fix
const getUsers = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const users = await User.find();
  res.json(users);  // ✅ Now safe
};
```

---

### 4. **Testing Differences**

#### Python Tests (pytest)
```bash
pytest tests/ -v
# Output:
# tests/test_user.py::test_save_user PASSED
# tests/test_user.py::test_delete_user FAILED
```

#### MERN Tests (Jest)
```bash
npm test
# Output:
# PASS server/controllers/__tests__/userController.test.ts
# PASS src/components/__tests__/UserForm.test.tsx
# FAIL server/models/__tests__/User.test.ts
```

---

### 5. **Real-World Scenario: API Endpoint Bug**

#### Python Service (Original)
```python
# services/user_service.py
def get_user_profile(user_id: int):
    user = User.query.get(user_id)
    return user.to_dict()  # ❌ Crashes if user is None
```

**Error Log:**
```
AttributeError: 'NoneType' object has no attribute 'to_dict'
```

**AI Repair:**
```python
def get_user_profile(user_id: int):
    user = User.query.get(user_id)
    if not user:  # ✅ Added null check
        raise NotFoundError(f"User {user_id} not found")
    return user.to_dict()
```

---

#### MERN Service (Original)
```typescript
// server/controllers/userController.ts
export const getUserProfile = async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  res.json(user.profile);  // ❌ Crashes if user is null
};
```

**Error Log:**
```
TypeError: Cannot read property 'profile' of null
```

**AI Repair:**
```typescript
export const getUserProfile = async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {  // ✅ Added null check
    return res.status(404).json({ error: "User not found" });
  }
  
  res.json(user.profile);
};
```

---

### 6. **File Dependency Tracking**

#### Python: Finding Callers
```python
# Agent searches for imports
if f"from {target_module} import" in source:
    # Found dependency
    
# Example: If fixing services/user_service.py
# Searches for: "from user_service import" across all .py files
```

#### MERN: Finding Importers
```typescript
// Agent searches for imports in both server & client
if (content.includes(`import`) && content.includes(targetModule)) {
  // Found dependency
}

// Example: If fixing server/controllers/userController.ts
// Searches for: "import { ... } from './userController'" 
// across all .ts, .tsx files
```

---

### 7. **Environment-Specific Errors**

#### Python Issues
```python
❌ ModuleNotFoundError: No module named 'pandas'
❌ ImportError: cannot import name 'BaseModel' from 'pydantic'
❌ AttributeError: 'module' object has no attribute 'app'
```

#### MERN Issues
```typescript
❌ Cannot find module 'mongoose'
❌ TypeError: React.FC<Props> is not a function
❌ SyntaxError: Unexpected token } in JSON at position...
❌ ReferenceError: document is not defined (in Node context)
```

---

### 8. **How Agent Adapts to Each Stack**

**For Python Projects:**
- Reads error logs from pytest/unittest
- Analyzes Python syntax and imports
- Applies Python-specific fixes
- Runs: `pytest tests/ -v`
- Checks syntax with: `python -m py_compile`

**For MERN Projects:**
- Reads error logs from GitHub Actions (npm test)
- Analyzes JavaScript/TypeScript and imports
- Applies React/Node-specific fixes
- Runs: `npm test` (Jest)
- Checks syntax with: `node -c file.js`
- Identifies if issue is in `server/` or `src/` (client)

---

### 9. **Common Fixes by Type**

#### Python Agent Fixes
| Error | Fix Type |
|-------|----------|
| `AttributeError` | Add null check or missing method |
| `ImportError` | Fix import statement or install package |
| `TypeError` | Add type conversion or type check |
| `KeyError` | Add key existence check |
| `NameError` | Define missing variable |

#### MERN Agent Fixes
| Error | Fix Type | Location |
|-------|----------|----------|
| `Cannot read property 'x' of undefined` | Add null check | Server/Client |
| `Cannot find module 'x'` | Add import or install dependency | Server |
| `React.PropTypes deprecated` | Use TypeScript or PropTypes | Client |
| `Async/await syntax error` | Fix promise chain or async func | Server |
| `ESLint errors` | Fix linting issues | Server/Client |

---

### 10. **Debugging Agent Output**

#### Python Agent Output
```
2024-01-15 10:30:45 INFO: NODE[fetch_logs_node]: Fetching logs...
2024-01-15 10:30:46 INFO: NODE[analyze_code_node]: Planning repair strategy...
2024-01-15 10:30:47 INFO: -> Plan: Fix services/user_service.py
2024-01-15 10:31:02 INFO: NODE[fix_code_node]: Generating surgical patch
2024-01-15 10:31:05 INFO: -> Applied 2 edits
2024-01-15 10:31:10 INFO: NODE[test_code_node]: Tests PASSED
```

#### MERN Agent Output
```
2024-01-15 10:30:45 INFO: NODE[fetchLogsNode]: Fetching logs...
2024-01-15 10:30:46 INFO: NODE[analyzeCodeNode]: Planning repair strategy...
2024-01-15 10:30:47 INFO: -> Identified target: server/controllers/userController.ts (server: true)
2024-01-15 10:31:02 INFO: NODE[fixCodeNode]: Generating surgical patch
2024-01-15 10:31:05 INFO: -> Applied 3 edits to server/controllers/userController.ts
2024-01-15 10:31:10 INFO: NODE[testCodeNode]: Tests PASSED
```

---

## How to Extend the Agent

### Adding Custom Validators

#### Python
```python
def custom_validation_node(state: AgenticState) -> dict:
    # Custom validation logic
    return {"custom_result": ...}
```

#### MERN
```typescript
async function customValidationNode(state: AgenticState): Promise<Partial<AgenticState>> {
  // Custom validation logic
  return { custom_result: ... };
}
```

### Adding TypeScript-Specific Checks
```typescript
// Example: Validate TypeScript compilation
async function typescriptCheckNode(state: AgenticState) {
  const { stdout, stderr } = await execAsync("npx tsc --noEmit");
  if (stderr) {
    return { ts_errors: stderr, lint_failed: true };
  }
  return { ts_errors: "", lint_failed: false };
}
```

---

## Summary Table

| Feature | Python | MERN | Notes |
|---------|--------|------|-------|
| **Test Runner** | pytest | Jest | Both use similar JSON output |
| **Error Analysis** | Python exceptions | JS errors + stack traces | Different error formats |
| **File Search** | `*.py` only | `*.js`, `.ts`, `.jsx`, `.tsx` | MERN more complex |
| **Repo Structure** | Flat or Django | Client/Server separation | MERN needs 2 test suites |
| **Syntax Check** | `py_compile` | `node -c` | Different commands |
| **Linting** | pylint/flake8 | ESLint | Different rule systems |
| **Build Process** | Python build tools | npm/webpack/vite | More complex in MERN |
| **Import Checking** | String search | Regex + imports | Similar logic |
| **LLM Model** | Gemini Flash | Gemini Flash | Same model works |

Choose **Python Agent** if:
- ✅ Pure Python/Django/FastAPI project
- ✅ Simple file structure
- ✅ Single test suite

Choose **MERN Agent** if:
- ✅ MongoDB + Express + React + Node stack
- ✅ Separate client & server codebases
- ✅ Need to fix both frontend & backend issues

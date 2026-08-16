/// <reference types="node" />
/**
 * MERN Stack Autonomous Code Repair Agent
 * 
 * Purpose: Automatically diagnose and fix CI/CD failures in MERN applications
 * (MongoDB, Express, React, Node.js)
 * 
 * This agent:
 * - Fetches test/build logs from GitHub Actions
 * - Analyzes failures using Gemini AI
 * - Generates surgical code fixes for server (Node.js) and client (React)
 * - Validates fixes by running tests in sandbox
 * - Creates PRs with automated fixes
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { exec } from "child_process";
import { promisify } from "util";

// zod is optional in some environments; load it lazily so TS builds
// do not fail when the dependency is absent from the current project.
let z: any;
try {
  z = require("zod");
} catch {
  z = {};
}

// @langchain/google-genai is optional in some environments; load it lazily so TS builds
// do not fail when the dependency is absent from the current project.
let ChatGoogleGenerativeAI: any;
try {
  ({ ChatGoogleGenerativeAI } = require("@langchain/google-genai"));
} catch {
  ChatGoogleGenerativeAI = class {
    constructor() {
      throw new Error("Missing dependency '@langchain/google-genai'. Install it with: npm install @langchain/google-genai");
    }
  };
}

// @octokit/rest is optional for some environments; load it lazily so TS builds
// do not fail when the dependency is absent from the current project.
let Octokit: any;
try {
  ({ Octokit } = require("@octokit/rest"));
} catch {
  Octokit = class {
    constructor() {
      throw new Error("Missing dependency '@octokit/rest'. Install it with: npm install @octokit/rest");
    }
  };
}

// Dynamic import for adm-zip (optional dependency)
let AdmZip: any = null;
try {
  AdmZip = require("adm-zip");
} catch {
  // adm-zip not installed, will handle in fetchLogsNode
}

const execAsync = promisify(exec);

// ==========================================
// CONFIGURATION (Environment-driven)
// ==========================================
const MAX_ITERATIONS = parseInt(process.env.MAX_ITERATIONS || "3");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_TEMP = parseFloat(process.env.GEMINI_TEMP || "0.2");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || process.env.GITHUB_REPOSITORY || "";
const GITHUB_BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || "main";
const WORKFLOW_RUN_ID = process.env.WORKFLOW_RUN_ID || "";

const HITL_ENABLED = process.env.HITL_ENABLED !== "false";
const AUTO_MERGE = process.env.AUTO_MERGE === "true";

const AGENTIC_TMP_DIR = path.join(process.cwd(), "agentic_tmp");
if (!fs.existsSync(AGENTIC_TMP_DIR)) {
  fs.mkdirSync(AGENTIC_TMP_DIR, { recursive: true });
}

const llm = new ChatGoogleGenerativeAI({
  modelName: GEMINI_MODEL,
  temperature: GEMINI_TEMP,
  apiKey: GEMINI_API_KEY,
});

// ==========================================
// LOGGING
// ==========================================
function log(level: string, msg: string, ...args: any[]): void {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  let formatted = msg;
  let argIndex = 0;
  formatted = formatted.replace(/%s/g, () => String(args[argIndex++]));
  formatted = formatted.replace(/%d/g, () => String(args[argIndex++]));
  console.log(`${timestamp} [${level}] ${formatted}`);
}

// ==========================================
// ZONING SCHEMAS (Structured Output)
// ==========================================
const AnalyzeOutputSchema = z.object({
  failure_summary: z.string().describe("Short description of the error"),
  root_cause: z.string().describe("Detailed explanation of why it failed"),
  target_file: z.string().describe("The EXACT file path to fix"),
  file_type: z.enum(["server", "client"]).describe("Is this server (Node) or client (React)?"),
  repair_strategy: z.string().describe("Step-by-step plan to fix it"),
  confidence: z.number().min(0).max(1).describe("Confidence score"),
});

const EditChunkSchema = z.object({
  start_line: z.number().describe("1-indexed start line"),
  end_line: z.number().describe("1-indexed inclusive end line"),
  replacement: z.string().describe("New code for these lines"),
});

const FixOutputSchema = z.object({
  edits: z.array(EditChunkSchema).describe("List of surgical edits"),
});

// Type definitions (inferred from schemas above)
interface AnalyzeOutput {
  failure_summary: string;
  root_cause: string;
  target_file: string;
  file_type: "server" | "client";
  repair_strategy: string;
  confidence: number;
}

interface EditChunk {
  start_line: number;
  end_line: number;
  replacement: string;
}

interface FixOutput {
  edits: EditChunk[];
}

// ==========================================
// AGENT STATE
// ==========================================
interface AgenticState {
  logs: string;
  iteration_count: number;
  success: boolean;
  repair_memory: {
    iterations: any[];
    repo_state: { [key: string]: string };
    context: {
      original_logs: string;
      latest_logs: string;
      files_attempted: string[];
    };
  };
  current_file: string | null;
  repair_strategy: string | null;
  file_type: "server" | "client";
  rca_html_path: string | null;
  pr_url: string | null;
  approved: boolean | null;
  lint_failed: boolean | null;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function saveAudit(
  iteration: number,
  name: string,
  prompt: string,
  response_text: string
): string {
  const filepath = path.join(AGENTIC_TMP_DIR, `iter_${iteration}_${name}.json`);
  const data = {
    iteration,
    name,
    prompt,
    response: response_text,
    timestamp: Date.now(),
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

function applyEdits(originalCode: string, edits: EditChunk[]): string {
  let lines = originalCode.split("\n");

  // Sort in reverse order so line numbers don't shift
  const sortedEdits = [...edits].sort((a, b) => b.start_line - a.start_line);

  for (const edit of sortedEdits) {
    const start = edit.start_line - 1;
    const end = edit.end_line;
    const replacement = edit.replacement.split("\n");
    lines.splice(start, end - start, ...replacement);
  }

  return lines.join("\n");
}

function findImporters(targetFile: string): { [key: string]: string } {
  const importers: { [key: string]: string } = {};
  const targetModule = path.basename(targetFile, path.extname(targetFile));
  const isClient = targetFile.includes("src/components") || targetFile.includes("client");
  const searchDir = isClient ? "src/components" : "server";

  try {
    const files = walkDir(searchDir, [".js", ".jsx", ".ts", ".tsx"]);

    for (const file of files) {
      if (file === targetFile) continue;

      try {
        const content = fs.readFileSync(file, "utf-8");
        if (
          content.includes(`import`) &&
          (content.includes(targetModule) || content.includes(targetFile))
        ) {
          importers[file] = content;
        }
      } catch (e) {
        // Skip unreadable files
      }
    }
  } catch (e) {
    log("WARNING", "Error finding importers: %s", String(e));
  }

  return importers;
}

function walkDir(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.name.startsWith(".") || item.name === "node_modules") continue;

    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      files.push(...walkDir(fullPath, extensions));
    } else if (extensions.some((ext) => item.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

// ==========================================
// GITHUB HELPERS
// ==========================================

function getGitHubClient(): InstanceType<typeof Octokit> {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is required");
  }
  return new Octokit({ auth: GITHUB_TOKEN });
}

async function createBranchAndCommit(
  repoFullName: string,
  branchName: string,
  patches: { [key: string]: string },
  commitMessage: string
): Promise<void> {
  const octokit = getGitHubClient();
  const [owner, repo] = repoFullName.split("/");

  try {
    // Get base branch ref
    const baseRef = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${GITHUB_BASE_BRANCH}`,
    });

    const baseCommitSha = baseRef.data.object.sha;
    const baseCommit = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: baseCommitSha,
    });

    // Create blobs for each file
    const treeItems = [];
    for (const [filePath, content] of Object.entries(patches)) {
      const blob = await octokit.git.createBlob({
        owner,
        repo,
        content,
        encoding: "utf-8",
      });

      treeItems.push({
        path: filePath,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.data.sha,
      });
    }

    // Create tree
    const newTree = await octokit.git.createTree({
      owner,
      repo,
      tree: treeItems,
      base_tree: baseCommit.data.tree.sha,
    });

    // Create commit
    const newCommit = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.data.sha,
      parents: [baseCommitSha],
    });

    // Delete existing branch if it exists
    try {
      await octokit.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
    } catch (e) {
      // Branch doesn't exist, which is fine
    }

    // Create new branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: newCommit.data.sha,
    });

    log("INFO", "Created branch %s with commit %s", branchName, newCommit.data.sha);
  } catch (error) {
    log("ERROR", "Failed to create branch: %s", String(error));
    throw error;
  }
}

async function openPullRequest(
  repoFullName: string,
  branchName: string,
  title: string,
  body: string,
  draft: boolean = false
): Promise<{ url: string; number: number; nodeId: string }> {
  const octokit = getGitHubClient();
  const [owner, repo] = repoFullName.split("/");

  const pr = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head: branchName,
    base: GITHUB_BASE_BRANCH,
    draft,
  });

  return {
    url: pr.data.html_url,
    number: pr.data.number,
    nodeId: pr.data.node_id,
  };
}

async function enableAutoMerge(prNodeId: string, mergeMethod: string = "MERGE"): Promise<boolean> {
  try {
    if (!GITHUB_TOKEN) {
      log("WARNING", "No GITHUB_TOKEN; cannot enable auto-merge");
      return false;
    }

    const query = `
      mutation($input: EnablePullRequestAutoMergeInput!) {
        enablePullRequestAutoMerge(input: $input) {
          pullRequest {
            number
            merged
          }
        }
      }
    `;

    const response = await new Promise<any>((resolve, reject) => {
      const postData = JSON.stringify({
        query,
        variables: { input: { pullRequestId: prNodeId, mergeMethod } },
      });

      const options = {
        hostname: "api.github.com",
        path: "/graphql",
        method: "POST",
        headers: {
          Authorization: `bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "Agentic-MERN",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(JSON.parse(data));
        });
      });

      req.on("error", reject);
      req.write(postData);
      req.end();
    });

    if (response.errors) {
      log("WARNING", "Auto-merge failed: %s", JSON.stringify(response.errors));
      return false;
    }

    return true;
  } catch (error) {
    log("ERROR", "Exception enabling auto-merge: %s", String(error));
    return false;
  }
}

// ==========================================
// FETCH LOGS (GitHub Actions)
// ==========================================

async function fetchLogsNode(state: AgenticState): Promise<Partial<AgenticState>> {
  log("INFO", "NODE[fetchLogsNode]: Fetching logs...");

  let repairMemory = state.repair_memory || {
    iterations: [],
    repo_state: {},
    context: {
      original_logs: "",
      latest_logs: "",
      files_attempted: [],
    },
  };

  if (state.iteration_count > 0) {
    log("INFO", "-> Using latest test logs from previous iteration");
    repairMemory.context.latest_logs = state.logs;
    return { logs: state.logs, repair_memory: repairMemory };
  }

  if (!GITHUB_REPO) {
    return { logs: "No GITHUB_REPO configured", repair_memory: repairMemory };
  }

  try {
    const octokit = getGitHubClient();
    const [owner, repo] = GITHUB_REPO.split("/");

    let run;
    if (WORKFLOW_RUN_ID) {
      run = await octokit.actions.getWorkflowRun({
        owner,
        repo,
        run_id: parseInt(WORKFLOW_RUN_ID),
      });
    } else {
      const runs = await octokit.actions.listWorkflowRuns({
        owner,
        repo,
        status: "failure",
      });

      run = runs.data.workflow_runs[0];
      if (!run) {
        return { logs: "No failed workflow runs found", repair_memory: repairMemory };
      }
    }

    log("INFO", "-> Fetching logs from workflow run %d", run.data.id);

    // Download logs as ZIP
    const logsUrl = run.data.logs_url || "";
    const logsContent = await downloadFile(logsUrl);

    const logs_parts: string[] = [];

    if (logsContent) {
      const zip = new AdmZip(logsContent);
      const entries = zip.getEntries();

      for (const entry of entries) {
        const content = entry.getData().toString("utf-8");
        if (
          entry.entryName.toLowerCase().includes("test") ||
          entry.entryName.toLowerCase().includes("build") ||
          entry.entryName.toLowerCase().includes("run")
        ) {
          // Get last 3000 chars of relevant logs
          const snippet = content.slice(-3000);
          logs_parts.push(`=== ${entry.entryName} ===\n${snippet}`);
        }
      }
    }

    if (logs_parts.length > 0) {
      let fullLogs = logs_parts.join("\n");
      if (fullLogs.length > 8000) {
        fullLogs = fullLogs.slice(-8000);
      }

      repairMemory.context.original_logs = fullLogs;
      repairMemory.context.latest_logs = fullLogs;

      return { logs: fullLogs, repair_memory: repairMemory };
    } else {
      return { logs: "Workflow run found but no failure logs extracted", repair_memory: repairMemory };
    }
  } catch (error) {
    log("ERROR", "Failed to fetch logs: %s", String(error));
    return { logs: `Failed to fetch logs: ${error}`, repair_memory: repairMemory };
  }
}

async function downloadFile(url: string): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3.raw",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
  });
}

// ==========================================
// ANALYZE CODE NODE
// ==========================================

async function analyzeCodeNode(state: AgenticState): Promise<Partial<AgenticState>> {
  log("INFO", "NODE[analyzeCodeNode]: Planning repair strategy...");

  const repairMemory = state.repair_memory || {
    iterations: [],
    repo_state: {},
    context: {
      original_logs: "",
      latest_logs: "",
      files_attempted: [],
    },
  };

  // Gather available files
  const serverFiles = walkDir("server", [".js", ".ts"]);
  const clientFiles = walkDir("src", [".js", ".jsx", ".ts", ".tsx"]);
  const allFiles = [...serverFiles, ...clientFiles].join("\n");

  const prompt = `
You are a Senior Full-Stack JavaScript Developer diagnosing a CI/CD failure in a MERN stack application.

ERROR LOGS:
${state.logs}

AVAILABLE SERVER FILES (Express/Node.js):
${serverFiles.slice(0, 20).join("\n")}

AVAILABLE CLIENT FILES (React):
${clientFiles.slice(0, 20).join("\n")}

PAST REPAIR ATTEMPTS (do NOT repeat failed strategies):
${JSON.stringify(repairMemory.iterations.slice(-3), null, 2)}

Analyze the logs and determine:
1. Is the error in the server (Node.js) or client (React)?
2. Which specific file needs fixing?
3. What is the root cause?
4. What is the repair strategy?

Respond with exact file paths from the AVAILABLE FILES list.
  `;

  try {
    const response = await llm.invoke([{ role: "user", content: prompt }]);
    const responseText =
      typeof response.content === "string" ? response.content : JSON.stringify(response.content);

    saveAudit(state.iteration_count || 0, "analyze_response", prompt, responseText);

    // Parse structured response (simplified for demo)
    const isServer = responseText.toLowerCase().includes("server") || responseText.includes("Express");
    const fileMatch = responseText.match(/\/[^:\s]+\.(js|ts|jsx|tsx)/);
    const targetFile = fileMatch ? fileMatch[0] : serverFiles[0] || clientFiles[0];

    log("INFO", "-> Identified target: %s (server: %s)", targetFile, isServer);

    return {
      current_file: targetFile,
      file_type: isServer ? "server" : "client",
      repair_strategy: responseText,
      repair_memory: repairMemory,
    };
  } catch (error) {
    log("ERROR", "Failed to analyze code: %s", String(error));
    return {
      current_file: null,
      repair_strategy: "Analysis failed",
      repair_memory: repairMemory,
    };
  }
}

// ==========================================
// FIX CODE NODE
// ==========================================

async function fixCodeNode(state: AgenticState): Promise<Partial<AgenticState>> {
  const currentFile = state.current_file;
  const iteration = state.iteration_count || 0;
  const repairMemory = state.repair_memory || {
    iterations: [],
    repo_state: {},
    context: {
      original_logs: "",
      latest_logs: "",
      files_attempted: [],
    },
  };

  log("INFO", "NODE[fixCodeNode]: Generating surgical patch for %s", currentFile);

  if (!currentFile) {
    return { lint_failed: false };
  }

  // Read original code
  let brokenCode: string;
  if (repairMemory.repo_state[currentFile]) {
    brokenCode = repairMemory.repo_state[currentFile];
    log("INFO", "-> Reading previously patched version from memory");
  } else {
    try {
      brokenCode = fs.readFileSync(currentFile, "utf-8");
    } catch {
      brokenCode = "// File not found or empty\n";
    }
  }

  // Find importers for context
  const importers = findImporters(currentFile);
  let importersContext = "";
  if (Object.keys(importers).length > 0) {
    importersContext = "FILES THAT IMPORT THIS MODULE (for context):\n";
    for (const [file, code] of Object.entries(importers)) {
      importersContext += `--- ${file} ---\n${code.slice(-500)}\n\n`;
    }
  }

  const prompt = `
You are a Senior Full-Stack JavaScript Developer.

TARGET FILE: ${currentFile}
FILE TYPE: ${state.file_type === "server" ? "Server (Express/Node.js)" : "Client (React)"}
REPAIR STRATEGY: ${state.repair_strategy}
ERROR LOGS: ${state.logs.slice(0, 2000)}

${importersContext}

CURRENT CODE:
\`\`\`${state.file_type === "server" ? "javascript" : "jsx"}
${brokenCode}
\`\`\`

Generate a fix by providing line-by-line edits.
Include ONLY the necessary changes, not the entire file.
Return JSON with this structure:
{
  "edits": [
    { "start_line": 1, "end_line": 5, "replacement": "new code here" }
  ]
}
  `;

  try {
    const response = await llm.invoke([{ role: "user", content: prompt }]);
    const responseText =
      typeof response.content === "string" ? response.content : JSON.stringify(response.content);

    saveAudit(iteration, "fix_response", prompt, responseText);

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const fixData = JSON.parse(jsonMatch[0]) as FixOutput;
    const edits = fixData.edits || [];

    // Apply edits
    const patchedCode = applyEdits(brokenCode, edits);
    repairMemory.repo_state[currentFile] = patchedCode;

    // Record iteration
    repairMemory.iterations.push({
      iteration: (iteration || 0) + 1,
      target_file: currentFile,
      strategy: state.repair_strategy,
      edits_applied: edits.length,
      result: "pending",
      timestamp: new Date().toISOString(),
    });

    log("INFO", "-> Applied %d edits to %s", edits.length, currentFile);

    return {
      repair_memory: repairMemory,
      iteration_count: (iteration || 0) + 1,
      lint_failed: false,
    };
  } catch (error) {
    log("ERROR", "Failed to fix code: %s", String(error));
    return {
      repair_memory: repairMemory,
      lint_failed: true,
      logs: `Fix failed: ${error}`,
    };
  }
}

// ==========================================
// LINT CHECK NODE (ESLint for JS/TS)
// ==========================================

async function lintCheckNode(state: AgenticState): Promise<Partial<AgenticState>> {
  log("INFO", "NODE[lintCheckNode]: Running linting checks...");

  const repairMemory = state.repair_memory || {
    iterations: [],
    repo_state: {},
    context: {
      original_logs: "",
      latest_logs: "",
      files_attempted: [],
    },
  };

  for (const [filepath, code] of Object.entries(repairMemory.repo_state)) {
    // Basic syntax check using Node.js
    const tmpFile = path.join(AGENTIC_TMP_DIR, "lint_check.js");
    fs.writeFileSync(tmpFile, code);

    try {
      await execAsync(`node -c ${tmpFile}`);
      log("INFO", "-> %s: Syntax OK", filepath);
    } catch (error) {
      log("WARNING", "Syntax error in %s: %s", filepath, String(error));
      repairMemory.iterations[repairMemory.iterations.length - 1].result = "failed";
      repairMemory.iterations[repairMemory.iterations.length - 1].reason = `Syntax error: ${error}`;

      return {
        lint_failed: true,
        logs: `Syntax error in ${filepath}: ${error}`,
        repair_memory: repairMemory,
      };
    }
  }

  log("INFO", "-> All files passed syntax checks");
  return { lint_failed: false, repair_memory: repairMemory };
}

// ==========================================
// TEST NODE
// ==========================================

async function testCodeNode(state: AgenticState): Promise<Partial<AgenticState>> {
  log("INFO", "NODE[testCodeNode]: Running tests...");

  const repairMemory = state.repair_memory || {
    iterations: [],
    repo_state: {},
    context: {
      original_logs: "",
      latest_logs: "",
      files_attempted: [],
    },
  };

  // Inject patches
  for (const [filepath, code] of Object.entries(repairMemory.repo_state)) {
    fs.writeFileSync(filepath, code);
    log("INFO", "-> Injected patch: %s", filepath);
  }

  try {
    // Run Jest tests
    const { stdout, stderr } = await execAsync("npm test -- --passWithNoTests 2>&1", {
      cwd: process.cwd(),
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = stdout + stderr;
    const success =
      output.includes("passed") || output.includes("✓") || output.toLowerCase().includes("success");

    if (success) {
      log("INFO", "-> Tests PASSED");
      repairMemory.iterations[repairMemory.iterations.length - 1].result = "passed";
    } else {
      log("WARNING", "-> Tests FAILED");
      repairMemory.iterations[repairMemory.iterations.length - 1].result = "failed";
    }

    return {
      success,
      logs: output.slice(-2000),
      repair_memory: repairMemory,
    };
  } catch (error) {
    log("ERROR", "Test execution failed: %s", String(error));
    repairMemory.iterations[repairMemory.iterations.length - 1].result = "failed";

    return {
      success: false,
      logs: String(error).slice(-2000),
      repair_memory: repairMemory,
    };
  }
}

// ==========================================
// GENERATE RCA (Root Cause Analysis Report)
// ==========================================

function generateRcaNode(state: AgenticState): Partial<AgenticState> {
  log("INFO", "NODE[generateRcaNode]: Generating RCA report...");

  const repairMemory = state.repair_memory || {
    iterations: [],
    repo_state: {},
    context: {
      original_logs: "",
      latest_logs: "",
      files_attempted: [],
    },
  };

  const rcaObj = {
    summary: "Automated MERN pipeline repair",
    iterations_taken: repairMemory.iterations.length,
    files_modified: Object.keys(repairMemory.repo_state),
    final_status: state.success ? "Success ✓" : "Max iterations reached",
    timestamp: new Date().toISOString(),
    details: repairMemory.iterations,
  };

  const rcaPath = path.join(AGENTIC_TMP_DIR, "final_rca.json");
  fs.writeFileSync(rcaPath, JSON.stringify(rcaObj, null, 2));

  log("INFO", "-> RCA saved to %s", rcaPath);

  return {
    rca_html_path: rcaPath,
  };
}

// ==========================================
// CREATE PR NODE
// ==========================================

async function createPrNode(state: AgenticState): Promise<Partial<AgenticState>> {
  log("INFO", "NODE[createPrNode]: Creating pull request...");

  const repairMemory = state.repair_memory || {
    iterations: [],
    repo_state: {},
    context: {
      original_logs: "",
      latest_logs: "",
      files_attempted: [],
    },
  };

  if (!state.success || !GITHUB_REPO) {
    log("WARNING", "-> Skipping PR creation (success: %s, repo: %s)", state.success, GITHUB_REPO);
    return { pr_url: null };
  }

  try {
    const branchName = `agentic-fix-${Date.now()}`;
    const commitMessage = `[Agentic] Auto-fix: ${repairMemory.iterations[0]?.target_file || "CI/CD failure"}`;
    const prTitle = `[Agentic] Auto-fix CI/CD Failure`;
    const prBody = `
### Automated Fix Summary
- **Iterations**: ${repairMemory.iterations.length}
- **Files Modified**: ${Object.keys(repairMemory.repo_state).join(", ")}
- **Status**: ${state.success ? "✓ Tests Passed" : "⚠ Max iterations reached"}

### Changes
${Object.keys(repairMemory.repo_state)
  .map((f) => `- \`${f}\``)
  .join("\n")}

### Details
\`\`\`json
${JSON.stringify(repairMemory.iterations, null, 2)}
\`\`\`

_Created by Agentic MERN Agent_
    `;

    // Create branch and commit
    await createBranchAndCommit(GITHUB_REPO, branchName, repairMemory.repo_state, commitMessage);

    // Open PR
    const pr = await openPullRequest(GITHUB_REPO, branchName, prTitle, prBody, !state.success);

    log("INFO", "-> PR created: %s (#%d)", pr.url, pr.number);

    // Enable auto-merge if configured
    if (AUTO_MERGE && state.success) {
      const merged = await enableAutoMerge(pr.nodeId);
      log("INFO", "-> Auto-merge enabled: %s", merged);
    }

    return { pr_url: pr.url };
  } catch (error) {
    log("ERROR", "Failed to create PR: %s", String(error));
    return { pr_url: null };
  }
}

// ==========================================
// MAIN AGENT LOOP
// ==========================================

async function runAgent(): Promise<void> {
  log("INFO", "======================================");
  log("INFO", "MERN Agentic Code Repair Agent Started");
  log("INFO", "======================================");

  let state: AgenticState = {
    logs: "",
    iteration_count: 0,
    success: false,
    repair_memory: {
      iterations: [],
      repo_state: {},
      context: {
        original_logs: "",
        latest_logs: "",
        files_attempted: [],
      },
    },
    current_file: null,
    repair_strategy: null,
    file_type: "server",
    rca_html_path: null,
    pr_url: null,
    approved: null,
    lint_failed: null,
  };

  try {
    // Step 1: Fetch logs
    const logsResult = await fetchLogsNode(state);
    state = { ...state, ...logsResult };

    if (!state.logs || state.logs.length < 10) {
      log("WARNING", "No logs found. Exiting.");
      return;
    }

    // Step 2-5: Repair loop
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      state.iteration_count = i;
      log("INFO", "\n=== Iteration %d/%d ===", i + 1, MAX_ITERATIONS);

      // Analyze
      const analyzeResult = await analyzeCodeNode(state);
      state = { ...state, ...analyzeResult };

      if (!state.current_file) {
        log("WARNING", "No target file identified. Skipping.");
        continue;
      }

      // Fix
      const fixResult = await fixCodeNode(state);
      state = { ...state, ...fixResult };

      if (state.lint_failed) {
        log("WARNING", "Linting failed. Retrying...");
        continue;
      }

      // Lint
      const lintResult = await lintCheckNode(state);
      state = { ...state, ...lintResult };

      if (state.lint_failed) continue;

      // Test
      const testResult = await testCodeNode(state);
      state = { ...state, ...testResult };

      if (state.success) {
        log("INFO", "✓ SUCCESS! Tests passed.");
        break;
      }
    }

    // Step 6: Generate RCA
    const rcaResult = generateRcaNode(state);
    state = { ...state, ...rcaResult };

    // Step 7: Create PR
    if (state.success || state.iteration_count === MAX_ITERATIONS - 1) {
      const prResult = await createPrNode(state);
      state = { ...state, ...prResult };
    }

    log("INFO", "\n======================================");
    log("INFO", "Agent Finished");
    log("INFO", "Success: %s | Iterations: %d | PR: %s", state.success, state.iteration_count + 1, state.pr_url || "N/A");
    log("INFO", "======================================");
  } catch (error) {
    log("ERROR", "Agent failed: %s", String(error));
    process.exit(1);
  }
}

// Run agent
runAgent().catch((error) => {
  log("ERROR", "Uncaught error: %s", String(error));
  process.exit(1);
});

export { runAgent };

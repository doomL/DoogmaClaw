/**
 * Cursor CLI agent (`cursor-agent -p`) as an intermediate fallback tier, tried
 * before the OpenRouter/API fallback when the primary Claude session hits its
 * rate limit. Produces a result shaped exactly like `invokeClaude`'s output so
 * it drops into the existing runner.ts post-processing pipeline unchanged
 * (session bookkeeping, rate-limit detection, placeholder-output repair, …).
 *
 * Scope: each Cursor fallback call is a fresh turn (no session --resume across
 * calls) — Cursor's chat state isn't compatible with Claude's session jsonl.
 * This mirrors how OpenRouter fallback already gets treated when its reply
 * writes a non-Anthropic session id: the existing repair logic in runner.ts
 * (sessionHasNonAnthropicAssistantIds / truncateSessionJsonlAfterLastAnthropicMessage)
 * already handles "fallback wrote an id we can't --resume on Anthropic with".
 */

import { randomUUID } from "crypto";

export type CursorOutputFormat = "json" | "text" | "stream-json";

export interface CursorInvokeResult {
  rawStdout: string;
  stderr: string;
  exitCode: number;
}

/** "auto"/"" → let cursor-agent pick its own default model (no --model flag). */
function cursorModelArg(model: string): string[] {
  const t = model.trim();
  if (!t || t.toLowerCase() === "auto" || t.toLowerCase() === "default") return [];
  return ["--model", t];
}

/**
 * Run `cursor-agent -p <prompt>` non-interactively and return a result shaped
 * like ClaudeInvokeResult, matching whichever output convention the caller's
 * real Claude fallback invocation would have used for the same turn:
 *  - "stream-json" (live chunk callback in use): plain text, onChunk fired once
 *  - "text" (resumed session): plain text, no wrapper
 *  - "json" (new session): JSON-wrapped with a synthetic session_id so the
 *    existing new-session bookkeeping in runner.ts still runs
 *
 * Returns null (never throws) when the fallback isn't usable — missing API
 * key, missing binary, non-zero exit, empty reply, or timeout — so the caller
 * can fall through to the next fallback tier.
 */
export async function invokeCursorAgentAsClaudeResult(
  prompt: string,
  model: string,
  apiKey: string,
  outputFormat: CursorOutputFormat,
  timeoutMs: number,
  onChunk?: (text: string) => void,
): Promise<CursorInvokeResult | null> {
  const key = apiKey.trim() || process.env.CURSOR_API_KEY?.trim() || "";
  if (!key) {
    console.warn(
      `[${new Date().toLocaleTimeString()}] Cursor fallback skipped: no API key (set cursorFallback.apiKey or CURSOR_API_KEY).`,
    );
    return null;
  }

  const args = [
    "cursor-agent",
    "-p",
    prompt,
    "--output-format",
    "text",
    "--force",
    "--trust",
    ...cursorModelArg(model),
  ];

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`cursor-agent timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  });

  let stdoutText = "";
  let stderrText = "";
  let exitCode = 1;
  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CURSOR_API_KEY: key },
      cwd: process.cwd(),
    });
    try {
      [stdoutText, stderrText] = (await Promise.race([
        Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]),
        timeoutPromise,
      ])) as [string, string];
      await proc.exited;
      exitCode = proc.exitCode ?? 1;
    } catch (err) {
      try {
        proc.kill("SIGTERM");
      } catch {}
      setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {}
      }, 5000);
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[${new Date().toLocaleTimeString()}] Cursor fallback failed: ${message}`);
    return null;
  }

  const text = stdoutText.trim();
  if (exitCode !== 0 || !text) {
    console.warn(
      `[${new Date().toLocaleTimeString()}] Cursor fallback exited ${exitCode} (empty reply${
        stderrText ? `: ${stderrText.slice(0, 300)}` : ""
      })`,
    );
    return null;
  }

  if (outputFormat === "json") {
    const sessionId = `cursor-${randomUUID().slice(0, 8)}`;
    return {
      rawStdout: JSON.stringify({ type: "result", result: text, is_error: false, session_id: sessionId }),
      stderr: stderrText.trim(),
      exitCode: 0,
    };
  }

  // "text" and "stream-json" both expect plain result text as rawStdout.
  if (outputFormat === "stream-json" && onChunk) onChunk(text);
  return { rawStdout: text, stderr: stderrText.trim(), exitCode: 0 };
}

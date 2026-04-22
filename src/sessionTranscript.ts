import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

/** Some gateways/models return this instead of an empty body (e.g. OpenRouter + certain slugs). */
export function isPlaceholderAssistantOutput(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /^no response requested\.?$/i.test(t);
}

/** Same convention as telegram/discord context helpers. */
export function claudeSessionJsonlPath(sessionId: string, cwd: string = process.cwd()): string {
  const projectSlug = cwd.replace(/\//g, "-");
  return join(homedir(), ".claude", "projects", projectSlug, `${sessionId}.jsonl`);
}

const REASONING_BLOCK_TYPES = new Set(["thinking", "redacted_thinking"]);

function stripThinkingFromRecord(obj: Record<string, unknown>): number {
  if (obj.type !== "assistant" || !obj.message || typeof obj.message !== "object") return 0;
  const msg = obj.message as Record<string, unknown>;
  const content = msg.content;
  if (!Array.isArray(content)) return 0;

  let removed = 0;
  const next: unknown[] = [];
  for (const block of content) {
    const bType = block && typeof block === "object" ? (block as { type?: string }).type : undefined;
    if (bType && REASONING_BLOCK_TYPES.has(bType)) {
      removed++;
      continue;
    }
    if (block && typeof block === "object" && "signature" in block) {
      const { signature: _sig, ...rest } = block as Record<string, unknown>;
      next.push(rest);
    } else {
      next.push(block);
    }
  }

  if (removed === 0) return 0;

  if (next.length === 0) {
    next.push({
      type: "text",
      text: "[Internal reasoning omitted for cross-model session compatibility.]",
    });
  }

  msg.content = next;
  return removed;
}

function assistantMessageId(obj: Record<string, unknown>): string | undefined {
  if (obj.type !== "assistant") return undefined;
  const msg = obj.message;
  if (!msg || typeof msg !== "object") return undefined;
  const id = (msg as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function isMergeableAssistantRow(obj: Record<string, unknown>): boolean {
  if (obj.type !== "assistant") return false;
  if (obj.isApiErrorMessage === true) return false;
  const msg = obj.message;
  if (!msg || typeof msg !== "object") return false;
  if ((msg as { model?: unknown }).model === "<synthetic>") return false;
  return typeof (msg as { id?: unknown }).id === "string";
}

function rowHasToolUse(obj: Record<string, unknown>): boolean {
  const msg = obj.message;
  if (!msg || typeof msg !== "object") return false;
  const content = (msg as { content?: unknown }).content;
  if (!Array.isArray(content)) return false;
  return content.some(
    (b) => b && typeof b === "object" && (b as { type?: string }).type === "tool_use",
  );
}

function mergeAssistantContentArrays(chunks: unknown[][]): unknown[] {
  const out: unknown[] = [];
  const seenToolIds = new Set<string>();
  for (const chunk of chunks) {
    for (const block of chunk) {
      if (block && typeof block === "object") {
        const b = block as { type?: string; id?: string };
        if (b.type === "tool_use" && typeof b.id === "string") {
          if (seenToolIds.has(b.id)) continue;
          seenToolIds.add(b.id);
        }
      }
      out.push(block);
    }
  }
  return out;
}

function remapParentUuid(obj: Record<string, unknown>, uuidRemap: Map<string, string>): void {
  const p = obj.parentUuid;
  if (typeof p === "string" && uuidRemap.has(p)) {
    obj.parentUuid = uuidRemap.get(p)!;
  }
}

/**
 * Claude Code records one jsonl row per streaming chunk, all sharing `message.id`.
 * OpenAI-compatible gateways (OpenRouter → DeepInfra, SiliconFlow, etc.) treat each row as a
 * separate assistant turn, producing 400s like "Tool message must follow assistant with tool_calls".
 * Merge consecutive same-id assistant rows into one and reparent children that pointed at removed UUIDs.
 */
function mergeStreamingAssistantRowsInParsedJsonl(
  objects: Array<Record<string, unknown> | null>,
): { uuidRemap: Map<string, string>; rowsMerged: number; droppedIndices: Set<number> } {
  const uuidRemap = new Map<string, string>();
  const droppedIndices = new Set<number>();
  let rowsMerged = 0;
  let i = 0;
  while (i < objects.length) {
    const o = objects[i];
    if (!o || !isMergeableAssistantRow(o)) {
      i++;
      continue;
    }
    const mid = assistantMessageId(o);
    if (!mid) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < objects.length) {
      const next = objects[end + 1];
      if (!next || !isMergeableAssistantRow(next)) break;
      if (assistantMessageId(next) !== mid) break;
      end++;
    }
    if (end === i) {
      i++;
      continue;
    }

    const slice = objects.slice(i, end + 1) as Record<string, unknown>[];
    const toolRow = slice.find(rowHasToolUse);
    const base = JSON.parse(JSON.stringify(toolRow ?? slice[slice.length - 1])) as Record<string, unknown>;
    const contents = slice.map((row) => {
      const msg = row.message as Record<string, unknown>;
      const c = msg?.content;
      return Array.isArray(c) ? c : [];
    });
    const msgOut = base.message as Record<string, unknown>;
    msgOut.content = mergeAssistantContentArrays(contents);
    base.parentUuid = slice[0].parentUuid;

    const keepUuid = String((toolRow ?? slice[slice.length - 1]).uuid);
    for (const row of slice) {
      const u = row.uuid;
      if (typeof u === "string" && u !== keepUuid) {
        uuidRemap.set(u, keepUuid);
      }
    }
    objects[i] = base;
    for (let k = i + 1; k <= end; k++) {
      droppedIndices.add(k);
    }
    rowsMerged += end - i;
    i = end + 1;
  }
  return { uuidRemap, rowsMerged, droppedIndices };
}

/**
 * Repairs session jsonl for providers that expect strict OpenAI-style alternating roles:
 * merges streaming assistant chunks, strips thinking/redacted_thinking, removes stray signatures.
 */
export async function repairSessionJsonlForCompatGateways(
  sessionId: string,
  cwd?: string,
): Promise<{ ok: boolean; blocksRemoved: number; rowsMerged: number }> {
  const path = claudeSessionJsonlPath(sessionId, cwd);
  if (!existsSync(path)) return { ok: false, blocksRemoved: 0, rowsMerged: 0 };

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { ok: false, blocksRemoved: 0, rowsMerged: 0 };
  }

  const lines = raw.split("\n");
  const objects: Array<Record<string, unknown> | null> = lines.map((line) => {
    const t = line.trim();
    if (!t) return null;
    try {
      return JSON.parse(t) as Record<string, unknown>;
    } catch {
      return null;
    }
  });

  const { uuidRemap, rowsMerged, droppedIndices } = mergeStreamingAssistantRowsInParsedJsonl(objects);

  let blocksRemoved = 0;
  let changed = rowsMerged > 0;

  for (let i = 0; i < objects.length; i++) {
    if (droppedIndices.has(i)) continue;
    const obj = objects[i];
    if (!obj) continue;
    remapParentUuid(obj, uuidRemap);
    const removed = stripThinkingFromRecord(obj);
    if (removed > 0) {
      blocksRemoved += removed;
      changed = true;
    }
  }

  if (!changed) {
    return { ok: true, blocksRemoved: 0, rowsMerged: 0 };
  }

  const backupPath = `${path}.bak-compat-${Date.now()}`;
  try {
    await writeFile(backupPath, raw, "utf8");
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] sessionTranscript: backup failed:`, e);
    return { ok: false, blocksRemoved: 0, rowsMerged: 0 };
  }

  const outLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (droppedIndices.has(i)) continue;
    const line = lines[i] ?? "";
    if (!line.trim()) {
      outLines.push(line);
      continue;
    }
    const obj = objects[i];
    if (obj) {
      outLines.push(JSON.stringify(obj));
    } else {
      outLines.push(line);
    }
  }

  const newBody = outLines.join("\n");
  const withNl = raw.endsWith("\n") ? `${newBody}\n` : newBody;
  try {
    await writeFile(path, withNl, "utf8");
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] sessionTranscript: write failed:`, e);
    return { ok: false, blocksRemoved: 0, rowsMerged: 0 };
  }

  return { ok: true, blocksRemoved, rowsMerged };
}

/**
 * Removes `thinking` blocks (and stray `signature` fields) from Claude Code's session jsonl
 * so `--resume` can continue after a model/API switch. Writes a timestamped backup first.
 */
export async function stripThinkingFromSessionJsonl(
  sessionId: string,
  cwd?: string,
): Promise<{ ok: boolean; blocksRemoved: number }> {
  const path = claudeSessionJsonlPath(sessionId, cwd);
  if (!existsSync(path)) return { ok: false, blocksRemoved: 0 };

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { ok: false, blocksRemoved: 0 };
  }

  const lines = raw.split(/\n/);
  const outLines: string[] = [];
  let blocksRemoved = 0;
  let changed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      outLines.push(line);
      continue;
    }
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const removed = stripThinkingFromRecord(obj);
      if (removed > 0) {
        blocksRemoved += removed;
        changed = true;
        outLines.push(JSON.stringify(obj));
      } else {
        outLines.push(line);
      }
    } catch {
      outLines.push(line);
    }
  }

  if (!changed || blocksRemoved === 0) {
    return { ok: true, blocksRemoved: 0 };
  }

  const backupPath = `${path}.bak-thinking-${Date.now()}`;
  try {
    await writeFile(backupPath, raw, "utf8");
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] sessionTranscript: backup failed:`, e);
    return { ok: false, blocksRemoved: 0 };
  }

  const newBody = outLines.join("\n");
  const withNl = raw.endsWith("\n") ? `${newBody}\n` : newBody;
  try {
    await writeFile(path, withNl, "utf8");
  } catch (e) {
    console.error(`[${new Date().toLocaleTimeString()}] sessionTranscript: write failed:`, e);
    return { ok: false, blocksRemoved: 0 };
  }

  return { ok: true, blocksRemoved };
}

/**
 * Claude Code's `-p --output-format json` (and `text` on `--resume`) can leave `result` empty when
 * the provider emits follow-up assistant rows with only thinking/reasoning blocks after the
 * visible text (e.g. OpenRouter + DeepSeek). The user-visible reply still exists earlier in the
 * session jsonl — scan newest-to-oldest assistant rows for `content` blocks with `type: "text"`.
 */
export async function extractLastVisibleAssistantTextFromSessionJsonl(
  sessionId: string,
  cwd: string = process.cwd(),
): Promise<string | null> {
  const path = claudeSessionJsonlPath(sessionId, cwd);
  if (!existsSync(path)) return null;

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null;
  }

  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]?.trim();
    if (!trimmed) continue;

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (obj.type !== "assistant") continue;

    const message = obj.message;
    if (!message || typeof message !== "object") continue;

    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;

    const parts: string[] = [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const b = block as { type?: string; text?: string };
      if (b.type === "text" && typeof b.text === "string" && b.text.trim()) {
        parts.push(b.text);
      }
    }

    if (parts.length > 0) {
      return parts.join(parts.length > 1 ? "\n\n" : "");
    }
  }

  return null;
}

// Preserves completion evidence and extracts only strictly valid declared answers.
import {
  getProfile,
  MAX_EXPLANATION_CODE_POINTS,
  MAX_RESPONSE_CODE_UNITS,
  PROTOCOL_VERSION,
} from "./profiles";
import type { AnswerOutcome } from "./types";
import { ProtocolInputError, readDataRecord, requireFields } from "./validation";

// JSON.parse discards duplicate keys; scan the validated text before trusting its fields.
function hasDuplicateRootKey(text: string): boolean {
  const keys = new Set<string>();
  let depth = 0;
  let expectingKey = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      const start = index;
      for (index++; index < text.length; index++) {
        if (text[index] === "\\") index++;
        else if (text[index] === '"') break;
      }
      if (depth === 1 && expectingKey) {
        const key: string = JSON.parse(text.slice(start, index + 1));
        if (keys.has(key)) return true;
        keys.add(key);
        expectingKey = false;
      }
    } else if (character === "{" || character === "[") {
      depth++;
      if (depth === 1) expectingKey = true;
    } else if (character === "}" || character === "]") {
      depth--;
    } else if (character === "," && depth === 1) {
      expectingKey = true;
    }
  }
  return false;
}

export function extractAnswer(reply: unknown, profileId: unknown): AnswerOutcome {
  const profile = getProfile(profileId);
  const envelope = readDataRecord(reply, "Reply");
  const status = envelope.status;
  requireFields(envelope, status === "provider-error" ? ["status", "text", "message"] : ["status", "text"]);
  if (typeof envelope.text !== "string") {
    throw new ProtocolInputError("invalid-input", "Reply text must be a string.");
  }
  const identity = { protocolVersion: PROTOCOL_VERSION, profileId: profile.id, rawText: envelope.text };
  if (status === "provider-error") {
    if (typeof envelope.message !== "string" || envelope.message.trim() === "") {
      throw new ProtocolInputError("invalid-input", "Provider-error replies require a nonblank message.");
    }
    return { ...identity, kind: "provider-error", message: envelope.message };
  }
  if (status === "refused" || status === "truncated" || status === "interrupted" || status === "cancelled") {
    return { ...identity, kind: status };
  }
  if (status !== "completed") {
    throw new ProtocolInputError("invalid-input", "Reply status must be an explicit normalized completion state.");
  }

  const text = envelope.text;
  if (text.length > MAX_RESPONSE_CODE_UNITS) return { ...identity, kind: "invalid", reason: "response-too-large" };
  if (/^[ \t\r\n]*$/.test(text)) return { ...identity, kind: "invalid", reason: "empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return { ...identity, kind: "invalid", reason: "malformed-json" };
    throw error;
  }
  if (parsed === null || typeof parsed !== "object" || Object.getPrototypeOf(parsed) !== Object.prototype) {
    return { ...identity, kind: "invalid", reason: "invalid-shape" };
  }
  if (hasDuplicateRootKey(text)) return { ...identity, kind: "invalid", reason: "duplicate-field" };
  const fields = parsed as Record<string, unknown>;
  if (
    Object.keys(fields).length !== 2 ||
    !Object.hasOwn(fields, "label") || !Object.hasOwn(fields, "explanation") ||
    typeof fields.label !== "string" || typeof fields.explanation !== "string"
  ) {
    return { ...identity, kind: "invalid", reason: "invalid-shape" };
  }
  if (fields.label !== "convex" && fields.label !== "concave" && fields.label !== "neither") {
    return { ...identity, kind: "invalid", reason: "invalid-label" };
  }
  if (
    fields.explanation.trim() === "" || !fields.explanation.isWellFormed() ||
    [...fields.explanation].length > MAX_EXPLANATION_CODE_POINTS
  ) {
    return { ...identity, kind: "invalid", reason: "invalid-explanation" };
  }
  return { ...identity, kind: "answer", label: fields.label, explanation: fields.explanation };
}

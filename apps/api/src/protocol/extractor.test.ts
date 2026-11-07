import { describe, expect, it, spyOn } from "bun:test";
import { extractAnswer } from "./extractor";
import { MAX_EXPLANATION_CODE_POINTS, MAX_RESPONSE_CODE_UNITS } from "./profiles";
import type { InvalidAnswerReason, ProfileId } from "./types";
import { ProtocolInputError } from "./validation";

const profiles: readonly ProfileId[] = ["one-shot-json-v1", "one-shot-schema-v1"];
const validText = '{"label":"convex","explanation":"A declared explanation."}';

function expectInvalid(text: string, reason: InvalidAnswerReason, profileId: ProfileId): void {
  expect(extractAnswer({ status: "completed", text }, profileId)).toEqual({
    protocolVersion: "1", profileId, rawText: text, kind: "invalid", reason,
  });
}

for (const profileId of profiles) {
  describe(`answer extraction for ${profileId}`, () => {
    for (const label of ["convex", "concave", "neither"] as const) {
      for (const reversed of [false, true]) {
        it(`accepts ${label} with ${reversed ? "explanation" : "label"} first and retains raw whitespace`, () => {
          const explanation = "  Explanation retained exactly.\n";
          const fields = reversed ? { explanation, label } : { label, explanation };
          const text = ` \t\r\n${JSON.stringify(fields)}\n \t`;
          expect(extractAnswer({ status: "completed", text }, profileId)).toEqual({
            protocolVersion: "1", profileId, rawText: text, kind: "answer", label, explanation,
          });
        });
      }
    }

    it("decodes escaped field names and string content without treating quoted keys as fields", () => {
      const explanation = 'He said "convex"; {"label":"concave","label":"neither"}, [a,b] \\ λ 😀\nnext line.';
      const text = `{"explan\\u0061tion":${JSON.stringify(explanation)},"la\\u0062el":"neither"}`;
      expect(extractAnswer({ status: "completed", text }, profileId)).toEqual({
        protocolVersion: "1", profileId, rawText: text, kind: "answer", label: "neither", explanation,
      });
    });

    it("uses the declared label even when the explanation argues for another class", () => {
      const explanation = 'This is concave and neither; the text says "label": "concave".';
      const text = JSON.stringify({ label: "convex", explanation });
      expect(extractAnswer({ status: "completed", text }, profileId)).toEqual({
        protocolVersion: "1", profileId, rawText: text, kind: "answer", label: "convex", explanation,
      });
    });

    it("does not infer refusal from completed answer text", () => {
      const text = JSON.stringify({ label: "convex", explanation: "I cannot answer the question." });
      expect(extractAnswer({ status: "completed", text }, profileId).kind).toBe("answer");
    });

    it("rejects duplicate decoded root keys before validating overwritten values", () => {
      const texts = [
        '{"label":"convex","label":"convex","explanation":"ok"}',
        '{"label":"convex","label":"concave","explanation":"ok"}',
        String.raw`{"la\u0062el":"neither","label":"convex","explanation":"ok"}`,
        '{"label":"convex","explanation":"ok","explanation":"ok"}',
        '{"label":"convex","explanation":"first","explanation":"second"}',
        String.raw`{"label":"convex","explanation":"first","explan\u0061tion":"second"}`,
        '{"label":{"label":"concave","explanation":"nested"},"label":"convex","explanation":"ok"}',
        '{"label":"convex","explanation":[{"label":"neither"}],"explanation":"ok"}',
        '{"label":"convex","explanation":"ok","other":false,"other":true}',
        String.raw`{"label":"convex","explanation":"ok","other":false,"oth\u0065r":true}`,
        '{"__proto__":{},"label":"convex","explanation":"ok","__proto__":{}}',
      ];
      for (const text of texts) expectInvalid(text, "duplicate-field", profileId);
    });

    it("rejects root values and field structures outside the exact two-string object", () => {
      const texts = [
        "null", "[]", '["convex","ok"]', '"convex"', "1", "true", "{}",
        '{"label":"convex"}', '{"explanation":"ok"}',
        '{"label":"convex","explanation":"ok","extra":true}',
        '{"label":"convex","explanation":"ok","__proto__":{}}',
        '{"label":"convex","explanation":"ok","constructor":"extra"}',
        '{"label":null,"explanation":"ok"}', '{"label":1,"explanation":"ok"}',
        '{"label":true,"explanation":"ok"}', '{"label":[],"explanation":"ok"}',
        '{"label":{},"explanation":"ok"}', '{"label":"convex","explanation":null}',
        '{"label":"convex","explanation":1}', '{"label":"convex","explanation":false}',
        '{"label":"convex","explanation":[]}', '{"label":"convex","explanation":{}}',
        '{"label":"convex","explanation":{"label":"concave","label":"neither"}}',
      ];
      for (const text of texts) expectInvalid(text, "invalid-shape", profileId);
    });

    it("rejects aliases, case changes, and surrounding label whitespace", () => {
      for (const label of ["", "Convex", "CONCAVE", "Neither", "convex ", " convex", "convex\n", "non-convex", "concavity", "unknown"]) {
        expectInvalid(JSON.stringify({ label, explanation: "ok" }), "invalid-label", profileId);
      }
    });

    it("distinguishes JSON-whitespace-only completed text from malformed output", () => {
      for (const text of ["", " ", "\t\r\n", " \t\r\n "]) expectInvalid(text, "empty", profileId);
      for (const text of ["\u00a0", "\uFEFF", "\u2003"]) expectInvalid(text, "malformed-json", profileId);
    });

    it("rejects incomplete JSON, fences, surrounding prose, and repeated objects without repair", () => {
      const texts = [
        "{", '{"label":', '{"label":"convex","explanation":"cut off',
        '{"label":"convex","explanation":"ok",}',
        "```json\n" + validText + "\n```", "Answer: " + validText,
        validText + " done", validText + validText, validText + "\n" + validText,
        "\uFEFF" + validText, validText + "\u00a0",
      ];
      for (const text of texts) expectInvalid(text, "malformed-json", profileId);
    });

    it("requires nonblank, well-formed Unicode explanations", () => {
      for (const explanation of ["", " \t\r\n", "\u00a0\uFEFF", "\ud800", "\udfff", "x\ud800y", "\udc00\ud800", "\ud800\ud800\udc00"]) {
        expectInvalid(JSON.stringify({ label: "convex", explanation }), "invalid-explanation", profileId);
      }
    });

    it("enforces the explanation boundary in Unicode code points rather than UTF-16 units", () => {
      for (const character of ["a", "😀"]) {
        const explanation = character.repeat(MAX_EXPLANATION_CODE_POINTS);
        const text = JSON.stringify({ label: "convex", explanation });
        expect(extractAnswer({ status: "completed", text }, profileId)).toEqual({
          protocolVersion: "1", profileId, rawText: text, kind: "answer", label: "convex", explanation,
        });
        expectInvalid(JSON.stringify({ label: "convex", explanation: explanation + character }), "invalid-explanation", profileId);
      }
      const explanation = "a\u0301".repeat(MAX_EXPLANATION_CODE_POINTS / 2);
      expect(extractAnswer({ status: "completed", text: JSON.stringify({ label: "concave", explanation }) }, profileId).kind).toBe("answer");
      expectInvalid(JSON.stringify({ label: "concave", explanation: explanation + "a" }), "invalid-explanation", profileId);
    });

    it("accepts a maximum-length explanation serialized entirely as surrogate escapes", () => {
      const escaped = String.raw`\ud83d\ude00`.repeat(MAX_EXPLANATION_CODE_POINTS);
      const text = `{"label":"convex","explanation":"${escaped}"}`;
      expect(text.length).toBeGreaterThan(32768);
      expect(text.length).toBeLessThanOrEqual(MAX_RESPONSE_CODE_UNITS);
      expect(extractAnswer({ status: "completed", text }, profileId)).toEqual({
        protocolVersion: "1", profileId, rawText: text, kind: "answer", label: "convex",
        explanation: "😀".repeat(MAX_EXPLANATION_CODE_POINTS),
      });
    });

    it("handles long hex-escaped quote content and detects a subsequent escaped duplicate key", () => {
      const escaped = String.raw`\ud83d\ude00\u0022`.repeat(MAX_EXPLANATION_CODE_POINTS / 2);
      const text = `{"label":"neither","explanation":"${escaped}"}`;
      expect(text.length).toBeGreaterThan(32768);
      expect(extractAnswer({ status: "completed", text }, profileId)).toEqual({
        protocolVersion: "1", profileId, rawText: text, kind: "answer", label: "neither",
        explanation: '😀"'.repeat(MAX_EXPLANATION_CODE_POINTS / 2),
      });
      const duplicate = text.slice(0, -1) + String.raw`,"la\u0062el":"convex"}`;
      expectInvalid(duplicate, "duplicate-field", profileId);
    });

    it("caps completed response text before parsing and counts UTF-16 code units", () => {
      const explanation = "😀".repeat(MAX_EXPLANATION_CODE_POINTS);
      const text = JSON.stringify({ label: "convex", explanation }).padEnd(MAX_RESPONSE_CODE_UNITS, " ");
      expect(text.length).toBe(MAX_RESPONSE_CODE_UNITS);
      expect(extractAnswer({ status: "completed", text }, profileId).kind).toBe("answer");
      expectInvalid(text + " ", "response-too-large", profileId);
      expectInvalid(" ".repeat(MAX_RESPONSE_CODE_UNITS + 1), "response-too-large", profileId);
      expectInvalid("{".repeat(MAX_RESPONSE_CODE_UNITS + 1), "response-too-large", profileId);
    });

    it("preserves each noncompleted status even for empty, partial, valid, or oversized bodies", () => {
      for (const status of ["refused", "truncated", "interrupted", "cancelled"] as const) {
        for (const text of ["", '{"label":"convex"', validText, " ".repeat(MAX_RESPONSE_CODE_UNITS + 1)]) {
          expect(extractAnswer({ status, text }, profileId)).toEqual({
            protocolVersion: "1", profileId, rawText: text, kind: status,
          });
        }
      }
    });

    it("preserves provider errors and messages before considering response text", () => {
      const message = "  Upstream transport failed.\n";
      for (const text of ["", '{"label":', validText, " ".repeat(MAX_RESPONSE_CODE_UNITS + 1)]) {
        expect(extractAnswer({ status: "provider-error", text, message }, profileId)).toEqual({
          protocolVersion: "1", profileId, rawText: text, kind: "provider-error", message,
        });
      }
    });
  });
}

describe("reply envelope trust boundary", () => {
  it("rejects malformed internal envelopes as contract errors", () => {
    const replies: unknown[] = [
      null, undefined, [], validText, 0, true, new Date(),
      {}, { text: validText }, { status: "completed" },
      { status: "complete", text: validText }, { status: "unknown", text: validText },
      { status: null, text: validText }, { status: "completed", text: undefined },
      { status: "completed", text: null }, { status: "completed", text: 1 },
      { status: "completed", text: validText, refused: true },
      { status: "completed", text: validText, message: "unexpected" },
      { status: "truncated", text: validText, finishReason: "length" },
      { status: "provider-error", text: validText },
      { status: "provider-error", text: validText, message: "" },
      { status: "provider-error", text: validText, message: " \n\t" },
      { status: "provider-error", text: validText, message: 1 },
      { status: "provider-error", text: validText, message: "failed", retry: true },
      Object.create({ status: "completed", text: validText }),
      Object.assign(Object.create({ custom: true }), { status: "completed", text: validText }),
      { status: "completed", text: validText, [Symbol("hidden")]: true },
      Object.defineProperty({ status: "completed", text: validText }, "hidden", { value: true }),
    ];
    for (const profileId of profiles) {
      for (const reply of replies) {
        expect(() => extractAnswer(reply, profileId)).toThrow(ProtocolInputError);
        try {
          extractAnswer(reply, profileId);
        } catch (error) {
          expect((error as ProtocolInputError).code).toBe("invalid-input");
        }
      }
    }
  });

  it("rejects accessors without invoking status, text, message, or hidden getters", () => {
    let accesses = 0;
    for (const key of ["status", "text", "message", "hidden"]) {
      const reply = Object.defineProperty({ status: "provider-error", text: validText, message: "failed" }, key, {
        get() { accesses++; return "completed"; },
      });
      expect(() => extractAnswer(reply, profiles[0])).toThrow(ProtocolInputError);
    }
    expect(accesses).toBe(0);
  });

  it("accepts null-prototype data envelopes", () => {
    const reply = Object.assign(Object.create(null), { status: "completed", text: validText });
    expect(extractAnswer(reply, profiles[0]).kind).toBe("answer");
  });

  it("rejects an unknown profile before inspecting the reply", () => {
    let accesses = 0;
    const reply = Object.defineProperty({}, "status", { get() { accesses++; return "completed"; } });
    for (const profileId of [undefined, null, "", "one-shot-json-v2", {}, 1]) {
      expect(() => extractAnswer(reply, profileId)).toThrow(ProtocolInputError);
      try {
        extractAnswer(reply, profileId);
      } catch (error) {
        expect((error as ProtocolInputError).code).toBe("unknown-profile");
      }
    }
    expect(accesses).toBe(0);
  });

  it("propagates unexpected parser failures", () => {
    const failure = new Error("Unexpected parser failure.");
    const parse = spyOn(JSON, "parse").mockImplementationOnce(() => { throw failure; });
    try {
      expect(() => extractAnswer({ status: "completed", text: validText }, profiles[0])).toThrow(failure);
    } finally {
      parse.mockRestore();
    }
  });
});

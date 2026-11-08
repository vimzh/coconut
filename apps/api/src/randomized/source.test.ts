// Original CSV examples exercise trust boundaries without inheriting any external reference label.
import { describe, expect, test } from "bun:test";
import { parseCandidateCsv } from "./source";

const csv = (rows = ['"x^2","root\nchild",5,2,convex,verified', '"-x^2",tree,6,3,concave,not_evaluable', '"x^3",tree,5,3,neither,verified']) => "latex,tree,depth,nodes,convexity,jensen\n" + rows.join("\n") + "\n";
describe("bounded external CSV admission", () => {
  test("preserves multiline exact display and source depth, without asserting reference validity", () => {
    const rows = parseCandidateCsv(csv(), 5, 1);
    expect(rows.map(row => row.actualDepth)).toEqual([5, 6, 5]);
    expect(rows[0].expression).toBe("x^2");
    expect(rows[0].treeSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[1].numericalStatus).toBe("not_evaluable");
  });
  test("rejects partial classes, invalid depth, extra columns and malformed quoting", () => {
    for (const text of [csv().replace(",6,3,", ",7,3,"), csv().replace("convex,verified", "concave,verified"), csv().replace("latex,tree", "latex,other"), csv().replace('"root\nchild"', '"root"bad'), csv().split("\n").slice(0, 3).join("\n"), csv().replace("x^3", 'x"^3')])
      expect(() => parseCandidateCsv(text, 5, 1)).toThrow();
    expect(() => parseCandidateCsv(csv(), 1001, 1)).toThrow();
    expect(() => parseCandidateCsv(csv(), 5, 0)).toThrow();
  });
});

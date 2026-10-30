import { describe, expect, it } from "vitest";

import { parseLevel } from "./levels";

describe("parseLevel", () => {
	it("keeps a known level", () => {
		expect(parseLevel("expert")).toBe("expert");
	});

	it("falls back to the easy level for anything else", () => {
		expect(parseLevel("impossible")).toBe("easy");
		expect(parseLevel(undefined)).toBe("easy");
	});
});

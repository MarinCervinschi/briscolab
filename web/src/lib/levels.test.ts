import { describe, expect, it } from "vitest";

import { parseLevel } from "./levels";

describe("parseLevel", () => {
	it("keeps a known level", () => {
		expect(parseLevel("esperto")).toBe("esperto");
	});

	it("falls back to the easy level for anything else", () => {
		expect(parseLevel("impossibile")).toBe("facile");
		expect(parseLevel(undefined)).toBe("facile");
	});
});

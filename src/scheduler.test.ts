import { describe, it, expect, vi } from "vitest";

vi.mock("./database.js", () => ({
  listCronEntries: vi.fn(),
  deleteCronEntry: vi.fn(),
  recordCronEntryFired: vi.fn(),
  isCatchUpCronNote: vi.fn(),
}));
vi.mock("./queue.js", () => ({
  enqueueMessage: vi.fn(),
}));

import { missedRunToday } from "./scheduler.js";

describe("missedRunToday", () => {
  const daily = "0 5 * * *";

  it("returns true when today's run was missed", () => {
    const now = new Date(2026, 9, 20, 18, 0);
    const lastFiredAt = new Date(2026, 9, 19, 5, 0);
    expect(missedRunToday(daily, lastFiredAt, now)).toBe(true);
  });

  it("returns false when today's run already fired", () => {
    const now = new Date(2026, 9, 20, 18, 0);
    const lastFiredAt = new Date(2026, 9, 20, 5, 0, 1);
    expect(missedRunToday(daily, lastFiredAt, now)).toBe(false);
  });

  it("returns false when the missed run was on an earlier day", () => {
    const now = new Date(2026, 9, 21, 2, 0);
    const lastFiredAt = new Date(2026, 9, 19, 5, 0);
    expect(missedRunToday(daily, lastFiredAt, now)).toBe(false);
  });

  it("returns false before today's run is due", () => {
    const now = new Date(2026, 9, 20, 4, 59);
    const lastFiredAt = new Date(2026, 9, 19, 5, 0);
    expect(missedRunToday(daily, lastFiredAt, now)).toBe(false);
  });
});

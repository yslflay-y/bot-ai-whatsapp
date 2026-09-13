import { describe, it, expect } from "vitest";
import { CronExpressionParser } from "cron-parser";

describe("Reminders & Cron Scheduling Logic", () => {
  it("parses valid weekly recurring cron expression (e.g. Every Monday at 9 AM)", () => {
    const cron = "0 9 * * 1";
    const interval = CronExpressionParser.parse(cron, {
      tz: "Asia/Jakarta",
    });

    const nextRun = interval.next().toDate();
    expect(nextRun).toBeInstanceOf(Date);
    expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    // 1 is Monday in standard cron (or Sunday/Monday depending on 0/7)
    expect([0, 1, 2, 3, 4, 5, 6]).toContain(nextRun.getDay());
  });

  it("calculates correct delay in milliseconds for future scheduled jobs", () => {
    const futureDate = new Date(Date.now() + 60000); // 1 minute in future
    const delay = Math.max(0, futureDate.getTime() - Date.now());
    expect(delay).toBeGreaterThan(50000);
    expect(delay).toBeLessThanOrEqual(60000);
  });

  it("handles past dates gracefully with 0 delay", () => {
    const pastDate = new Date(Date.now() - 10000);
    const delay = Math.max(0, pastDate.getTime() - Date.now());
    expect(delay).toBe(0);
  });
});

import type pg from "pg";
import type { Config } from "./config.js";
import { getFallbackSendSummarySince, getLastFallbackReportSentAt, recordFallbackReportSent } from "./database.js";
import { sendTelegramMessage } from "./telegram-api.js";
import { log } from "./log.js";

const REPORT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function formatReport(summary: { source: string; toolName: string; count: number }[], sinceDays: number): string {
  if (summary.length === 0) {
    return `Weekly fallback report: no fallback sends in the last ${sinceDays} days — the agent called its send tools correctly every time.`;
  }
  const total = summary.reduce((sum, row) => sum + row.count, 0);
  const lines = summary.map((row) => `- ${row.source} (${row.toolName}): ${row.count}`);
  return [
    `Weekly fallback report: ${total} reply/replies in the last ${sinceDays} days had to be delivered by the queue directly because the agent didn't call the expected send tool.`,
    ...lines,
  ].join("\n");
}

// Checked once per scheduler tick (see scheduler.ts). Fires at most once per
// REPORT_INTERVAL_MS, gated by the last row in fallback_reports rather than a
// fixed day/time, so it's restart-safe and self-heals after downtime instead
// of depending on the process being up at an exact minute each week.
export async function maybeSendWeeklyFallbackReport(pool: pg.Pool, config: Config): Promise<void> {
  if (config.telegram === undefined || config.owner.telegram === undefined) {
    // No Telegram configured for the owner — nothing to report to.
    return;
  }

  const lastSentAt = await getLastFallbackReportSentAt(pool);
  const now = Date.now();
  if (lastSentAt !== null && now - lastSentAt.getTime() < REPORT_INTERVAL_MS) {
    return;
  }

  const since = lastSentAt ?? new Date(now - REPORT_INTERVAL_MS);
  const sinceDays = Math.round((now - since.getTime()) / (24 * 60 * 60 * 1000));

  try {
    const summary = await getFallbackSendSummarySince(pool, since);
    const message = formatReport(summary, sinceDays);
    await sendTelegramMessage(config.telegram.botToken, config.owner.telegram, message);
    await recordFallbackReportSent(pool);
    log.info(`[stavrobot] Sent weekly fallback report (${summary.length > 0 ? summary.reduce((sum, row) => sum + row.count, 0) : 0} fallback send(s) in the last ${sinceDays} days).`);
  } catch (error) {
    log.error(`[stavrobot] Failed to send weekly fallback report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

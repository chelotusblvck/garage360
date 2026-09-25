import type { HealthStatus, SystemLog, TenantDiagnostics } from "./types";

/* Reporte para escalar a desarrollo: Markdown legible con la traza completa, o JSON crudo. */

const STATUS_ICON: Record<HealthStatus, string> = { ok: "✅", warn: "⚠️", error: "❌", na: "➖" };

/** Evita que un ``` dentro del stack o metadata rompa el bloque de código. */
const fence = (text: string) => text.replaceAll("```", "ˋˋˋ");

function logSection(log: SystemLog, i: number) {
  const lines = [
    `### ${i + 1}. [${log.level.toUpperCase()}] ${log.message}`,
    "",
    `- **Fecha:** ${log.created_at}`,
    `- **Origen:** \`${log.source}\``,
    `- **ID:** \`${log.id}\``,
  ];
  if (log.stack_trace) lines.push("", "**Stack trace**", "", "```", fence(log.stack_trace), "```");
  if (Object.keys(log.metadata).length) {
    lines.push("", "**Metadata**", "", "```json", fence(JSON.stringify(log.metadata, null, 2)), "```");
  }
  return lines.join("\n");
}

export function diagnosticsMarkdown(d: TenantDiagnostics, logs: SystemLog[] = d.logs) {
  const counts = { error: 0, warn: 0, info: 0 };
  for (const l of logs) counts[l.level]++;
  return [
    `# Reporte de soporte · ${d.workshop.name}`,
    "",
    `- **Taller:** ${d.workshop.name} (\`${d.workshop.id}\`)`,
    `- **Onboarding:** ${d.workshop.onboarding_completed ? "completo" : "pendiente"}`,
    `- **Entorno:** ${d.mode === "demo" ? "modo demo (datos en memoria)" : "Supabase"}`,
    `- **Generado:** ${d.generatedAt}`,
    `- **Logs incluidos:** ${logs.length} (${counts.error} error · ${counts.warn} warn · ${counts.info} info)`,
    "",
    "## Health check",
    "",
    "| Estado | Chequeo | Resumen |",
    "| --- | --- | --- |",
    ...d.health.map((h) => `| ${STATUS_ICON[h.status]} ${h.status} | ${h.label} | ${h.summary.replaceAll("|", "/")} |`),
    ...d.health.filter((h) => h.details.length).flatMap((h) => ["", `**${h.label}**`, "", ...h.details.map((x) => `- ${x}`)]),
    "",
    "## Logs",
    "",
    logs.length ? logs.map(logSection).join("\n\n") : "_Sin logs para los filtros aplicados._",
    "",
  ].join("\n");
}

export function diagnosticsJson(d: TenantDiagnostics, logs: SystemLog[] = d.logs) {
  return JSON.stringify({ ...d, logs }, null, 2);
}

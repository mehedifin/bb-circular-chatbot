/** Quick AI Gateway connectivity check (text + embeddings) using OIDC auth. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnvLocal();
  const { generateText, embedMany } = await import("ai");

  const { text } = await generateText({
    model: process.env.CHAT_MODEL ?? "anthropic/claude-sonnet-4.6",
    prompt: "Reply with exactly: OK",
  });
  console.log("text generation:", JSON.stringify(text.trim()));

  try {
    const { embeddings } = await embedMany({
      model: process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small",
      values: ["remittance rules", "কৃষি ঋণ"],
    });
    console.log("embeddings:", embeddings.length, "vectors, dim", embeddings[0]?.length);
  } catch (err) {
    console.log("embeddings FAILED:", (err as Error).message);
  }
}

main().catch((err) => {
  console.error("gateway test failed:", err.message ?? err);
  process.exit(1);
});

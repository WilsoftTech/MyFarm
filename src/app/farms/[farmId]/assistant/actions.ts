"use server";
import { assistantService } from "@/modules/ai-assistant/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";

export async function askQuestion(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    const exchange = await assistantService().ask(farmId, input);
    return "/farms/" + farmId + "/assistant?asked=" + exchange.questionId + "#question-" + exchange.questionId + "-item";
  }, "This request was already used. Reload the page and ask again.", "Write your question, up to 500 letters, and choose which records.",
  // D-P11-004: the daily limit, not the per-minute one.
  "You have asked 20 questions in the last 24 hours. You can ask again later. Your question is still here.");
}

export async function deleteQuestion(farmId: string, questionId: string) {
  return runServerCommand(async () => {
    await assistantService().remove(farmId, questionId);
    return "/farms/" + farmId + "/assistant?deleted=1";
  });
}

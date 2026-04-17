"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

// ── OpenRouter AI integration ───────────────────────────────────────
// Calls OpenRouter's chat completions API (OpenAI-compatible).
// Set OPENROUTER_API_KEY and DEFAULT_OPENROUTER_MODEL in the Convex dashboard.

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Send a chat completion request to OpenRouter. */
export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
        content: v.string(),
      })
    ),
    model: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  returns: v.object({
    content: v.string(),
    model: v.string(),
    usage: v.union(
      v.object({
        prompt_tokens: v.number(),
        completion_tokens: v.number(),
        total_tokens: v.number(),
      }),
      v.null(),
    ),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured. Set it in the Convex dashboard.");
    }

    const model = args.model || process.env.DEFAULT_OPENROUTER_MODEL || "google/gemini-3-flash-preview";

    const messages: ChatMessage[] = [];

    if (args.systemPrompt) {
      messages.push({ role: "system", content: args.systemPrompt });
    }

    messages.push(...args.messages);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from OpenRouter");
    }

    const usage = data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
        }
      : null;

    return {
      content,
      model: data.model || model,
      usage,
    };
  },
});

import OpenAI from "openai";
import { env } from "../utils/env.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set but AI matching is enabled.");
    }
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims, matches schema

export async function embedText(text: string): Promise<number[] | null> {
  if (!env.AI_MATCHING_ENABLED) return null;
  try {
    const res = await getClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    // The system must work without AI — never let an embedding failure
    // break signal creation. Log and fall through to keyword matching.
    console.error("Embedding generation failed, falling back to keyword matching:", err);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

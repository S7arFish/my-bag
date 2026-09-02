import { aiSearchConfig } from "@/config/aiSearchConfig";
import type { AiSearchRuntime } from "@/server/ai-search/contracts";
import { handleAiSearch } from "@/server/ai-search/handler";
import { OpenAiCompatibleProvider } from "@/server/ai-search/providers/openai-compatible";
import { DurableRateLimiter } from "./durable-rate-limiter";
import { cloudflareAiSearchLogger } from "./logger";
import { VectorizeRetriever } from "./vectorize-retriever";
import { WorkersAiProvider } from "./workers-ai-provider";

interface LegacyAiSearchEnv {
	AI: Ai;
	AI_RATE_LIMITER: DurableObjectNamespace<
		import("./durable-rate-limiter").RateLimiter
	>;
	VECTORIZE: VectorizeIndex;
	AI_API_KEY?: string;
	ALLOWED_ORIGINS?: string;
	PUBLIC_SITE_URL?: string;
}

function getOptionalEnvString(
	env: LegacyAiSearchEnv,
	key: string,
): string | undefined {
	const value = Reflect.get(env, key);
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getAllowedOrigins(env: LegacyAiSearchEnv): string[] {
	return String(
		getOptionalEnvString(env, "ALLOWED_ORIGINS") ??
			getOptionalEnvString(env, "PUBLIC_SITE_URL") ??
			"",
	)
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function createCloudflareAiSearchRuntime(
	env: LegacyAiSearchEnv,
): AiSearchRuntime {
	const apiKey = getOptionalEnvString(env, "AI_API_KEY");
	const provider = apiKey
		? new OpenAiCompatibleProvider({
				apiUrl: aiSearchConfig.provider.apiUrl,
				apiKey,
				chatModel: aiSearchConfig.provider.chatModel,
				embeddingModel: aiSearchConfig.provider.embeddingModel,
				embeddingDimensions: aiSearchConfig.provider.embeddingDimensions,
				logUpstreamError(event, status, responseSnippet) {
					cloudflareAiSearchLogger.error(
						event,
						new Error("Upstream AI request failed"),
						{ provider: "openai-compatible", status, responseSnippet },
					);
				},
			})
		: new WorkersAiProvider(env.AI);

	return {
		allowedOrigins: getAllowedOrigins(env),
		embeddingProvider: provider,
		chatProvider: provider,
		retriever: new VectorizeRetriever(env.VECTORIZE),
		rateLimiter: new DurableRateLimiter(env.AI_RATE_LIMITER),
		logger: cloudflareAiSearchLogger,
	};
}

export function handleCloudflareAiSearch(
	request: Request,
	env: LegacyAiSearchEnv,
): Promise<Response> {
	return handleAiSearch(request, createCloudflareAiSearchRuntime(env));
}

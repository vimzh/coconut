// Dated catalog listings and usage ranks are separate from measured evaluation results.
export const modelCompanies = {
  openai: {
    name: "OpenAI",
    logo: "/companies/openai.svg",
    sourceUrl: "https://openrouter.ai/images/icons/OpenAI.svg",
  },
  deepseek: {
    name: "DeepSeek",
    logo: "/companies/deepseek.png",
    sourceUrl: "https://openrouter.ai/images/icons/DeepSeek.png",
  },
  "z-ai": {
    name: "Z.ai",
    logo: "/companies/z-ai.svg",
    sourceUrl: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  tencent: {
    name: "Tencent",
    logo: "/companies/tencent.png",
    sourceUrl: "https://openrouter.ai/images/icons/Tencent.png",
  },
  stepfun: {
    name: "StepFun",
    logo: "/companies/stepfun.png",
    sourceUrl: "https://platform.stepfun.ai/images/title-logo.png",
  },
  anthropic: {
    name: "Anthropic",
    logo: "/companies/anthropic.svg",
    sourceUrl: "https://openrouter.ai/images/icons/Anthropic.svg",
  },
  minimax: {
    name: "MiniMax",
    logo: "/companies/minimax.ico",
    sourceUrl: "https://minimax.cn/favicon.ico",
  },
  moonshotai: {
    name: "MoonshotAI",
    logo: "/companies/moonshotai.png",
    sourceUrl: "https://openrouter.ai/images/icons/MoonshotAI.png",
  },
} as const;

export type DirectoryModel = {
  id: string;
  name: string;
  company: keyof typeof modelCompanies;
  openai: boolean;
  status: "listed" | "deprecated" | "open-weights";
  url: string;
  openrouter: { modelId: string; rank: number; tokens: string } | null;
};

export const directorySnapshot = {
  retrievedAt: "2026-11-08T08:36:43Z",
  openRouter: {
    url: "https://openrouter.ai/rankings",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-07",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  openAI: {
    url: "https://developers.openai.com/api/docs/models/all",
  },
} as const;

export const directoryModels: readonly DirectoryModel[] = [
  {
    id: "deepseek/deepseek-v4.1-flash-1017", name: "DeepSeek V4.1 Flash 1017", company: "deepseek",
    openai: false, status: "listed", url: "https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017",
    openrouter: { modelId: "deepseek/deepseek-v4.1-flash-1017", rank: 1, tokens: "56T" },
  },
  {
    id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", company: "deepseek",
    openai: false, status: "listed", url: "https://openrouter.ai/deepseek/deepseek-v4.1-flash",
    openrouter: { modelId: "deepseek/deepseek-v4.1-flash", rank: 2, tokens: "17.7T" },
  },
  {
    id: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash", company: "z-ai",
    openai: false, status: "listed", url: "https://openrouter.ai/z-ai/glm-5.3-flash",
    openrouter: { modelId: "z-ai/glm-5.3-flash", rank: 3, tokens: "13.5T" },
  },
  {
    id: "tencent/hy4", name: "Hy4", company: "tencent",
    openai: false, status: "listed", url: "https://openrouter.ai/tencent/hy4",
    openrouter: { modelId: "tencent/hy4", rank: 4, tokens: "10.1T" },
  },
  {
    id: "gpt-6-luna", name: "GPT-6 Luna", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-6-luna",
    openrouter: { modelId: "openai/gpt-6-luna", rank: 5, tokens: "7.26T" },
  },
  {
    id: "stepfun/step-5-preview", name: "Step 5 Preview", company: "stepfun",
    openai: false, status: "listed", url: "https://openrouter.ai/stepfun/step-5-preview",
    openrouter: { modelId: "stepfun/step-5-preview", rank: 6, tokens: "6.99T" },
  },
  {
    id: "anthropic/claude-opus-5.5", name: "Claude Opus 5.5", company: "anthropic",
    openai: false, status: "listed", url: "https://openrouter.ai/anthropic/claude-opus-5.5",
    openrouter: { modelId: "anthropic/claude-opus-5.5", rank: 7, tokens: "6.74T" },
  },
  {
    id: "minimax/minimax-m3.1-flash", name: "MiniMax M3.1 Flash", company: "minimax",
    openai: false, status: "listed", url: "https://openrouter.ai/minimax/minimax-m3.1-flash",
    openrouter: { modelId: "minimax/minimax-m3.1-flash", rank: 8, tokens: "5.37T" },
  },
  {
    id: "tencent/hy4-preview", name: "Hy4 preview", company: "tencent",
    openai: false, status: "listed", url: "https://openrouter.ai/tencent/hy4-preview",
    openrouter: { modelId: "tencent/hy4-preview", rank: 9, tokens: "4.2T" },
  },
  {
    id: "moonshotai/kimi-k3.1-pro", name: "Kimi K3.1 Pro", company: "moonshotai",
    openai: false, status: "listed", url: "https://openrouter.ai/moonshotai/kimi-k3.1-pro",
    openrouter: { modelId: "moonshotai/kimi-k3.1-pro", rank: 10, tokens: "4.12T" },
  },
  {
    id: "gpt-6-astra", name: "GPT-6 Astra", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-6-astra",
    openrouter: null,
  },
  {
    id: "gpt-6.1-sol", name: "GPT-6.1 Sol", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-6.1-sol",
    openrouter: null,
  },
  {
    id: "gpt-6.1-terra", name: "GPT-6.1 Terra", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-6.1-terra",
    openrouter: null,
  },
  {
    id: "gpt-6-cyber", name: "GPT-6-Cyber", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-6-cyber",
    openrouter: null,
  },
  {
    id: "gpt-5.6-cyber", name: "GPT-5.6 Cyber", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.6-cyber",
    openrouter: null,
  },
  {
    id: "gpt-rosalind-research", name: "GPT-Rosalind", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/pricing#specialized-models",
    openrouter: null,
  },
  {
    id: "gpt-oss-120b", name: "gpt-oss-120b", company: "openai",
    openai: true, status: "open-weights", url: "https://developers.openai.com/api/docs/models/gpt-oss-120b",
    openrouter: null,
  },
  {
    id: "gpt-oss-20b", name: "gpt-oss-20b", company: "openai",
    openai: true, status: "open-weights", url: "https://developers.openai.com/api/docs/models/gpt-oss-20b",
    openrouter: null,
  },
  {
    id: "gpt-6-sol", name: "GPT-6 Sol", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-6-sol",
    openrouter: null,
  },
  {
    id: "gpt-5.6-sol", name: "GPT-5.6 Sol", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
    openrouter: null,
  },
  {
    id: "gpt-5.6-terra", name: "GPT-5.6 Terra", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
    openrouter: null,
  },
  {
    id: "gpt-5.6-luna", name: "GPT-5.6 Luna", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
    openrouter: null,
  },
  {
    id: "gpt-5.5", name: "GPT-5.5", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.5",
    openrouter: null,
  },
  {
    id: "gpt-5.5-pro", name: "GPT-5.5 Pro", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.5-pro",
    openrouter: null,
  },
  {
    id: "gpt-5.4", name: "GPT-5.4", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.4",
    openrouter: null,
  },
  {
    id: "gpt-5.4-pro", name: "GPT-5.4 Pro", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.4-pro",
    openrouter: null,
  },
  {
    id: "gpt-5.4-mini", name: "GPT-5.4 Mini", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
    openrouter: null,
  },
  {
    id: "gpt-5.2", name: "GPT-5.2", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.2",
    openrouter: null,
  },
  {
    id: "gpt-5.2-pro", name: "GPT-5.2 Pro", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/gpt-5.2-pro",
    openrouter: null,
  },
  {
    id: "chat-latest", name: "Chat Latest", company: "openai",
    openai: true, status: "listed", url: "https://developers.openai.com/api/docs/models/chat-latest",
    openrouter: null,
  },
  {
    id: "gpt-daybreak-red-latest", name: "Daybreak Red", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-daybreak-red-latest",
    openrouter: null,
  },
  {
    id: "gpt-daybreak-blue-latest", name: "Daybreak Blue", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-daybreak-blue-latest",
    openrouter: null,
  },
  {
    id: "gpt-5.4-nano", name: "GPT-5.4 nano", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-5.4-nano",
    openrouter: null,
  },
  {
    id: "gpt-5.3-codex", name: "GPT-5.3-Codex", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-5.3-codex",
    openrouter: null,
  },
  {
    id: "gpt-5.1", name: "GPT-5.1", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-5.1",
    openrouter: null,
  },
  {
    id: "gpt-5", name: "GPT-5", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-5",
    openrouter: null,
  },
  {
    id: "gpt-5-mini", name: "GPT-5 Mini", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-5-mini",
    openrouter: null,
  },
  {
    id: "gpt-5-nano", name: "GPT-5 nano", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-5-nano",
    openrouter: null,
  },
  {
    id: "gpt-5-pro", name: "GPT-5 Pro", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-5-pro",
    openrouter: null,
  },
  {
    id: "o3-pro", name: "o3-pro", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/o3-pro",
    openrouter: null,
  },
  {
    id: "o3", name: "o3", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/o3",
    openrouter: null,
  },
  {
    id: "gpt-4.1", name: "GPT-4.1", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-4.1",
    openrouter: null,
  },
  {
    id: "gpt-4.1-mini", name: "GPT-4.1 Mini", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-4.1-mini",
    openrouter: null,
  },
  {
    id: "gpt-4o-mini", name: "GPT-4o Mini", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-4o-mini",
    openrouter: null,
  },
  {
    id: "gpt-4o", name: "GPT-4o", company: "openai",
    openai: true, status: "deprecated", url: "https://developers.openai.com/api/docs/models/gpt-4o",
    openrouter: null,
  },
];

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { StoreKey } from "../constant";

export enum SubmitKey {
  Enter = "Enter",
  CtrlEnter = "Ctrl + Enter",
  ShiftEnter = "Shift + Enter",
  AltEnter = "Alt + Enter",
  MetaEnter = "Meta + Enter",
}

export enum Theme {
  Dark = "dark",
  Light = "light",
}

export const DEFAULT_CONFIG = {
  sendBotMessages: true as boolean,
  submitKey: SubmitKey.CtrlEnter as SubmitKey,
  avatar: "",
  fontSize: 14,
  theme: Theme.Light as Theme,
  tightBorder: true,
  sendPreviewBubble: false,
  sidebarWidth: 300,

  disablePromptHint: false,

  dontShowMaskSplashScreen: false, // dont show splash screen when create chat

  modelConfig: {
    model: "gpt-4o" as ModelType,
    temperature: 1,
    max_tokens: 4000,
    presence_penalty: 0,
    sendMemory: true,
    historyMessageCount: 10,
    compressMessageLengthThreshold: 2000,
  },
};

export type ChatConfig = typeof DEFAULT_CONFIG;

export type ChatConfigStore = ChatConfig & {
  reset: () => void;
  update: (updater: (config: ChatConfig) => void) => void;
};

export type ModelConfig = ChatConfig["modelConfig"];

const ENABLE_GPT4 = true;

export const ALL_MODELS = [
  {
    name: "gpt-4o",
    available: ENABLE_GPT4,
  },
  {
    name: "gpt-4o-mini",
    available: ENABLE_GPT4,
  },
  {
    name: "o1-preview",
    available: ENABLE_GPT4,
  },
  {
    name: "o1-mini",
    available: ENABLE_GPT4,
  },
  {
    name: "gpt-4-turbo",
    available: ENABLE_GPT4,
  },
  {
    name: "gpt-4",
    available: ENABLE_GPT4,
  },
  {
    name: "gpt-3.5-turbo",
    available: true,
  },
  {
    name: "claude-3-opus-20240229",
    available: ENABLE_GPT4,
  },
  {
    name: "------------------",
    available: true,
  },
  {
    name: "gpt-4-vision-preview",
    available: ENABLE_GPT4,
  },
  {
    name: "gemini-pro",
    available: true,
  },
  {
    name: "gemini-pro-vision",
    available: true,
  },
  {
    name: "claude-3-sonnet-20240229",
    available: ENABLE_GPT4,
  },
] as const;

export type ModelType = (typeof ALL_MODELS)[number]["name"];

export function limitNumber(
  x: number,
  min: number,
  max: number,
  defaultValue: number,
) {
  if (typeof x !== "number" || isNaN(x)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, x));
}

export function limitModel(name: string) {
  return ALL_MODELS.some((m) => m.name === name && m.available)
    ? name
    : ALL_MODELS[4].name;
}

export const ModalConfigValidator = {
  model(x: string) {
    return limitModel(x) as ModelType;
  },
  max_tokens(x: number) {
    return limitNumber(x, 0, 32000, 2000);
  },
  presence_penalty(x: number) {
    return limitNumber(x, -2, 2, 0);
  },
  temperature(x: number) {
    return limitNumber(x, 0, 1, 1);
  },
};

export const useAppConfig = create<ChatConfigStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_CONFIG,

      reset() {
        set(() => ({ ...DEFAULT_CONFIG }));
      },

      update(updater) {
        const config = { ...get() };
        updater(config);
        set(() => config);
      },
    }),
    {
      name: StoreKey.Config,
      version: 2,
      migrate(persistedState, version) {
        if (version === 2) return persistedState as any;

        const state = persistedState as ChatConfig;
        state.modelConfig.sendMemory = true;
        state.modelConfig.historyMessageCount = 10;
        state.modelConfig.compressMessageLengthThreshold = 2000;
        state.dontShowMaskSplashScreen = false;

        return state;
      },
    },
  ),
);

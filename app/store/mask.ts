import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BUILTIN_MASKS } from "../masks";
import { getLang, Lang } from "../locales";
import { DEFAULT_TOPIC } from "./chat";
import { Message } from "../api/type/typing";
import { ModelConfig, ModelType, useAppConfig } from "./config";
import { StoreKey } from "../constant";

export type Updater<T> = (updater: (value: T) => void) => void;

export type Mask = {
  id: number;
  avatar: string;
  name: string;
  context: Message[];
  modelConfig: ModelConfig;
  lang: Lang;
  builtin: boolean;
};

export const DEFAULT_MASK_STATE = {
  masks: {} as Record<number, Mask>,
  globalMaskId: 0,
};

export type MaskState = typeof DEFAULT_MASK_STATE;
type MaskStore = MaskState & {
  create: (mask?: Partial<Mask>) => Mask;
  update: (id: number, updater: (mask: Mask) => void) => void;
  delete: (id: number) => void;
  search: (text: string) => Mask[];
  get: (id?: number) => Mask | null;
  getAll: () => Mask[];
};

export const DEFAULT_MASK_ID = 1145141919810;
export const DEFAULT_MASK_AVATAR = "gpt-bot";
export const createEmptyMask = () =>
  ({
    id: DEFAULT_MASK_ID,
    avatar: DEFAULT_MASK_AVATAR,
    name: DEFAULT_TOPIC,
    context: [],
    modelConfig: { ...useAppConfig.getState().modelConfig },
    lang: getLang(),
    builtin: false,
  } as Mask);

export const useMaskStore = create<MaskStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_MASK_STATE,

      create(mask) {
        set(() => ({ globalMaskId: get().globalMaskId + 1 }));
        const id = get().globalMaskId;
        const masks = get().masks;
        masks[id] = {
          ...createEmptyMask(),
          ...mask,
          id,
        };

        set(() => ({ masks }));

        return masks[id];
      },
      update(id, updater) {
        const masks = get().masks;
        const mask = masks[id];
        if (!mask) return;
        const updateMask = { ...mask };
        updater(updateMask);
        masks[id] = updateMask;
        set(() => ({ masks }));
      },
      delete(id) {
        const masks = get().masks;
        delete masks[id];
        set(() => ({ masks }));
      },

      get(id) {
        return get().masks[id ?? 1145141919810];
      },
      getAll() {
        const userMasks = Object.values(get().masks).sort(
          (a, b) => b.id - a.id,
        );
        return userMasks.concat(BUILTIN_MASKS);
      },
      search(text) {
        return Object.values(get().masks);
      },
    }),
    {
      name: StoreKey.Mask,
      version: 2,
    },
  ),
);

import { create } from "zustand";

export type MatchState = "IDLE" | "PERMISSION_CHECK" | "SEARCHING" | "MATCHED" | "IN_CALL" | "ENDED";

export interface Partner {
  name: string;
  country: string;
  level: string;
  username: string;
}

interface MatchStateStore {
  state: MatchState;
  partner: Partner | null;
  roomId: string | null;
  topic: string;
  isCaller: boolean;
  waitingCount: number;
  setState: (state: MatchState) => void;
  setPartner: (partner: Partner | null) => void;
  setRoomId: (id: string | null) => void;
  setTopic: (topic: string) => void;
  setIsCaller: (isCaller: boolean) => void;
  setWaitingCount: (count: number) => void;
  reset: () => void;
}

const createInitialState = () => ({
  state: "IDLE" as MatchState,
  partner: null as Partner | null,
  roomId: null as string | null,
  topic: "",
  isCaller: false,
  waitingCount: 0,
});

export const useMatchStore = create<MatchStateStore>((set) => ({
  ...createInitialState(),
  setState: (state) => set({ state }),
  setPartner: (partner) => set({ partner }),
  setRoomId: (roomId) => set({ roomId }),
  setTopic: (topic) => set({ topic }),
  setIsCaller: (isCaller) => set({ isCaller }),
  setWaitingCount: (waitingCount) => set({ waitingCount }),
  reset: () => set(createInitialState()),
}));

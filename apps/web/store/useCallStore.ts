import { create } from "zustand";

interface CallState {
  isMuted: boolean;
  isCameraOff: boolean;
  durationSeconds: number;
  setIsMuted: (muted: boolean) => void;
  setIsCameraOff: (off: boolean) => void;
  setDurationSeconds: (seconds: number) => void;
  reset: () => void;
}

const createInitialState = () => ({
  isMuted: false,
  isCameraOff: false,
  durationSeconds: 0,
});

export const useCallStore = create<CallState>((set) => ({
  ...createInitialState(),
  setIsMuted: (isMuted) => set({ isMuted }),
  setIsCameraOff: (isCameraOff) => set({ isCameraOff }),
  setDurationSeconds: (durationSeconds) => set({ durationSeconds }),
  reset: () => set(createInitialState()),
}));

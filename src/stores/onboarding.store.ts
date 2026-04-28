import { create } from 'zustand'

interface OnboardingData {
  step1: Record<string, unknown>
  step2: Record<string, unknown>
  step3: Record<string, unknown>
}

interface OnboardingState {
  step: number
  data: OnboardingData
  nextStep: () => void
  prevStep: () => void
  setStepData: (step: number, data: Record<string, unknown>) => void
  reset: () => void
}

const initialData: OnboardingData = {
  step1: {},
  step2: {},
  step3: {},
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  step: 1,
  data: { ...initialData },

  nextStep: () =>
    set((state) => ({
      step: Math.min(state.step + 1, 3),
    })),

  prevStep: () =>
    set((state) => ({
      step: Math.max(state.step - 1, 1),
    })),

  setStepData: (step, data) =>
    set((state) => ({
      data: {
        ...state.data,
        [`step${step}`]: data,
      },
    })),

  reset: () =>
    set({
      step: 1,
      data: { step1: {}, step2: {}, step3: {} },
    }),
}))

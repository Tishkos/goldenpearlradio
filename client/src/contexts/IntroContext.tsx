import { createContext, useContext } from "react";

interface IntroContextValue {
  introActive: boolean;
}

const IntroContext = createContext<IntroContextValue>({ introActive: false });

export function useIntro() {
  return useContext(IntroContext);
}

export const IntroProvider = IntroContext.Provider;

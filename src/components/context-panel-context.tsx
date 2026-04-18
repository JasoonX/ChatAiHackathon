"use client";

import { createContext, useContext } from "react";

type ContextPanelContextValue = {
  open: boolean;
  toggle: () => void;
  /** False for DMs and when no room is selected — hides the button entirely. */
  available: boolean;
};

export const ContextPanelContext = createContext<ContextPanelContextValue>({
  open: false,
  toggle: () => {},
  available: false,
});

export function useContextPanel() {
  return useContext(ContextPanelContext);
}

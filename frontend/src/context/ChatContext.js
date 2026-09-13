import { createContext, useContext } from "react";

export const ChatContext = createContext(null);

export function useChatContext() {
  return useContext(ChatContext);
}


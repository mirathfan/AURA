import type { AIMessage } from "@/src/components/ai/chatTypes";
import { appendMessageToChat, updateChatThread } from "./aiChats";
import { Toast } from "./toast";

// The reply is already on screen. A history write can fail independently of generation.
export async function saveDisplayedChatReply(
  uid: string,
  chatId: string,
  message: AIMessage,
  refreshThreads: () => Promise<unknown>,
  title?: string,
) {
  try {
    await appendMessageToChat(uid, chatId, message);
  } catch {
    Toast.error("Chat save failed", "This reply is visible here, but could not be saved to chat history.");
    return;
  }

  try {
    if (title) await updateChatThread(uid, chatId, { title });
    await refreshThreads();
  } catch {
    Toast.error("Chat list didn’t update", "Your reply was saved. Refresh your chats to update the list.");
  }
}

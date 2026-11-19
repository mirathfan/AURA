import { appendMessageToChat, updateChatThread } from "./aiChats";
import { saveDisplayedChatReply } from "./saveDisplayedChatReply";
import { Toast } from "./toast";
import type { AIMessage } from "@/src/components/ai/chatTypes";

jest.mock("./aiChats", () => ({ appendMessageToChat: jest.fn(), updateChatThread: jest.fn() }));
jest.mock("./toast", () => ({ Toast: { error: jest.fn() } }));

const reply: AIMessage = { type: "assistant", id: "look", createdAt: 10 };

it("keeps a failed history write from entering agent failure recovery", async () => {
  jest.mocked(appendMessageToChat).mockRejectedValueOnce(new Error("401"));
  const refresh = jest.fn();
  await saveDisplayedChatReply("owner", "chat", reply, refresh, "Today");
  expect(appendMessageToChat).toHaveBeenCalledWith("owner", "chat", reply);
  expect(updateChatThread).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(Toast.error).toHaveBeenCalledWith("Chat save failed", expect.any(String));
});

it("distinguishes a saved reply from a failed chat list refresh", async () => {
  const refresh = jest.fn().mockRejectedValueOnce(new Error("offline"));
  await saveDisplayedChatReply("owner", "chat", reply, refresh, "Today");
  expect(updateChatThread).toHaveBeenCalledWith("owner", "chat", { title: "Today" });
  expect(Toast.error).toHaveBeenCalledWith("Chat list didn’t update", expect.any(String));
});

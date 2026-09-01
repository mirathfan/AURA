import { sanitizeLogArgs, sanitizeLogValue } from "./logSanitizer";

describe("log sanitizer", () => {
  test("replaces user content with length-only diagnostics", () => {
    expect(sanitizeLogValue({
      query: "Style me for a private dinner",
      prompt: "Use the photo I uploaded",
      queryLength: 29,
    })).toEqual({
      query: { redacted: true, length: 29 },
      prompt: { redacted: true, length: 24 },
      queryLength: 29,
    });
  });

  test("summarizes UID-bearing storage paths", () => {
    expect(sanitizeLogValue({
      uid: "firebase-user-id",
      uidHash: "safe-hash",
      storagePath: "users/firebase-user-id/productPolish/refined/file.jpg",
    })).toEqual({
      uid: "[redacted-id]",
      uidHash: "safe-hash",
      storagePath: {
        scope: "user_storage",
        category: "productPolish",
        extension: "jpg",
      },
    });
  });

  test("scrubs paths, URLs, emails, and secrets embedded in log arguments", () => {
    const [message, data] = sanitizeLogArgs([
      "saved users/raw-uid/images/file.png for person@example.com at https://example.com/private?token=abc",
      { authorization: "Bearer private", imageUrl: "https://cdn.example.com/image/private.png" },
    ]);
    expect(message).toBe(
      "saved users/[redacted-id]/images/file.png for [redacted-email] at https://example.com/[redacted-path]",
    );
    expect(data).toEqual({
      authorization: "[redacted-secret]",
      imageUrl: "https://cdn.example.com/[redacted-path]",
    });
  });
});

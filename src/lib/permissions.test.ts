import { describe, expect, it } from "vitest";

import { canUserDeleteMessage } from "./permissions";

describe("canUserDeleteMessage", () => {
  it("returns true when user is the message author", () => {
    expect(
      canUserDeleteMessage(
        { id: "user-1" },
        { authorId: "user-1" },
        { adminUserIds: [] },
      ),
    ).toBe(true);
  });

  it("returns true when user is a room admin", () => {
    expect(
      canUserDeleteMessage(
        { id: "admin-1" },
        { authorId: "user-1" },
        { adminUserIds: ["admin-1"] },
      ),
    ).toBe(true);
  });

  it("returns false when user is neither", () => {
    expect(
      canUserDeleteMessage(
        { id: "user-2" },
        { authorId: "user-1" },
        { adminUserIds: ["admin-1"] },
      ),
    ).toBe(false);
  });
});

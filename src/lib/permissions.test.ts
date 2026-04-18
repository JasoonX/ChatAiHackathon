import { describe, expect, it } from "vitest";

import {
  canUserDeleteMessage,
  canUserDeleteRoom,
  canUserDownloadAttachment,
  canUserInviteToRoom,
  canUserJoinRoom,
  canUserManageMembers,
  canUserPostInRoom,
  canUserRemoveAdmin,
  canUsersDirectMessage,
} from "./permissions";

describe("canUserJoinRoom", () => {
  it("R2.4.5: public room can be joined when user is not banned and not already a member", () => {
    expect(
      canUserJoinRoom(
        { id: "user-1" },
        { type: "public" },
        null,
        null,
      ),
    ).toBe(true);
  });

  it("R2.4.8: banned user cannot join room", () => {
    expect(
      canUserJoinRoom(
        { id: "user-1" },
        { type: "public" },
        null,
        { userId: "user-1" },
      ),
    ).toBe(false);
  });

  it("R2.4.5: existing member cannot join the same room again", () => {
    expect(
      canUserJoinRoom(
        { id: "user-1" },
        { type: "public" },
        { userId: "user-1", role: "member" },
        null,
      ),
    ).toBe(false);
  });

  it("R2.4.5: private room cannot be joined without invitation", () => {
    expect(
      canUserJoinRoom(
        { id: "user-1" },
        { type: "private", hasInvitation: false },
        null,
        null,
      ),
    ).toBe(false);
  });

  it("R2.4.9: private room can be joined with invitation when not banned", () => {
    expect(
      canUserJoinRoom(
        { id: "user-1" },
        { type: "private", hasInvitation: true },
        null,
        null,
      ),
    ).toBe(true);
  });
});

describe("canUserPostInRoom", () => {
  it("R2.5.2: member can post in a room", () => {
    expect(
      canUserPostInRoom(
        { id: "user-1" },
        { type: "public" },
        { userId: "user-1", role: "member" },
      ),
    ).toBe(true);
  });

  it("R2.5.2: admin can post in a room", () => {
    expect(
      canUserPostInRoom(
        { id: "admin-1" },
        { type: "private" },
        { userId: "admin-1", role: "admin" },
      ),
    ).toBe(true);
  });

  it("R2.4.8: removed user cannot post after losing membership", () => {
    expect(
      canUserPostInRoom({ id: "user-1" }, { type: "public" }, null),
    ).toBe(false);
  });

  it("R2.5.1: direct room requires membership to post", () => {
    expect(
      canUserPostInRoom({ id: "user-1" }, { type: "direct" }, null),
    ).toBe(false);
  });
});

describe("canUserDeleteMessage", () => {
  it("R2.5.5: author can delete their own message", () => {
    expect(
      canUserDeleteMessage(
        { id: "user-1" },
        { authorId: "user-1" },
        { type: "public", ownerId: "owner-1", adminUserIds: [] },
      ),
    ).toBe(true);
  });

  it("R2.4.7: room admin can delete another user's message", () => {
    expect(
      canUserDeleteMessage(
        { id: "admin-1" },
        { authorId: "user-1" },
        { type: "public", ownerId: "owner-1", adminUserIds: ["admin-1"] },
      ),
    ).toBe(true);
  });

  it("R2.4.7: room owner can delete another user's message", () => {
    expect(
      canUserDeleteMessage(
        { id: "owner-1" },
        { authorId: "user-1" },
        { type: "private", ownerId: "owner-1", adminUserIds: [] },
      ),
    ).toBe(true);
  });

  it("R2.5.5: regular member cannot delete another user's message", () => {
    expect(
      canUserDeleteMessage(
        { id: "user-2" },
        { authorId: "user-1" },
        { type: "public", ownerId: "owner-1", adminUserIds: ["admin-1"] },
      ),
    ).toBe(false);
  });

  it("R2.5.5: in direct rooms only the author can delete a message", () => {
    expect(
      canUserDeleteMessage(
        { id: "user-2" },
        { authorId: "user-1" },
        { type: "direct", ownerId: null, adminUserIds: ["user-2"] },
      ),
    ).toBe(false);
  });
});

describe("canUserManageMembers", () => {
  it("R2.4.7: owner can manage members", () => {
    expect(
      canUserManageMembers(
        { id: "owner-1" },
        { type: "private", ownerId: "owner-1" },
        { userId: "owner-1", role: "member" },
      ),
    ).toBe(true);
  });

  it("R2.4.7: admin can manage members", () => {
    expect(
      canUserManageMembers(
        { id: "admin-1" },
        { type: "public", ownerId: "owner-1" },
        { userId: "admin-1", role: "admin" },
      ),
    ).toBe(true);
  });

  it("R2.4.7: regular member cannot manage members", () => {
    expect(
      canUserManageMembers(
        { id: "member-1" },
        { type: "public", ownerId: "owner-1" },
        { userId: "member-1", role: "member" },
      ),
    ).toBe(false);
  });

  it("R2.4.7: non-member cannot manage members", () => {
    expect(
      canUserManageMembers(
        { id: "user-1" },
        { type: "private", ownerId: "owner-1" },
        null,
      ),
    ).toBe(false);
  });
});

describe("canUserDeleteRoom", () => {
  it("R2.4.6: owner can delete room", () => {
    expect(
      canUserDeleteRoom({ id: "owner-1" }, { type: "public", ownerId: "owner-1" }),
    ).toBe(true);
  });

  it("R2.4.7: admin cannot delete room they do not own", () => {
    expect(
      canUserDeleteRoom({ id: "admin-1" }, { type: "public", ownerId: "owner-1" }),
    ).toBe(false);
  });

  it("R2.4.6: regular member cannot delete room", () => {
    expect(
      canUserDeleteRoom({ id: "member-1" }, { type: "private", ownerId: "owner-1" }),
    ).toBe(false);
  });
});

describe("canUserDownloadAttachment", () => {
  it("R2.6.4: current member can download room attachment", () => {
    expect(
      canUserDownloadAttachment(
        { id: "user-1" },
        { userId: "user-1", role: "member" },
      ),
    ).toBe(true);
  });

  it("R2.6.4: current admin can download room attachment", () => {
    expect(
      canUserDownloadAttachment(
        { id: "admin-1" },
        { userId: "admin-1", role: "admin" },
      ),
    ).toBe(true);
  });

  it("R2.4.8: removed member loses access to room files", () => {
    expect(canUserDownloadAttachment({ id: "user-1" }, null)).toBe(false);
  });

  it("R2.6.4: uploader cannot download once they are no longer a member", () => {
    expect(canUserDownloadAttachment({ id: "uploader-1" }, null)).toBe(false);
  });
});

describe("canUsersDirectMessage", () => {
  it("R2.3.6: friends with no active bans can direct message", () => {
    expect(
      canUsersDirectMessage(
        { id: "user-a" },
        { id: "user-b" },
        { exists: true },
        [],
      ),
    ).toBe(true);
  });

  it("R2.3.6: non-friends cannot direct message", () => {
    expect(
      canUsersDirectMessage(
        { id: "user-a" },
        { id: "user-b" },
        { exists: false },
        [],
      ),
    ).toBe(false);
  });

  it("R2.3.5: blocker cannot direct message a banned user", () => {
    expect(
      canUsersDirectMessage(
        { id: "user-a" },
        { id: "user-b" },
        { exists: true },
        [{ blockerUserId: "user-a", blockedUserId: "user-b" }],
      ),
    ).toBe(false);
  });

  it("R2.3.5: blocked user cannot direct message the user who banned them", () => {
    expect(
      canUsersDirectMessage(
        { id: "user-a" },
        { id: "user-b" },
        { exists: true },
        [{ blockerUserId: "user-b", blockedUserId: "user-a" }],
      ),
    ).toBe(false);
  });
});

describe("canUserInviteToRoom", () => {
  it("R2.4.9: member of private room can send an invitation", () => {
    expect(
      canUserInviteToRoom(
        { id: "user-1" },
        { type: "private" },
        { userId: "user-1", role: "member" },
      ),
    ).toBe(true);
  });

  it("R2.4.9: admin of private room can send an invitation", () => {
    expect(
      canUserInviteToRoom(
        { id: "admin-1" },
        { type: "private" },
        { userId: "admin-1", role: "admin" },
      ),
    ).toBe(true);
  });

  it("R2.4.9: non-member cannot invite to a private room", () => {
    expect(
      canUserInviteToRoom({ id: "user-1" }, { type: "private" }, null),
    ).toBe(false);
  });

  it("R2.4.5: public room does not use invitations", () => {
    expect(
      canUserInviteToRoom(
        { id: "user-1" },
        { type: "public" },
        { userId: "user-1", role: "member" },
      ),
    ).toBe(false);
  });
});

describe("canUserRemoveAdmin", () => {
  it("R2.4.7b: owner can remove admin from another user", () => {
    expect(
      canUserRemoveAdmin(
        { id: "owner-1" },
        { id: "admin-1" },
        { type: "private", ownerId: "owner-1" },
      ),
    ).toBe(true);
  });

  it("R2.4.7b: owner cannot remove themselves as owner", () => {
    expect(
      canUserRemoveAdmin(
        { id: "owner-1" },
        { id: "owner-1" },
        { type: "private", ownerId: "owner-1" },
      ),
    ).toBe(false);
  });

  it("R2.4.7b: admin cannot remove another admin", () => {
    expect(
      canUserRemoveAdmin(
        { id: "admin-2" },
        { id: "admin-1" },
        { type: "private", ownerId: "owner-1" },
      ),
    ).toBe(false);
  });

  it("R2.4.7b: non-owner cannot remove the room owner", () => {
    expect(
      canUserRemoveAdmin(
        { id: "admin-1" },
        { id: "owner-1" },
        { type: "private", ownerId: "owner-1" },
      ),
    ).toBe(false);
  });
});

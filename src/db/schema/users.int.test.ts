import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db } from "../../../tests/setup/integration";
import { users } from "./users";

describe("users schema", () => {
  it("inserts and reads back a user row", async () => {
    const email = `integration-${randomUUID()}@example.com`;

    const [insertedUser] = await db.insert(users).values({ email }).returning();

    const foundUser = await db.query.users.findFirst({
      where: eq(users.id, insertedUser.id),
    });

    expect(foundUser).toMatchObject({
      id: insertedUser.id,
      email,
    });
    expect(foundUser?.createdAt).toBeInstanceOf(Date);
  });
});

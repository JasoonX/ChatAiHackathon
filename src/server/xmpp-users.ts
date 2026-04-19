/**
 * XMPP user registration helper.
 *
 * With allow_registration = true in Prosody, XMPP clients can
 * self-register via in-band registration (XEP-0077). The bridge
 * identifies users by matching their XMPP nickname to our app's
 * username, so no server-side pre-creation is needed for the demo.
 */

export async function registerXmppUser(
  username: string,
  _password: string,
): Promise<void> {
  const domain = process.env.PROSODY_A_DOMAIN ?? "a.chat.local";
  const prosodyHost = process.env.PROSODY_A_COMPONENT_HOST;

  if (!prosodyHost) {
    return;
  }

  console.log(
    `[XMPP Users] User ${username}@${domain} can self-register on Prosody`,
  );
}

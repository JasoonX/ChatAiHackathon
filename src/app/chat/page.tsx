// import { redirect } from "next/navigation";
// import { getCurrentUser } from "@/server/auth";

export default async function ChatPage() {
  // TODO: restore auth guard
  // const user = await getCurrentUser();
  // if (!user) { redirect("/login"); }

  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Select a room or contact to start chatting
    </div>
  );
}

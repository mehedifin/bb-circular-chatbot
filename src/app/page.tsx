import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { indexStats } from "@/lib/retrieval/store";
import { Chat } from "@/components/chat";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const stats = indexStats();

  return (
    <Chat
      userName={session.user.name ?? session.user.email ?? "User"}
      indexReady={stats.ready}
      docCount={stats.ready ? stats.docs : 0}
    />
  );
}

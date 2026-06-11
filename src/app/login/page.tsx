import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-6 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur text-3xl">
            🏦
          </div>
          <h1 className="text-2xl font-semibold text-white">BB Circular Assistant</h1>
          <p className="mt-2 text-sm text-emerald-100/80">
            Bangladesh Bank circulars for banks &amp; NBFIs — bilingual answers with cited
            sources · বাংলা ও ইংরেজি
          </p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-emerald-100/60">
          Demo access: demo@bb-circulars.app / demo1234
        </p>
      </div>
    </main>
  );
}

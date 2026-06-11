import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="app-background flex min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 sm:py-12">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-pine">
          Hidden Hotel Finance
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">财务后台登录</h1>
        <div className="mt-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brass">
          Hidden Hotel Finance
        </p>
        <h1 className="mt-3 text-3xl font-bold text-ink">财务后台登录</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          使用管理员、操作员或投资人账号登录。Phase 1 使用 Supabase 邮箱密码认证。
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

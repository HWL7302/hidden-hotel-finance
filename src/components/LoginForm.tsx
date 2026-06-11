"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setIsLoading(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "账号或密码错误，请确认后重新输入。"
          : signInError.message
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          邮箱
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="mt-2 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="mt-2 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
        />
      </div>
      {error ? (
        <p className="break-words rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-pine px-4 py-3 text-base font-semibold text-white transition hover:bg-slateblue disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "登录中..." : "邮箱密码登录"}
      </button>
    </form>
  );
}


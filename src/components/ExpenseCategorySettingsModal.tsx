"use client";

import { FormEvent, useState } from "react";
import type { ExpenseCategoryRecord } from "@/lib/expense-categories";

type CategoryForm = {
  displayName: string;
  defaultPayee: string;
};

const emptyForm: CategoryForm = {
  displayName: "",
  defaultPayee: ""
};

async function readApiError(response: Response) {
  const result = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return result?.error || "支出分类操作失败，请稍后重试。";
}

export function ExpenseCategorySettingsModal({
  categories,
  onClose,
  onCategoriesChanged
}: {
  categories: ExpenseCategoryRecord[];
  onClose: () => void;
  onCategoriesChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function sendRequest(input: string, init: RequestInit) {
    try {
      return await fetch(input, init);
    } catch {
      setIsSaving(false);
      setError("网络连接失败，请稍后重试。");
      return null;
    }
  }

  function resetEditor() {
    setEditingKey(null);
    setForm(emptyForm);
  }

  function startEdit(category: ExpenseCategoryRecord) {
    setEditingKey(category.category_key);
    setForm({
      displayName: category.display_name,
      defaultPayee: category.default_payee ?? ""
    });
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const displayName = form.displayName.trim();

    if (!displayName) {
      setError("分类名称不能为空。");
      return;
    }

    setIsSaving(true);
    const response = await sendRequest(
      editingKey
        ? `/api/expense-categories/${encodeURIComponent(editingKey)}`
        : "/api/expense-categories",
      {
        method: editingKey ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          default_payee: form.defaultPayee.trim() || null
        })
      }
    );

    if (!response) {
      return;
    }

    if (!response.ok) {
      setIsSaving(false);
      setError(await readApiError(response));
      return;
    }

    await onCategoriesChanged();
    setIsSaving(false);
    setNotice(editingKey ? "支出分类已更新。" : "支出分类已新增。");
    resetEditor();
  }

  async function handleToggle(category: ExpenseCategoryRecord) {
    setError("");
    setNotice("");
    setIsSaving(true);

    const response = await sendRequest(
      `/api/expense-categories/${encodeURIComponent(category.category_key)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !category.is_active })
      }
    );

    if (!response) {
      return;
    }

    if (!response.ok) {
      setIsSaving(false);
      setError(await readApiError(response));
      return;
    }

    await onCategoriesChanged();
    setIsSaving(false);
    setNotice(category.is_active ? "支出分类已停用。" : "支出分类已启用。");
  }

  async function handleDelete(category: ExpenseCategoryRecord) {
    if (!window.confirm(`确认删除支出分类「${category.display_name}」吗？`)) {
      return;
    }

    setError("");
    setNotice("");
    setIsSaving(true);

    const response = await sendRequest(
      `/api/expense-categories/${encodeURIComponent(category.category_key)}`,
      { method: "DELETE" }
    );

    if (!response) {
      return;
    }

    if (!response.ok) {
      setIsSaving(false);
      setError(await readApiError(response));
      return;
    }

    await onCategoriesChanged();
    setIsSaving(false);
    setNotice("支出分类已删除。");

    if (editingKey === category.category_key) {
      resetEditor();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-category-settings-title"
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3
            id="expense-category-settings-title"
            className="text-lg font-semibold text-ink"
          >
            支出分类设置
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="关闭支出分类设置"
            className="h-10 w-10 text-2xl leading-none text-stone-500 transition hover:text-ink disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-5">
          {error ? (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </p>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 border-b border-slate-200 pb-5 md:grid-cols-[1fr_1fr_auto] md:items-end"
          >
            <label className="text-sm font-medium text-ink">
              分类名称
              <input
                required
                value={form.displayName}
                disabled={isSaving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: event.target.value
                  }))
                }
                className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>
            <label className="text-sm font-medium text-ink">
              默认收款方
              <input
                value={form.defaultPayee}
                disabled={isSaving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultPayee: event.target.value
                  }))
                }
                placeholder="可不填写"
                className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-11 rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white transition hover:bg-slateblue disabled:opacity-60"
              >
                {isSaving ? "保存中..." : editingKey ? "保存修改" : "新增分类"}
              </button>
              {editingKey ? (
                <button
                  type="button"
                  onClick={resetEditor}
                  disabled={isSaving}
                  className="min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-ink transition hover:border-pine hover:text-pine disabled:opacity-60"
                >
                  取消
                </button>
              ) : null}
            </div>
          </form>

          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">分类名称</th>
                  <th className="px-4 py-3 font-semibold">默认收款方</th>
                  <th className="px-4 py-3 font-semibold">状态</th>
                  <th className="px-4 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((category) => (
                  <tr key={category.category_key}>
                    <td className="px-4 py-3 font-medium text-ink">
                      {category.display_name}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {category.default_payee || "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {category.is_active ? "启用" : "停用"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(category)}
                          disabled={isSaving}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-pine hover:text-pine disabled:opacity-60"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggle(category)}
                          disabled={isSaving}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-pine hover:text-pine disabled:opacity-60"
                        >
                          {category.is_active ? "停用" : "启用"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(category)}
                          disabled={isSaving}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 space-y-3 md:hidden">
            {categories.map((category) => (
              <div
                key={category.category_key}
                className="rounded-md border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-ink">
                      {category.display_name}
                    </p>
                    <p className="mt-1 break-words text-xs text-stone-500">
                      默认收款方：{category.default_payee || "无"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-stone-600">
                    {category.is_active ? "启用" : "停用"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(category)}
                    disabled={isSaving}
                    className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggle(category)}
                    disabled={isSaving}
                    className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
                  >
                    {category.is_active ? "停用" : "启用"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(category)}
                    disabled={isSaving}
                    className="min-h-10 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

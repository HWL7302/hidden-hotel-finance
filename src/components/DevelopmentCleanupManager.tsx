"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-client";

const confirmationText = "CLEAR TEST DATA";
const bucketName = "evidence-files";

async function listStoragePaths(
  supabase: ReturnType<typeof createClient>,
  folder: string
): Promise<string[]> {
  const { data, error } = await supabase.storage.from(bucketName).list(folder, {
    limit: 1000
  });

  if (error) {
    throw error;
  }

  const paths: string[] = [];
  for (const item of data ?? []) {
    const path = `${folder}/${item.name}`;
    if (item.id) {
      paths.push(path);
    } else {
      paths.push(...(await listStoragePaths(supabase, path)));
    }
  }
  return paths;
}

export function DevelopmentCleanupManager({ storeId }: { storeId: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);

  async function handleCleanup() {
    setError("");
    setNotice("");

    if (confirmation !== confirmationText) {
      setError(`请输入 ${confirmationText} 后再执行清理。`);
      return;
    }

    if (
      !window.confirm(
        "确认清空当前门店的测试收入、测试支出和测试凭证吗？此操作无法撤销。"
      )
    ) {
      return;
    }

    setIsCleaning(true);
    const supabase = createClient();

    try {
      const { data, error: cleanupError } = await supabase.rpc(
        "clear_development_test_data",
        { confirmation_text: confirmationText }
      );

      if (cleanupError) {
        throw cleanupError;
      }

      const storagePaths = await listStoragePaths(
        supabase,
        `${storeId}/receipts`
      );

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(bucketName)
          .remove(storagePaths);
        if (storageError) {
          throw storageError;
        }
      }

      setNotice(
        `测试数据已清理：收入 ${data.deleted_incomes} 条，支出 ${data.deleted_expenses} 条，凭证 ${data.deleted_evidence_files} 条。`
      );
      setConfirmation("");
    } catch (cleanupError) {
      setError(
        cleanupError instanceof Error ? cleanupError.message : "清理失败。"
      );
    } finally {
      setIsCleaning(false);
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-ink">开发测试数据清理</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
        此隐藏工具仅供管理员在正式上线前使用。它会清空当前门店的测试收入、测试支出、凭证记录和测试凭证文件。
      </p>

      {error ? (
        <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="mt-6 max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-red-700">
          操作不可撤销。请先确认当前环境仍是开发测试环境。
        </p>
        <label className="mt-5 block text-sm font-medium text-ink">
          输入确认文字
          <input
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={confirmationText}
            className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={isCleaning}
          onClick={() => void handleCleanup()}
          className="mt-5 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCleaning ? "清理中..." : "清空测试数据"}
        </button>
      </div>
    </section>
  );
}

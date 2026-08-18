import { NextResponse } from "next/server";
import { ADMIN_EMAIL } from "@/lib/permissions";
import { createClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ categoryKey: string }>;
};

async function getAuthorizedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      response: NextResponse.json({ error: "请先登录。" }, { status: 401 })
    };
  }

  if ((user.email ?? "").trim().toLowerCase() !== ADMIN_EMAIL) {
    return {
      supabase,
      response: NextResponse.json(
        { error: "当前账号无权管理支出分类。" },
        { status: 403 }
      )
    };
  }

  return { supabase, response: null };
}

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, response } = await getAuthorizedClient();

  if (response) {
    return response;
  }

  const { categoryKey } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body || Object.hasOwn(body, "category_key")) {
    return NextResponse.json(
      { error: "分类内部 key 不能修改。" },
      { status: 400 }
    );
  }

  const updates: {
    display_name?: string;
    default_payee?: string | null;
    is_active?: boolean;
  } = {};

  if (Object.hasOwn(body, "display_name")) {
    const displayName =
      typeof body.display_name === "string" ? body.display_name.trim() : "";

    if (!displayName) {
      return NextResponse.json(
        { error: "分类名称不能为空。" },
        { status: 400 }
      );
    }

    updates.display_name = displayName;
  }

  if (Object.hasOwn(body, "default_payee")) {
    const defaultPayee = normalizeOptionalText(body.default_payee);

    if (defaultPayee === undefined) {
      return NextResponse.json(
        { error: "默认收款方格式不正确。" },
        { status: 400 }
      );
    }

    updates.default_payee = defaultPayee;
  }

  if (Object.hasOwn(body, "is_active")) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json(
        { error: "分类状态格式不正确。" },
        { status: 400 }
      );
    }

    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "没有可更新的分类内容。" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("expense_categories")
    .update(updates)
    .eq("category_key", categoryKey)
    .select(
      "category_key,display_name,default_payee,is_active,sort_order,created_at,updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "该支出分类名称已经存在。"
            : error.message
      },
      { status: error.code === "23505" ? 409 : 500 }
    );
  }

  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { supabase, response } = await getAuthorizedClient();

  if (response) {
    return response;
  }

  const { categoryKey } = await context.params;
  const { count, error: countError } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("category", categoryKey);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: "该分类已有历史支出记录，不能删除，只能停用。",
        code: "CATEGORY_IN_USE",
        can_deactivate: true
      },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("expense_categories")
    .delete()
    .eq("category_key", categoryKey);

  if (error) {
    return NextResponse.json(
      {
        error:
          error.code === "23503"
            ? "该分类已有历史支出记录，不能删除，只能停用。"
            : error.message
      },
      { status: error.code === "23503" ? 409 : 500 }
    );
  }

  return NextResponse.json({ success: true });
}

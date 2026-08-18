import { NextResponse } from "next/server";
import { ADMIN_EMAIL } from "@/lib/permissions";
import { createClient } from "@/lib/supabase-server";

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  if ((user.email ?? "").trim().toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "当前账号无权管理支出分类。" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body || Object.hasOwn(body, "category_key")) {
    return NextResponse.json(
      { error: "分类内部 key 由系统生成，不能手动提交。" },
      { status: 400 }
    );
  }

  const displayName =
    typeof body.display_name === "string" ? body.display_name.trim() : "";
  const defaultPayee = normalizeOptionalText(body.default_payee);

  if (!displayName) {
    return NextResponse.json({ error: "分类名称不能为空。" }, { status: 400 });
  }

  if (defaultPayee === undefined) {
    return NextResponse.json(
      { error: "默认收款方格式不正确。" },
      { status: 400 }
    );
  }

  const { data: lastCategory, error: sortError } = await supabase
    .from("expense_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sortError) {
    return NextResponse.json({ error: sortError.message }, { status: 500 });
  }

  const nextSortOrder = Number(lastCategory?.sort_order ?? 0) + 10;
  const { data, error } = await supabase
    .from("expense_categories")
    .insert({
      display_name: displayName,
      default_payee: defaultPayee,
      is_active: true,
      sort_order: nextSortOrder
    })
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

  return NextResponse.json({ data }, { status: 201 });
}

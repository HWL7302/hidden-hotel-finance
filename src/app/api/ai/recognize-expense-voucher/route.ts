import { NextResponse } from "next/server";
import {
  expenseCategoryOptions,
  paymentMethodOptions
} from "@/lib/finance-options";
import {
  ADMIN_EMAIL,
  canPerform,
  normalizeRole,
  type AppRole
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase-server";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_VISION_MODEL = "gpt-4.1-mini";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const supportedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
};

type RecognitionPayload = {
  record_type: "expense";
  date: string | null;
  amount: number | null;
  payment_method: string | null;
  category: string;
  payee: string | null;
  note: string | null;
  confidence: number;
  warnings: string[];
};

function errorResponse(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function extractOutputText(response: OpenAiResponse) {
  if (response.output_text) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }

  return "";
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function resolveRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string
): Promise<AppRole> {
  if (email.trim().toLowerCase() === ADMIN_EMAIL) {
    return "admin";
  }

  const { data, error } = await supabase.rpc(
    "current_investor_permission_role"
  );

  return error ? "viewer" : normalizeRole(typeof data === "string" ? data : null);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("请先登录后再使用 AI 识别。", 401);
  }

  const role = await resolveRole(supabase, user.email ?? "");
  if (!canPerform(role, "manageExpenses")) {
    return errorResponse("当前账号无权使用 AI 凭证识别。", 403);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResponse("AI识别尚未配置，请联系管理员。", 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("图片读取失败，请重新选择。", 400);
  }

  const image = formData.get("image");
  if (!(image instanceof File)) {
    return errorResponse("请选择一张支出凭证图片。", 400);
  }

  if (!supportedImageTypes.has(image.type)) {
    return errorResponse("仅支持 JPG、PNG、WEBP 或 GIF 图片。", 400);
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return errorResponse("图片不能超过 10MB。", 400);
  }

  const categoryValues = expenseCategoryOptions.map((option) => option.value);
  const fallbackCategory = categoryValues.includes("other")
    ? "other"
    : categoryValues[categoryValues.length - 1];
  const categoryDescription = expenseCategoryOptions
    .map((option) => `${option.value}=${option.label}`)
    .join("、");
  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const imageUrl = `data:${image.type};base64,${imageBase64}`;

  let openAiResponse: Response;
  try {
    openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || DEFAULT_VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "识别这张支出凭证，并只返回符合 schema 的数据。",
                  "金额必须是实际付款金额；不要把订单号、时间、余额或房号当作金额。不确定时返回 null。",
                  `支付方式只能是：${paymentMethodOptions.join("、")}；不确定时返回 null。`,
                  `分类只能是：${categoryDescription}。无法判断时使用 ${fallbackCategory}，并添加人工确认警告。`,
                  "分类参考：工资/薪资/员工/前台=salary；腾讯特权/游戏会员/网吧特权/加速器=game_membership；水费/电费/水电/物业=utilities；房租/租金/房东=rent；清洁/纸巾/洗衣液/消毒/垃圾袋=cleaning_supplies；维修/修理/设备/配件=repair；装修=renovation_equipment；推广/广告/投流/平台推广=platform_promotion。",
                  "日期使用 YYYY-MM-DD。无法可靠识别的日期、收款方、支付方式或备注返回 null，不要猜测。备注建议应简短并以“AI识别：”开头。"
                ].join("\n")
              },
              {
                type: "input_image",
                image_url: imageUrl,
                detail: "high"
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "expense_voucher_recognition",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                record_type: { type: "string", enum: ["expense"] },
                date: { type: ["string", "null"] },
                amount: { type: ["number", "null"], minimum: 0 },
                payment_method: {
                  type: ["string", "null"],
                  enum: [...paymentMethodOptions, null]
                },
                category: { type: "string", enum: categoryValues },
                payee: { type: ["string", "null"] },
                note: { type: ["string", "null"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                warnings: { type: "array", items: { type: "string" } }
              },
              required: [
                "record_type",
                "date",
                "amount",
                "payment_method",
                "category",
                "payee",
                "note",
                "confidence",
                "warnings"
              ]
            }
          }
        }
      })
    });
  } catch (requestError) {
    console.error("OpenAI expense voucher request failed", requestError);
    return errorResponse("AI识别请求超时或网络不可用，请稍后重试。", 502);
  }

  let responseBody: OpenAiResponse;
  try {
    responseBody = (await openAiResponse.json()) as OpenAiResponse;
  } catch {
    return errorResponse("AI识别暂时不可用，请稍后重试。", 502);
  }
  if (!openAiResponse.ok) {
    console.error("OpenAI expense voucher recognition failed", {
      status: openAiResponse.status,
      message: responseBody.error?.message
    });
    return errorResponse(
      openAiResponse.status === 401
        ? "AI服务配置无效，请联系管理员。"
        : "AI识别暂时不可用，请稍后重试。",
      502
    );
  }

  const outputText = extractOutputText(responseBody);
  let parsed: RecognitionPayload;
  try {
    parsed = JSON.parse(outputText) as RecognitionPayload;
  } catch {
    return errorResponse("无法识别凭证内容，请手动填写。", 422);
  }

  if (!parsed || typeof parsed !== "object") {
    return errorResponse("无法识别凭证内容，请手动填写。", 422);
  }

  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  const category = categoryValues.includes(parsed.category)
    ? parsed.category
    : fallbackCategory;

  if (category !== parsed.category) {
    warnings.push("支出分类无法确认，已归入其他，请人工确认。");
  }

  const amount =
    typeof parsed.amount === "number" &&
    Number.isFinite(parsed.amount) &&
    parsed.amount >= 0
      ? Math.round(parsed.amount * 100) / 100
      : null;
  const paymentMethod = paymentMethodOptions.includes(
    parsed.payment_method ?? ""
  )
    ? parsed.payment_method
    : null;

  return NextResponse.json({
    success: true,
    record_type: "expense",
    date: isValidDate(parsed.date) ? parsed.date : null,
    amount,
    payment_method: paymentMethod,
    category,
    payee:
      typeof parsed.payee === "string" && parsed.payee.trim()
        ? parsed.payee.trim()
        : null,
    note:
      typeof parsed.note === "string" && parsed.note.trim()
        ? parsed.note.trim()
        : null,
    confidence:
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0,
    warnings
  });
}

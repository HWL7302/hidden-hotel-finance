export default function DashboardPage() {
  const metrics = [
    { label: "本月收入", value: "待录入" },
    { label: "本月支出", value: "待录入" },
    { label: "可分红金额", value: "待计算" },
    { label: "凭证数量", value: "待上传" }
  ];

  return (
    <section>
      <h2 className="text-2xl font-bold text-ink">首页仪表盘</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
        电竞酒店财务记账与分红管理系统，用于内部账务、收入支出、月度结算、分红追踪、凭证留存和审计。
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-stone-500">{metric.label}</p>
            <p className="mt-3 text-xl font-semibold text-ink">{metric.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

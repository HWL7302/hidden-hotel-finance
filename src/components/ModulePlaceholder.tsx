export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return <section><h2 className="text-2xl font-bold text-ink">{title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">{description}</p><div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"><p className="text-sm font-medium text-stone-700">Phase 1 仅提供模块入口和权限预留，完整录入、查询、导出和统计将在后续阶段实现。</p></div></section>;
}

import { AccessDenied } from "@/components/AccessDenied";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function RoomsPage() {
  const context = await getDashboardContext("rooms");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <ModulePlaceholder
      title="房间/月租"
      description="仅记录长期住客、月租客、包月房和特殊折扣房；普通短租客不逐房间录入。"
    />
  );
}

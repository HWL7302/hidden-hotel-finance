import { AccessDenied } from "@/components/AccessDenied";
import { RoomMonthlyRentManager } from "@/components/RoomMonthlyRentManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function RoomsPage() {
  const context = await getDashboardContext("rooms");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <RoomMonthlyRentManager
      currentUserId={context.user.id}
      currentRole={context.currentRole}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}

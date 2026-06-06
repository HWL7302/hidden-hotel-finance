import { AccessDenied } from "@/components/AccessDenied";
import { ExpenseManager } from "@/components/ExpenseManager";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function ExpensesPage() {
  const context = await getDashboardContext("expenses");

  if (context.accessDenied) {
    return <AccessDenied />;
  }

  return (
    <ExpenseManager
      currentUserId={context.user.id}
      currentRole={context.currentRole}
      defaultStoreId={context.defaultStoreId}
      storeLoadError={context.storeLoadError}
    />
  );
}

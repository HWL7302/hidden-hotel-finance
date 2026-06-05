type SupabaseLikeError = {
  code?: string;
  message?: string;
};

export function isMonthlyClosingPermissionError(
  error: SupabaseLikeError | null | undefined
) {
  return (
    error?.code === "42501" ||
    error?.message?.includes("permission denied for table monthly_closings")
  );
}

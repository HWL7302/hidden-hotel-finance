import type { SupabaseClient } from "@supabase/supabase-js";

export type EvidenceType = "income" | "expense" | "other";
export type RelatedTable = "incomes" | "expenses";

export const evidenceBucketName = "evidence-files";
export const allowedEvidenceExtensions = ["jpg", "jpeg", "png", "pdf"];

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function createStoragePath(storeId: string, file: File) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${storeId}/receipts/${year}/${month}/${crypto.randomUUID()}.${getExtension(file.name)}`;
}

export async function uploadEvidenceForRecord({
  supabase,
  file,
  storeId,
  userId,
  evidenceType,
  relatedTable,
  relatedRecordId
}: {
  supabase: SupabaseClient;
  file: File;
  storeId: string;
  userId: string;
  evidenceType: Exclude<EvidenceType, "other">;
  relatedTable: RelatedTable;
  relatedRecordId: string;
}) {
  const extension = getExtension(file.name);
  if (!allowedEvidenceExtensions.includes(extension)) {
    throw new Error("仅支持 jpg、jpeg、png 和 pdf 文件。");
  }

  const storagePath = createStoragePath(storeId, file);
  const { error: uploadError } = await supabase.storage
    .from(evidenceBucketName)
    .upload(storagePath, file, { upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data: evidence, error: insertError } = await supabase
    .from("evidence_files")
    .insert({
      store_id: storeId,
      evidence_type: evidenceType,
      file_url: storagePath,
      file_name: file.name,
      file_type: extension,
      storage_bucket: evidenceBucketName,
      storage_path: storagePath,
      related_table: relatedTable,
      related_record_id: relatedRecordId,
      uploaded_by: userId
    })
    .select("id")
    .single();

  if (insertError) {
    await supabase.storage.from(evidenceBucketName).remove([storagePath]);
    throw insertError;
  }

  const { error: linkError } = await supabase
    .from(relatedTable)
    .update({ evidence_file: evidence.id })
    .eq("id", relatedRecordId);

  if (linkError) {
    await supabase.from("evidence_files").delete().eq("id", evidence.id);
    await supabase.storage.from(evidenceBucketName).remove([storagePath]);
    throw linkError;
  }

  return evidence.id as string;
}

export async function createSignedEvidenceUrl(
  supabase: SupabaseClient,
  evidenceId: string
) {
  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence_files")
    .select("storage_bucket,storage_path")
    .eq("id", evidenceId)
    .single();

  if (evidenceError) {
    throw evidenceError;
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(evidence.storage_bucket)
    .createSignedUrl(evidence.storage_path, 60);

  if (signedUrlError) {
    throw signedUrlError;
  }

  return data.signedUrl;
}

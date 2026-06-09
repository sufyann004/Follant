import { getSupabaseConfig } from "./env";
import { getSupabaseClient } from "./supabase";
import { mapOrganizationRow, mapProfileRow } from "./supabase-mappers";
import type { Organization, Profile } from "../types";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error("File uploads are temporarily unavailable. Please try again later.");
  return client;
}

function getBucket(): string {
  return getSupabaseConfig()?.storageBucket ?? "Pics";
}

function extFromFile(file: File): string {
  const fromName = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  if (fromName) return fromName;
  const byMime: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return byMime[file.type] ?? ".bin";
}

function validateImageFile(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller");
  }
}

async function uploadImage(path: string, file: File): Promise<string> {
  const supabase = requireClient();
  validateImageFile(file);

  const { error } = await supabase.storage.from(getBucket()).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(getBucket()).getPublicUrl(path);
  return data.publicUrl;
}

async function recordUpload(input: {
  userId: string;
  organizationId: string | null;
  entityType: "profile" | "organization" | "organization_banner";
  entityId: string;
  file: File;
  storagePath: string;
  publicUrl: string;
}) {
  const supabase = requireClient();
  const storedFilename = input.storagePath.split("/").pop() ?? input.file.name;

  const { error } = await supabase.from("uploaded_files").insert({
    id: crypto.randomUUID(),
    uploaded_by: input.userId,
    organization_id: input.organizationId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    original_filename: input.file.name,
    stored_filename: storedFilename,
    mime_type: input.file.type,
    size_bytes: input.file.size,
    storage_path: input.storagePath,
    public_url: input.publicUrl,
  });

  if (error) throw new Error(error.message);
}

async function logUpload(
  action: string,
  description: string,
  options?: { organizationId?: string; entityType?: string; entityId?: string },
) {
  const supabase = requireClient();
  const { error } = await supabase.rpc("log_activity", {
    p_action: action,
    p_description: description,
    p_organization_id: options?.organizationId ?? null,
    p_entity_type: options?.entityType ?? null,
    p_entity_id: options?.entityId ?? null,
  });
  if (error) console.warn("[log_activity]", error.message);
}

export async function uploadAvatar(file: File): Promise<{ user: Profile; url: string }> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();
  if (readError) throw new Error(readError.message);
  if (current?.avatar_url) {
    await removeStoredImageByPublicUrl(current.avatar_url as string);
  }

  const storagePath = `${user.id}/avatar/${crypto.randomUUID()}${extFromFile(file)}`;
  const url = await uploadImage(storagePath, file);

  await recordUpload({
    userId: user.id,
    organizationId: null,
    entityType: "profile",
    entityId: user.id,
    file,
    storagePath,
    publicUrl: url,
  });

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await logUpload("profile.avatar_upload", "Updated profile avatar", {
    entityType: "user",
    entityId: user.id,
  });

  return { user: mapProfileRow(data as Record<string, unknown>), url };
}

function storagePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = "/object/public/";
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    const after = url.pathname.slice(idx + marker.length);
    const slash = after.indexOf("/");
    if (slash === -1) return null;
    return decodeURIComponent(after.slice(slash + 1));
  } catch {
    return null;
  }
}

async function removeStoredImageByPublicUrl(publicUrl: string) {
  const supabase = requireClient();
  const { data: files, error: lookupError } = await supabase
    .from("uploaded_files")
    .select("storage_path")
    .eq("public_url", publicUrl)
    .limit(1);
  if (lookupError) {
    console.warn("Could not look up uploaded_files record:", lookupError.message);
  }

  const storagePath =
    (files?.[0]?.storage_path as string | undefined) ?? storagePathFromPublicUrl(publicUrl) ?? undefined;
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from(getBucket()).remove([storagePath]);
    if (storageError) {
      console.warn("Could not remove stored image from bucket:", storageError.message);
    }
  }

  const { error: deleteError } = await supabase.from("uploaded_files").delete().eq("public_url", publicUrl);
  if (deleteError) {
    console.warn("Could not remove uploaded_files record:", deleteError.message);
  }
}

export async function deleteAvatar(): Promise<{ user: Profile }> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (current?.avatar_url) {
    await removeStoredImageByPublicUrl(current.avatar_url as string);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (updateError) throw new Error(updateError.message);

  const { data, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!data) throw new Error("Profile not found");

  await logUpload("file.delete", "Removed profile avatar", {
    entityType: "user",
    entityId: user.id,
  }).catch((err) => {
    console.warn("Could not log avatar removal:", err);
  });

  return { user: mapProfileRow(data as Record<string, unknown>) };
}

export async function deleteOrgLogo(orgId: string): Promise<{ organization: Organization }> {
  return deleteOrgImage(orgId, "logo_url", "Removed organization logo");
}

export async function deleteOrgBanner(orgId: string): Promise<{ organization: Organization }> {
  return deleteOrgImage(orgId, "banner_url", "Removed organization banner");
}

async function deleteOrgImage(
  orgId: string,
  column: "logo_url" | "banner_url",
  description: string,
): Promise<{ organization: Organization }> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data: current, error: readError } = await supabase
    .from("organizations")
    .select(column)
    .eq("id", orgId)
    .single();
  if (readError) throw new Error(readError.message);
  const url = (current as Record<string, string | null> | null)?.[column];
  if (url) {
    await removeStoredImageByPublicUrl(url);
  }

  const { data, error } = await supabase
    .from("organizations")
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq("id", orgId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await logUpload("file.delete", description, {
    organizationId: orgId,
    entityType: "organization",
    entityId: orgId,
  });

  return { organization: mapOrganizationRow(data as Record<string, unknown>) };
}

export async function uploadOrgLogo(orgId: string, file: File): Promise<{ organization: Organization; url: string }> {
  return uploadOrgImage(orgId, file, "logo", "logo_url", "org.logo_upload", "Updated organization logo");
}

export async function uploadOrgBanner(orgId: string, file: File): Promise<{ organization: Organization; url: string }> {
  return uploadOrgImage(orgId, file, "banner", "banner_url", "org.banner_upload", "Updated organization banner");
}

async function uploadOrgImage(
  orgId: string,
  file: File,
  folder: "logo" | "banner",
  column: "logo_url" | "banner_url",
  action: string,
  description: string,
): Promise<{ organization: Organization; url: string }> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const entityType = folder === "banner" ? "organization_banner" : "organization";

  const { data: current, error: readError } = await supabase
    .from("organizations")
    .select(column)
    .eq("id", orgId)
    .single();
  if (readError) throw new Error(readError.message);
  const previousUrl = (current as Record<string, string | null> | null)?.[column];
  if (previousUrl) {
    await removeStoredImageByPublicUrl(previousUrl);
  }

  const storagePath = `${user.id}/orgs/${orgId}/${folder}/${crypto.randomUUID()}${extFromFile(file)}`;
  const url = await uploadImage(storagePath, file);

  await recordUpload({
    userId: user.id,
    organizationId: orgId,
    entityType,
    entityId: orgId,
    file,
    storagePath,
    publicUrl: url,
  });

  const { data, error } = await supabase
    .from("organizations")
    .update({ [column]: url, updated_at: new Date().toISOString() })
    .eq("id", orgId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await logUpload(action, description, {
    organizationId: orgId,
    entityType: "organization",
    entityId: orgId,
  });

  return { organization: mapOrganizationRow(data as Record<string, unknown>), url };
}

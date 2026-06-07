import { getSupabaseConfig } from "./env";
import { getSupabaseClient } from "./supabase";
import { mapOrganizationRow, mapProfileRow } from "./supabase-mappers";
import type { Organization, Profile } from "../types";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
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
    "image/svg+xml": ".svg",
  };
  return byMime[file.type] ?? ".bin";
}

function validateImageFile(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, GIF, and SVG images are allowed");
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
  if (error) throw new Error(error.message);
}

export async function uploadAvatar(file: File): Promise<{ user: Profile; url: string }> {
  const supabase = requireClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

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

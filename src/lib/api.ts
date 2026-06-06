export function getAuthHeaders(json = true): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function parseError(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  throw new Error((data as { error?: string }).error || fallback);
}

export async function uploadWithAuth(url: string, fieldName: string, file: File) {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(false),
    body: form,
  });
  if (!res.ok) await parseError(res, "Upload failed");
  return res.json();
}

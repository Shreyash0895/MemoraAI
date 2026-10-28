/* Small fetch wrapper for the MemoraAI API. Vite proxies /api to the backend in development. */
export async function request(path, { method = "GET", body, blob } = {}) {
  const headers = {};
  let payload;
  if (blob) {
    headers["Content-Type"] = blob.type;
    payload = blob;
  } else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: "same-origin" });
  } catch {
    throw { code: "network", status: 0, message: "Can’t reach the server. Make sure the backend is running (docker compose up)." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw { code: data.code || "error", status: res.status, message: data.message || "Something went wrong. Please try again." };
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  upload: (path, blob) => request(path, { method: "POST", blob }),
};

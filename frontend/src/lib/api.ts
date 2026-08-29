const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

type GetToken = () => Promise<string | null>;

async function request<T>(
  path: string,
  options: RequestInit & { getToken?: GetToken } = {}
): Promise<T> {
  const { getToken, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (getToken) {
    const token = await getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore — use default message
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  submitSignal: (
    data: { lookingFor: string; canOffer: string; location?: string },
    getToken: GetToken
  ) =>
    request<{ signal: any }>("/api/signals", { method: "POST", body: JSON.stringify(data), getToken }),

  getMySignalStatus: (getToken: GetToken) =>
    request<{ signal: any | null }>("/api/signals/status", { getToken }),

  renewMySignal: (getToken: GetToken) =>
    request<{ signal: any }>("/api/signals/renew", { method: "POST", getToken }),

  deleteMySignal: (getToken: GetToken) =>
    request<{ deleted: boolean }>("/api/signals/me", { method: "DELETE", getToken }),

  getMatch: (token: string) => request<{ match: any }>(`/api/matches/${token}`),

  expressInterest: (matchId: string, getToken: GetToken) =>
    request<{ status: string }>(`/api/matches/${matchId}/interest`, { method: "POST", getToken }),

  rejectMatch: (matchId: string, getToken: GetToken) =>
    request<{ status: string }>(`/api/matches/${matchId}/reject`, { method: "POST", getToken }),

  revealEmail: (matchId: string, getToken: GetToken) =>
    request<{ email: string }>(`/api/matches/${matchId}/reveal-email`, { getToken }),

  createRequestLink: (getToken: GetToken) =>
    request<{ token: string; url: string }>("/api/requests", { method: "POST", getToken }),

  getRequest: (token: string) =>
    request<{ lookingFor: string; location: string }>(`/api/requests/${token}`),

  respondToRequest: (
    token: string,
    data: { response: "know_someone" | "might_know" | "not_me"; canOffer?: string; email?: string }
  ) => request(`/api/requests/${token}/respond`, { method: "POST", body: JSON.stringify(data) }),

  trackEvent: (event: string, metadata?: Record<string, unknown>) =>
    fetch(`${API_URL}/api/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata }),
      keepalive: true,
    }).catch(() => {}),

  admin: {
    stats: (getToken: GetToken) => request<any>("/api/admin/stats", { getToken }),
    signals: (getToken: GetToken, params?: { query?: string; status?: string }) =>
      request<{ signals: any[] }>(
        `/api/admin/signals${params?.status || params?.query ? `?${new URLSearchParams(params as any)}` : ""}`,
        { getToken }
      ),
    matches: (getToken: GetToken, status?: string) =>
      request<{ matches: any[] }>(`/api/admin/matches${status ? `?status=${status}` : ""}`, { getToken }),
    patchSignal: (id: string, data: any, getToken: GetToken) =>
      request(`/api/admin/signals/${id}`, { method: "PATCH", body: JSON.stringify(data), getToken }),
    triggerMatch: (id: string, getToken: GetToken) =>
      request(`/api/admin/signals/${id}/trigger-match`, { method: "POST", getToken }),
  },
};

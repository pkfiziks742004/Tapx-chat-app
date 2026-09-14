const API_URL = process.env.VITE_API_URL || "http://localhost:3000";

async function request(path, { method = "GET", token, body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    const e = new Error(`Connecting to server...`);
    e.code = "network_error";
    e.status = 0;
    e.cause = err;
    throw e;
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    if (data?.code) err.code = data.code;
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

async function requestForm(path, { method = "POST", token, formData } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });
  } catch (err) {
    const e = new Error(`Connecting to server...`);
    e.code = "network_error";
    e.status = 0;
    e.cause = err;
    throw e;
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    if (data?.code) err.code = data.code;
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export const api = {
  getMe: (token) => request("/api/me", { token }),
  updateMe: (token, name, bio) => request("/api/me", { method: "PUT", token, body: { name, bio } }),
  uploadAvatar: (token, file) => {
    const fd = new FormData();
    fd.set("file", file);
    return requestForm("/api/me/avatar", { method: "POST", token, formData: fd });
  },
  listThreads: (token) => request("/api/threads", { token }),
  listContacts: (token) => request("/api/contacts", { token }),
  addContact: (token, email) => request("/api/contacts", { method: "POST", token, body: { email } }),
  sendMessage: (token, to, text) =>
    request("/api/messages", { method: "POST", token, body: { to, text } }),
  deleteMessage: (token, id, scope = "me") =>
    request("/api/messages/delete", { method: "POST", token, body: { id, scope } }),
  deleteMessages: (token, ids, scope = "me") =>
    request("/api/messages/delete-many", { method: "POST", token, body: { ids, scope } }),
  forwardMessage: (token, id, to) =>
    request("/api/messages/forward", { method: "POST", token, body: { id, to } }),
  forwardMessages: (token, ids, to) =>
    request("/api/messages/forward-many", { method: "POST", token, body: { ids, to } }),
  sendFile: (token, to, file, text = "") => {
    const fd = new FormData();
    fd.set("to", to);
    if (text) fd.set("text", text);
    fd.set("file", file);
    return requestForm("/api/messages/file", { method: "POST", token, formData: fd });
  },
  clearChat: (token, peerId) =>
    request("/api/chats/clear", { method: "POST", token, body: { with: peerId } }),
  listGroups: (token) => request("/api/groups", { token }),
  createGroup: (token, name, memberIds) =>
    request("/api/groups", { method: "POST", token, body: { name, memberIds } }),
  clearGroupChat: (token, groupId) =>
    request(`/api/groups/${encodeURIComponent(groupId)}/clear`, { method: "POST", token }),
  markGroupRead: (token, groupId) =>
    request(`/api/groups/${encodeURIComponent(groupId)}/read`, { method: "POST", token }),
  listGroupMessages: (token, groupId) =>
    request(`/api/groups/${encodeURIComponent(groupId)}/messages`, { token }),
  sendGroupMessage: (token, groupId, text) =>
    request(`/api/groups/${encodeURIComponent(groupId)}/messages`, { method: "POST", token, body: { text } }),
  sendGroupFile: (token, groupId, file, text = "") => {
    const fd = new FormData();
    if (text) fd.set("text", text);
    fd.set("file", file);
    return requestForm(`/api/groups/${encodeURIComponent(groupId)}/messages/file`, {
      method: "POST",
      token,
      formData: fd
    });
  },
  deleteGroupMessages: (token, groupId, ids, scope = "me") =>
    request(`/api/groups/${encodeURIComponent(groupId)}/messages/delete-many`, {
      method: "POST",
      token,
      body: { ids, scope }
    }),
  markRead: (token, peerId) =>
    request("/api/messages/read", { method: "POST", token, body: { with: peerId } }),
  listCalls: (token, { limit } = {}) => {
    const q = Number.isFinite(Number(limit)) ? `?limit=${encodeURIComponent(String(Number(limit)))}` : "";
    return request(`/api/calls${q}`, { token });
  },
  deleteCall: (token, id) => request("/api/calls/delete", { method: "POST", token, body: { id } }),
  clearCalls: (token) => request("/api/calls/clear", { method: "POST", token }),
  listMessagesWith: (token, otherId) =>
    request(`/api/messages?with=${encodeURIComponent(otherId)}`, { token })
};

export const authApi = {
  sendSignupOtp: (email) => request("/auth/signup/send-otp", { method: "POST", body: { email } }),
  verifySignupOtp: (email, otp) =>
    request("/auth/signup/verify-otp", { method: "POST", body: { email, otp } }),
  sendForgotPasswordOtp: (email) =>
    request("/auth/forgot-password/send-otp", { method: "POST", body: { email } }),
  verifyForgotPasswordOtp: (email, otp) =>
    request("/auth/forgot-password/verify-otp", { method: "POST", body: { email, otp } }),
  resetPasswordWithOtp: (email, otp, newPassword) =>
    request("/auth/forgot-password/reset", { method: "POST", body: { email, otp, newPassword } }),
  setPassword: (token, password, currentPassword) =>
    request("/auth/set-password", {
      method: "POST",
      token,
      body: {
        password,
        ...(currentPassword ? { currentPassword } : {})
      }
    }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  refresh: (refresh_token) => request("/auth/refresh", { method: "POST", body: { refresh_token } })
};

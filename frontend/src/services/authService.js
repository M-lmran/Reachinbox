import { apiClient, TOKEN_KEY } from "@/lib/apiClient";

export const authService = {
  async getConfig() {
    const { data } = await apiClient.get("/auth/config");
    return data.data;
  },

  async devLogin(payload = {}) {
    const { data } = await apiClient.post("/auth/dev-login", payload);
    localStorage.setItem(TOKEN_KEY, data.data.token);
    return data.data.user;
  },

  async loginWithSupabase(accessToken) {
    const { data } = await apiClient.post("/auth/supabase", { accessToken });
    localStorage.setItem(TOKEN_KEY, data.data.token);
    return data.data.user;
  },

  async me() {
    const { data } = await apiClient.get("/auth/me");
    return data.data;
  },

  async logout() {
    try {
      await apiClient.post("/auth/logout");
    } catch (_e) {
      /* stateless token; ignore */
    }
    localStorage.removeItem(TOKEN_KEY);
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },
};

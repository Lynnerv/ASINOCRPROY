import api from "./auth";

export const notificationsApi = {
  list: (params) => api.get("/notificaciones", { params }),
  unreadCount: () => api.get("/notificaciones/unread-count"),
  markRead: (id) => api.patch(`/notificaciones/${id}/leida`),
  markAllRead: () => api.patch("/notificaciones/marcar-todas"),
};
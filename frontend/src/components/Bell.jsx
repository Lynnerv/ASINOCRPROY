import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell as BellIcon } from "lucide-react";
import { notificationsApi } from "../api/notifications";
import "../styles/bell.css";

export default function Bell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  async function refresh() {
    try {
      const res = await notificationsApi.unreadCount();
      setCount(res.data.count || 0);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      className="bell-btn"
      onClick={() => navigate("/notificaciones")}
      type="button"
      title="Notificaciones"
    >
      <BellIcon size={16} />
      {count > 0 && <span className="bell-badge">{count}</span>}
    </button>
  );
}
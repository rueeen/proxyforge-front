import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
});

export const MEDIA_BASE = "http://localhost:8000";

export default api;

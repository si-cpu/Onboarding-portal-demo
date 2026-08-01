import { useEffect, useState } from "react";
import { fetchPublicMissions } from "../lib/missionBank";

// intern 화면에서 쓰는 공개 미션 목록 (질문 텍스트만, mapped 값 없음).
export function useMissions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicMissions()
      .then((list) => {
        if (!cancelled) setMissions(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { missions, loading, error };
}

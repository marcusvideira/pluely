import { useCallback, useEffect, useState } from "react";
import {
  getAllMeetings,
  getMeetingById,
  deleteMeeting as deleteMeetingAction,
  deleteEmptyMeetings,
} from "@/lib/database";
import { Meeting } from "@/types";

export const useMeetings = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMeetings = useCallback(async () => {
    try {
      setIsLoading(true);
      // Always discard empty meetings (no transcript), including crash orphans.
      await deleteEmptyMeetings().catch(() => {});
      const result = await getAllMeetings();
      setMeetings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meetings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const viewMeeting = useCallback(async (id: string) => {
    return await getMeetingById(id);
  }, []);

  const deleteMeeting = useCallback(
    async (id: string) => {
      await deleteMeetingAction(id);
      await refreshMeetings();
    },
    [refreshMeetings]
  );

  useEffect(() => {
    refreshMeetings();
  }, [refreshMeetings]);

  return {
    meetings,
    isLoading,
    error,
    refreshMeetings,
    viewMeeting,
    deleteMeeting,
    clearError: () => setError(null),
  };
};

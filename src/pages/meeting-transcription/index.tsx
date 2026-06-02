import { PageLayout } from "@/layouts";
import { useMeetings } from "@/hooks";
import { MeetingsList } from "./components";

const MeetingTranscription = () => {
  const { meetings, isLoading, deleteMeeting } = useMeetings();

  return (
    <PageLayout
      title="Meetings"
      description="History of your meeting transcripts. Start a live transcript from the main overlay (the notebook button). Open a meeting to summarize it with AI or export it as Markdown."
    >
      <MeetingsList
        meetings={meetings}
        isLoading={isLoading}
        onDelete={deleteMeeting}
      />
    </PageLayout>
  );
};

export default MeetingTranscription;

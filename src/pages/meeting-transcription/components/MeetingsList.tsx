import { Badge, Button, Card, Empty } from "@/components";
import { Meeting } from "@/types";
import { NotebookPenIcon, Trash2 } from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";

interface MeetingsListProps {
  meetings: Meeting[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}

export const MeetingsList = ({
  meetings,
  isLoading,
  onDelete,
}: MeetingsListProps) => {
  const navigate = useNavigate();

  if (meetings.length === 0) {
    return (
      <Empty
        isLoading={isLoading}
        icon={NotebookPenIcon}
        title="No meetings yet"
        description="Start a meeting above to capture and transcribe it."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground select-none font-medium">
        Past meetings
      </p>
      <div className="grid grid-cols-1 gap-3">
        {meetings.map((meeting) => (
          <Card
            key={meeting.id}
            className="shadow-none select-none p-4 gap-0 group relative transition-all !bg-black/5 dark:!bg-white/5 hover:!border-primary/50 cursor-pointer"
            onClick={() => navigate(`/meetings/view/${meeting.id}`)}
          >
            <div className="flex items-center justify-between">
              <p className="line-clamp-1 text-sm mr-8">{meeting.title}</p>
              <div className="flex items-center gap-1">
                {meeting.summary && (
                  <Badge variant="outline" className="text-xs">
                    Summarized
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {moment(meeting.updatedAt).format("MMM D, hh:mm A")}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete meeting"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(meeting.id);
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

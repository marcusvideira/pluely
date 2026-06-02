import {
  Card,
  Updater,
  DragButton,
  CustomCursor,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components";
import {
  SystemAudio,
  Completion,
  AudioVisualizer,
  StatusIndicator,
  MeetingMicVad,
  MeetingPanel,
} from "./components";
import { useApp, useMeetingTranscription, useWindowResize } from "@/hooks";
import { useApp as useAppContext } from "@/contexts";
import { NotebookPenIcon, SparklesIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/layouts";
import { getPlatform } from "@/lib";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const App = () => {
  const { isHidden, systemAudio } = useApp();
  const { customizable } = useAppContext();
  const meeting = useMeetingTranscription();
  const { resizeWindow } = useWindowResize();
  const platform = getPlatform();
  // Whether the meeting panel is shown — independent of recording state.
  const [panelOpen, setPanelOpen] = useState(false);

  // Expand the overlay window while the meeting panel is open.
  useEffect(() => {
    if (panelOpen) {
      resizeWindow(true);
    }
  }, [panelOpen, resizeWindow]);

  // Stream live segments to the detached Insights window while recording.
  useEffect(() => {
    if (!meeting.isMeetingActive) return;
    const payload = meeting.segments.slice(-80);
    const t = setTimeout(() => {
      emit("insights:segments", payload).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [meeting.segments, meeting.isMeetingActive]);

  const openDashboard = async () => {
    try {
      await invoke("open_dashboard");
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  };

  return (
    <ErrorBoundary
      fallbackRender={() => {
        return <ErrorLayout isCompact />;
      }}
      resetKeys={["app-error"]}
      onReset={() => {
        console.log("Reset");
      }}
    >
      <div
        className={`w-screen h-screen flex overflow-hidden justify-center items-start ${
          isHidden ? "hidden pointer-events-none" : ""
        }`}
      >
        <Card className="w-full flex flex-row items-center gap-2 p-2">
          <SystemAudio {...systemAudio} meetingActive={meeting.isMeetingActive} />
          {systemAudio?.capturing ? (
            <div className="flex flex-row items-center gap-2 justify-between w-full">
              <div className="flex flex-1 items-center gap-2">
                <AudioVisualizer isRecording={systemAudio?.capturing} />
              </div>
              <div className="flex !w-fit items-center gap-2">
                <StatusIndicator
                  setupRequired={systemAudio.setupRequired}
                  error={systemAudio.error}
                  isProcessing={systemAudio.isProcessing}
                  isAIProcessing={systemAudio.isAIProcessing}
                  capturing={systemAudio.capturing}
                />
              </div>
            </div>
          ) : null}

          <div
            className={`${
              systemAudio?.capturing
                ? "hidden w-full fade-out transition-all duration-300"
                : "w-full flex flex-row gap-2 items-center"
            }`}
          >
            <Completion isHidden={isHidden} meetingActive={meeting.isMeetingActive} />

            {/* Meeting panel toggle (open/close — independent of recording) */}
            <Popover open={panelOpen} onOpenChange={() => {}}>
              <PopoverTrigger asChild>
                <Button
                  size={"icon"}
                  className={cn(
                    "cursor-pointer",
                    meeting.isMeetingActive &&
                      "bg-red-50 hover:bg-red-100 dark:bg-red-950/40"
                  )}
                  title={
                    meeting.isMeetingActive
                      ? "Meeting recording — open/close the panel"
                      : "Meeting transcript & past meetings"
                  }
                  onClick={() => setPanelOpen((o) => !o)}
                >
                  <NotebookPenIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                className="w-screen p-0 border shadow-lg overflow-hidden"
                sideOffset={8}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
              >
                <MeetingPanel
                  meeting={meeting}
                  onClose={() => setPanelOpen(false)}
                  startDisabled={systemAudio?.capturing}
                />
              </PopoverContent>
            </Popover>

            <Button
              size={"icon"}
              className="cursor-pointer"
              title="Open Dev Space"
              onClick={openDashboard}
            >
              <SparklesIcon className="h-4 w-4" />
            </Button>
          </div>

          <Updater />
          <DragButton />
        </Card>

        {/* Microphone capture for the meeting ("You") — headless, only while
            active and not muted (mute unmounts it, releasing the mic) */}
        {meeting.isMeetingActive && !meeting.micMuted && (
          <MeetingMicVad
            micDeviceId={meeting.micDeviceId}
            onUtterance={meeting.handleMicUtterance}
          />
        )}

        {customizable.cursor.type === "invisible" && platform !== "linux" ? (
          <CustomCursor />
        ) : null}
      </div>
    </ErrorBoundary>
  );
};

export default App;

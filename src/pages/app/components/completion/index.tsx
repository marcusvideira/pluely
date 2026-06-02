import { useCompletion } from "@/hooks";
import { Screenshot } from "./Screenshot";
import { Files } from "./Files";
import { Audio } from "./Audio";
import { Input } from "./Input";

export const Completion = ({
  isHidden,
  meetingActive = false,
}: {
  isHidden: boolean;
  meetingActive?: boolean;
}) => {
  const completion = useCompletion();

  return (
    <>
      <Audio {...completion} meetingActive={meetingActive} />
      <Input {...completion} isHidden={isHidden} />
      <Screenshot {...completion} />
      <Files {...completion} />
    </>
  );
};

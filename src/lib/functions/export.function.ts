import { Meeting } from "@/types";

/**
 * Render a meeting (title, summary, labeled transcript) as a Markdown string.
 */
export function meetingToMarkdown(meeting: Meeting): string {
  let md = `# ${meeting.title}\n\n`;
  md += `**Created:** ${new Date(meeting.createdAt).toLocaleString()}\n`;
  md += `**Updated:** ${new Date(meeting.updatedAt).toLocaleString()}\n\n`;

  if (meeting.summary) {
    md += `## Summary\n\n${meeting.summary}\n\n`;
  }

  md += `## Transcript\n\n`;
  const sorted = [...meeting.segments].sort(
    (a, b) => a.timestamp - b.timestamp
  );
  for (const segment of sorted) {
    const label = segment.source === "you" ? "You" : "Others";
    const time = new Date(segment.timestamp).toLocaleTimeString();
    md += `**${label}** _(${time})_: ${segment.text}\n\n`;
  }

  return md;
}

/**
 * Trigger a browser download of the meeting as a .md file.
 */
export function downloadMeetingMarkdown(meeting: Meeting): void {
  const markdown = meetingToMarkdown(meeting);
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const fileName =
    (meeting.title.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 32) ||
      "meeting") + ".md";

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

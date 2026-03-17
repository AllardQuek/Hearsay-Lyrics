import { HearsayLine } from "@/lib/gemini";

type TimedHearsayLine = HearsayLine & { endTime?: number };

export type SegmentMediaType = "image" | "video";

export type LineMediaStatusType = "covered-by-video" | "image-ready" | "image-recovering" | "image-failed";

export interface LineMediaStatus {
  status: LineMediaStatusType;
  message?: string;
  isRateLimit?: boolean;
}

export type VideoClipStatus = "queued" | "generating" | "ready" | "failed";

export interface MediaSegment {
  id: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  lineIndices: number[];
  mediaType: SegmentMediaType;
  promptText: string;
  reason: string;
}

export interface VideoClipAsset {
  segmentId: string;
  clipStart: number;
  clipEnd: number;
  status: VideoClipStatus;
  operationName?: string;
  scenePrompt?: string;
  mimeType?: string;
  videoBase64?: string;
  videoUri?: string;
  error?: string;
}

export interface SegmentVideoRequest {
  segmentId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  hearsayLines: string[];
  mood?: string;
  palette?: string[];
}

interface TimedLine {
  index: number;
  startTime: number;
  endTime: number;
}

interface BuildSegmentOptions {
  targetSeconds?: number;
  minVideoSegments?: number;
  maxVideoSegments?: number;
  defaultLineSeconds?: number;
  overrides?: Record<string, SegmentMediaType>;
  singleLineSegments?: boolean;
}

const DEFAULT_TARGET_SECONDS = 4;
const DEFAULT_LINE_SECONDS = 2.6;

function normalizeSeconds(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function getHearsayText(line: TimedHearsayLine): string {
  return line.candidates?.[0]?.text || "";
}

function buildTimedLines(lines: TimedHearsayLine[], defaultLineSeconds: number): TimedLine[] {
  if (lines.length === 0) return [];

  return lines.map((line, index) => {
    const fallbackStart = index * defaultLineSeconds;
    const start =
      typeof line.startTime === "number" && Number.isFinite(line.startTime)
        ? normalizeSeconds(line.startTime)
        : fallbackStart;

    const next = lines[index + 1];
    const nextStart =
      next && typeof next.startTime === "number" && Number.isFinite(next.startTime)
        ? normalizeSeconds(next.startTime)
        : undefined;

    const explicitEnd =
      typeof line.endTime === "number" && Number.isFinite(line.endTime)
        ? normalizeSeconds(line.endTime)
        : undefined;

    let end = explicitEnd ?? nextStart ?? start + defaultLineSeconds;
    if (end <= start + 0.2) {
      end = start + defaultLineSeconds;
    }

    return {
      index,
      startTime: start,
      endTime: end,
    };
  });
}

function buildInitialSegments(timedLines: TimedLine[], lines: TimedHearsayLine[], targetSeconds: number): MediaSegment[] {
  if (timedLines.length === 0) return [];

  const segments: MediaSegment[] = [];
  let segmentStartIdx = 0;

  for (let i = 0; i < timedLines.length; i++) {
    const start = timedLines[segmentStartIdx].startTime;
    const end = timedLines[i].endTime;
    const duration = end - start;
    const isLast = i === timedLines.length - 1;

    if (duration >= targetSeconds || isLast) {
      const group = timedLines.slice(segmentStartIdx, i + 1);
      const lineIndices = group.map((item) => item.index);
      const segmentStart = group[0].startTime;
      const segmentEnd = group[group.length - 1].endTime;
      const promptLines = lineIndices
        .map((lineIndex) => getHearsayText(lines[lineIndex]))
        .filter(Boolean);

      segments.push({
        id: `seg-${segments.length + 1}`,
        startTime: segmentStart,
        endTime: segmentEnd,
        durationSeconds: Math.max(0.5, segmentEnd - segmentStart),
        lineIndices,
        mediaType: "image",
        promptText: promptLines.join(" / "),
        reason: "default-image",
      });

      segmentStartIdx = i + 1;
    }
  }

  return segments;
}

function buildSingleLineSegments(timedLines: TimedLine[], lines: TimedHearsayLine[]): MediaSegment[] {
  if (timedLines.length === 0) return [];

  return timedLines.map((timedLine, index) => {
    const promptText = getHearsayText(lines[timedLine.index]);
    const durationSeconds = Math.max(0.5, timedLine.endTime - timedLine.startTime);

    return {
      id: `seg-${index + 1}`,
      startTime: timedLine.startTime,
      endTime: timedLine.endTime,
      durationSeconds,
      lineIndices: [timedLine.index],
      mediaType: "image",
      promptText,
      reason: "default-image",
    };
  });
}

function scoreSegmentForVideo(segment: MediaSegment, lines: TimedHearsayLine[]): number {
  const textScore = segment.lineIndices.reduce((sum, idx) => sum + getHearsayText(lines[idx]).length, 0);
  const durationWeight = 1 - Math.abs(segment.durationSeconds - DEFAULT_TARGET_SECONDS) / DEFAULT_TARGET_SECONDS;
  return textScore + Math.max(0, durationWeight) * 20;
}

export function buildMediaSegments(lines: TimedHearsayLine[], options: BuildSegmentOptions = {}): MediaSegment[] {
  if (lines.length === 0) return [];

  const targetSeconds = Math.max(2, options.targetSeconds ?? DEFAULT_TARGET_SECONDS);
  const minVideoSegments = Math.max(0, options.minVideoSegments ?? 1);
  const maxVideoSegments = Math.max(minVideoSegments, options.maxVideoSegments ?? 3);
  const defaultLineSeconds = options.defaultLineSeconds ?? DEFAULT_LINE_SECONDS;
  const overrides = options.overrides ?? {};
  const singleLineSegments = options.singleLineSegments === true;

  const timedLines = buildTimedLines(lines, defaultLineSeconds);
  const segments = singleLineSegments
    ? buildSingleLineSegments(timedLines, lines)
    : buildInitialSegments(timedLines, lines, targetSeconds);
  if (segments.length === 0) return [];

  const sorted = [...segments]
    .map((segment, index) => ({
      index,
      score: scoreSegmentForVideo(segment, lines),
      duration: segment.durationSeconds,
    }))
    .filter((item) => item.duration >= 0.5 && item.duration <= 8)
    .sort((a, b) => b.score - a.score);

  const selectedVideoIndices = new Set<number>();
  for (const candidate of sorted.slice(0, maxVideoSegments)) {
    selectedVideoIndices.add(candidate.index);
  }

  if (selectedVideoIndices.size < minVideoSegments && sorted.length > 0) {
    selectedVideoIndices.add(sorted[0].index);
  }

  return segments.map((segment, index) => {
    const autoType: SegmentMediaType = selectedVideoIndices.has(index) ? "video" : "image";
    const overrideType = overrides[segment.id];
    const mediaType = overrideType ?? autoType;

    return {
      ...segment,
      mediaType,
      reason: overrideType ? "user-override" : autoType === "video" ? "heuristic-video" : "heuristic-image",
    };
  });
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function resolveActiveSegment(segments: MediaSegment[], currentTime: number): MediaSegment | undefined {
  if (segments.length === 0) return undefined;

  const now = normalizeSeconds(currentTime);
  const exact = segments.find((segment) => now >= segment.startTime && now < segment.endTime);
  if (exact) return exact;

  let fallback = segments[0];
  for (const segment of segments) {
    if (segment.startTime <= now) {
      fallback = segment;
    } else {
      break;
    }
  }

  return fallback;
}

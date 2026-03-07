import { NextResponse } from "next/server";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

const genaiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(req: Request) {
  try {
    const { operationName } = (await req.json()) as { operationName: string };

    if (!operationName) {
      return NextResponse.json({ error: "No operation name provided" }, { status: 400 });
    }

    // Reconstruct the operation object with the stored name
    const opHandle = new GenerateVideosOperation();
    opHandle.name = operationName;

    const operation = await genaiClient.operations.getVideosOperation({
      operation: opHandle,
    });

    if (!operation.done) {
      return NextResponse.json({ done: false });
    }

    if (operation.error) {
      const errMsg =
        typeof operation.error === "object" && "message" in operation.error
          ? String((operation.error as { message: unknown }).message)
          : "Video generation failed";
      return NextResponse.json({ done: true, error: errMsg });
    }

    const video = operation.response?.generatedVideos?.[0]?.video;
    if (!video) {
      return NextResponse.json({ done: true, error: "No video in response" });
    }

    if (video.videoBytes) {
      return NextResponse.json({
        done: true,
        videoBase64: video.videoBytes,
        mimeType: video.mimeType || "video/mp4",
      });
    }

    // Fallback: return the GCS URI so the client can display it if accessible
    if (video.uri) {
      return NextResponse.json({
        done: true,
        videoUri: video.uri,
        mimeType: video.mimeType || "video/mp4",
      });
    }

    return NextResponse.json({ done: true, error: "Video data unavailable" });
  } catch (error) {
    console.error("[video/status] Error polling operation:", error);
    const message = error instanceof Error ? error.message : "Status check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

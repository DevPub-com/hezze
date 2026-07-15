"use server";

import * as cheerio from "cheerio";
import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";
import { getSupabaseClient } from "@/lib/supabase";
import { ArchiveReference, CategoryType, RealityStatus, CheckInterval, TimelineItem, NotificationLog, RealizationTrajectory, SpeakerRankItem, UserRankItem } from "../model/archive.model";

if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

function cleanJsonText(rawText: string): string {
  return rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}


interface DBTimeline {
  id: string;
  recorded_at: string;
  source_venue: string;
  source_url: string;
  title: string;
  summary: string;
  reality_index: number;
  status: string;
}

interface DBLog {
  id: string;
  recorded_at: string;
  message: string;
}

interface DBArchive {
  id: string;
  reference_number: string;
  category: string;
  news_category: string;
  core_claim_quote: string;
  core_claim_context: string;
  speaker_name: string;
  speaker_position: string;
  speaker_organization: string;
  reality_index: number;
  status: string;
  check_interval: string;
  expiry_date: string;
  target_dates: string[];
  user_votes: Record<string, number>;
  created_at: string;
  timelines: DBTimeline[];
  notification_logs: DBLog[];
}

export async function fetchArchivesList(): Promise<ArchiveReference[]> {
  const { data, error } = await getSupabaseClient()
    .from("archives")
    .select(`
      *,
      timelines (*),
      notification_logs (*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`데이터 로드 실패: ${error.message}`);
  }

  const dbArchives = (data || []) as DBArchive[];

  return dbArchives.map((archive) => {
    const timelineItems: TimelineItem[] = (archive.timelines || []).map((timelineItem) => ({
      id: timelineItem.id,
      recordedAt: timelineItem.recorded_at,
      sourceVenue: timelineItem.source_venue,
      sourceUrl: timelineItem.source_url,
      title: timelineItem.title,
      summary: timelineItem.summary,
      realityIndex: timelineItem.reality_index,
      status: timelineItem.status as RealityStatus,
    }));

    const notificationLogsList: NotificationLog[] = (archive.notification_logs || []).map((notificationLogItem) => ({
      id: notificationLogItem.id,
      recordedAt: notificationLogItem.recorded_at,
      message: notificationLogItem.message,
    }));

    return {
      id: archive.id,
      referenceNumber: archive.reference_number,
      category: archive.category as CategoryType,
      newsCategory: archive.news_category,
      coreClaim: {
        quote: archive.core_claim_quote,
        contextDescription: archive.core_claim_context,
      },
      speaker: {
        id: "speaker-" + archive.id,
        name: archive.speaker_name,
        position: archive.speaker_position,
        organization: archive.speaker_organization,
        imageUrl: "",
      },
      evidence: {
        recordedAt: archive.created_at,
        sourceVenue: archive.speaker_organization,
        sourceUrl: timelineItems[0]?.sourceUrl || "",
      },
      realityMeter: {
        currentIndex: archive.reality_index,
        status: archive.status as RealityStatus,
      },
      observationStats: {
        totalObservers: 1,
        distribution: {
          [RealityStatus.REALIZING]: archive.status === "REALIZING" ? 1 : 0,
          [RealityStatus.FADING]: archive.status === "FADING" ? 1 : 0,
          [RealityStatus.DEBATING]: archive.status === "DEBATING" ? 1 : 0,
          [RealityStatus.DEFUNCT]: archive.status === "DEFUNCT" ? 1 : 0,
          [RealityStatus.REALIZED]: archive.status === "REALIZED" ? 1 : 0,
        },
      },
      checkInterval: archive.check_interval as CheckInterval,
      expiryDate: archive.expiry_date,
      targetDates: archive.target_dates || [],
      timeline: timelineItems,
      notificationLogs: notificationLogsList,
      userVotes: archive.user_votes as Record<RealityStatus, number>,
    };
  });
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
}

interface PlayerResponse {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
  videoDetails?: {
    title?: string;
    shortDescription?: string;
    author?: string;
  };
}

function extractJsonByBrace(source: string, marker: string): string | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;
  const jsonStart = source.indexOf("{", markerIndex);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = jsonStart; index < source.length; index++) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return source.substring(jsonStart, index + 1);
      }
    }
  }
  return null;
}

function parsePlayerResponse(html: string): PlayerResponse | null {
  const rawJson =
    extractJsonByBrace(html, "ytInitialPlayerResponse") ||
    extractJsonByBrace(html, "var ytInitialPlayerResponse");
  if (!rawJson) return null;
  try {
    return JSON.parse(rawJson) as PlayerResponse;
  } catch {
    return null;
  }
}

const YOUTUBE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  // EU/봇 동의 인터스티셜을 회피해 player 정보가 누락되는 것을 방지합니다.
  Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+000",
};

async function fetchYoutubeHtml(youtubeVideoId: string): Promise<string> {
  const url = `https://www.youtube.com/watch?v=${youtubeVideoId}&bpctr=9999999999&has_verified=1&hl=ko`;
  let lastError = "알 수 없는 오류";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { headers: YOUTUBE_HEADERS });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const html = await response.text();
      if (html.includes("ytInitialPlayerResponse")) {
        return html;
      }
      lastError = "플레이어 정보를 찾을 수 없음(봇 차단/동의 페이지 가능성).";
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : "요청 실패";
    }
  }
  throw new Error(`유튜브 페이지를 가져올 수 없습니다. (${lastError})`);
}

async function fetchCaptionText(baseUrl: string): Promise<string> {
  const jsonUrl = baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=json3`;
  try {
    const jsonResponse = await fetch(jsonUrl, { headers: YOUTUBE_HEADERS });
    if (jsonResponse.ok) {
      const data = (await jsonResponse.json()) as { events?: { segs?: { utf8?: string }[] }[] };
      const text = (data.events || [])
        .flatMap((event) => event.segs || [])
        .map((seg) => seg.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (text) return text;
    }
  } catch {
  }

  try {
    const xmlResponse = await fetch(baseUrl, { headers: YOUTUBE_HEADERS });
    if (!xmlResponse.ok) return "";
    const xml = await xmlResponse.text();
    const xmlCheerio = cheerio.load(xml, { xmlMode: true });
    return xmlCheerio("text")
      .map((_, element) => xmlCheerio(element).text())
      .get()
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

async function fetchYoutubeTranscript(youtubeVideoId: string): Promise<{ title: string; textContent: string }> {
  const html = await fetchYoutubeHtml(youtubeVideoId);
  const $ = cheerio.load(html);
  const playerResponse = parsePlayerResponse(html);

  let title = $("title").text().replace(" - YouTube", "").trim();
  if (!title && playerResponse?.videoDetails?.title) {
    title = playerResponse.videoDetails.title;
  }

  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) {
    const description = playerResponse?.videoDetails?.shortDescription || "";
    const author = playerResponse?.videoDetails?.author || "";
    const fallbackText = `${title}\n${author}\n${description}`.trim();
    if (!fallbackText) {
      throw new Error("자막 정보가 존재하지 않는 동영상입니다.");
    }
    return { title, textContent: fallbackText };
  }

  const selectedTrack =
    captionTracks.find((track) => track.languageCode.startsWith("ko")) ||
    captionTracks.find((track) => track.languageCode.startsWith("en")) ||
    captionTracks[0];

  const textContent = await fetchCaptionText(selectedTrack.baseUrl);

  if (!textContent) {
    const description = playerResponse?.videoDetails?.shortDescription || "";
    const author = playerResponse?.videoDetails?.author || "";
    const fallbackText = `${title}\n${author}\n${description}`.trim();
    if (!fallbackText) {
      throw new Error("자막 텍스트가 비어 있습니다.");
    }
    return { title, textContent: fallbackText };
  }

  return { title, textContent };
}

export async function analyzeNewsUrl(
  url: string,
  checkInterval: CheckInterval = CheckInterval.WEEKLY,
  expiryDate: string = "",
  targetDates: string[] = []
): Promise<ArchiveReference> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const openai = new OpenAI({ apiKey });

  try {
    const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
    let textContent = "";
    let title = "";
    let sourceVenue = "알 수 없음";

    if (isYoutube) {
      const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
      const youtubeVideoId = videoIdMatch ? videoIdMatch[1] : null;
      if (!youtubeVideoId) {
        throw new Error("유효한 유튜브 동영상 식별자를 찾을 수 없습니다.");
      }
      const transcriptData = await fetchYoutubeTranscript(youtubeVideoId);
      title = transcriptData.title;
      textContent = transcriptData.textContent;
      sourceVenue = "YouTube";
    } else {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`URL 가져오기 실패: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      $("script, style, nav, footer, header, aside, form").remove();

      textContent = $("p, h1, h2, h3")
        .map((_, element) => $(element).text())
        .get()
        .join("\n")
        .replace(/\s+/g, " ")
        .substring(0, 12000);

      if (textContent.trim().length < 50) {
        textContent = $("body").text().replace(/\s+/g, " ").substring(0, 12000);
      }

      title = $("title").text() || "제목 없음";
      try {
        sourceVenue = new URL(url).hostname.replace("www.", "");
      } catch {
      }
    }

    const prompt = ` 
아래 뉴스 기사 본문을 읽고 분석하여 객관적인 사실을 요약하고, 관련 화자 정보 및 카테고리를 분류하십시오.
뉴스의 객관성을 검증하고 신뢰할 수 있는 정보를 추출하는 것이 목적입니다.

기사 제목: ${title}
기사 본문:
${textContent}

규칙:
1. 언어: 반드시 한국어로 작성할 것.
2. title: 기사 내용을 함축하는 사실적 제목.
3. summary: 기사 내용의 객관적 핵심 사실 요약 (3문장 이내).
4. newsCategory: 기사 내용에 해당하는 카테고리를 반드시 "금융/경제", "IT/기술", "산업/기업", "정책/규제", "사회/여론", "기타" 중 하나로 선택하여 작성할 것.
5. speakerName: 기사 본문 속 발언을 주도했거나 핵심이 되는 인물의 이름. 특정 인물이 언급되지 않았다면 "기사 제보" 혹은 "보도진" 등으로 작성할 것.
6. speakerPosition: 해당 인물의 직책. 예: 대표, 부사장, 팀장, 대변인 등. 없으면 "기자" 또는 "분석관".
7. speakerOrganization: 해당 인물이 소속된 회사 또는 기관명. 예: 삼성전자, 네이버, 기획재정부 등. 없으면 기사의 언론사 이름(예: ${sourceVenue})을 작성할 것.
8. scoreSourceReliability: 출처 및 인물 신뢰도 지수 (0~30 사이의 정수). 아래 산식을 엄격히 적용할 것:
   - 30점: 정부 부처의 공식 발표, 공인 대기업의 공식 보도자료, 실명 대변인 공식 발표
   - 20점: 일반 언론사 기자 보도, 익명의 업계 관계자 발언
   - 10점: 블로그, 커뮤니티, 출처 불분명한 인물의 주장
9. scoreFeasibility: 구체성 및 실현 가능성 지수 (0~40 사이의 정수). 아래 산식을 엄격히 적용할 것:
   - 40점: 구체적인 실행 예산 계획, 기한, 달성 목표 수치가 모두 본문에 명시됨
   - 25점: 명확한 실행 방향성은 명시되어 있으나 구체적 수치나 세부 예산안이 누락됨
   - 10점: 실현 계획이나 구체적 방법이 없는 선언적 희망 사항에 불과함
10. scoreEvidence: 객관적 근거 신뢰도 지수 (0~30 사이의 정수). 아래 산식을 엄격히 적용할 것:
    - 30점: 공인 통계 자료, 학술적 연구 결과, 상호 합의된 공식 계약서 등 명확한 증거가 본문에 포함됨
    - 15점: 정황상의 간접 증거만 제시됨
    - 0점: 증거 제시 없이 단순 주장 혹은 감정적 호소만 존재함
11. status: 기사 내용을 종합하여 현재 뉴스의 상태를 "REALIZING" (실현 중), "FADING" (흐려지는 중), "DEBATING" (논쟁 중), "DEFUNCT" (소멸함), "REALIZED" (실현 완료) 중 하나로 판별할 것.
`;

    let parsedData: {
      title: string;
      summary: string;
      newsCategory: string;
      speakerName: string;
      speakerPosition: string;
      speakerOrganization: string;
      scoreSourceReliability: number;
      scoreFeasibility: number;
      scoreEvidence: number;
      status: string;
    };

    if (isYoutube) {
      const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
      }
      const googleGenAIClient = new GoogleGenAI({ apiKey: geminiApiKey });
      const geminiResponse = await googleGenAIClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              newsCategory: {
                type: Type.STRING,
                enum: ["금융/경제", "IT/기술", "산업/기업", "정책/규제", "사회/여론", "기타"],
              },
              speakerName: { type: Type.STRING },
              speakerPosition: { type: Type.STRING },
              speakerOrganization: { type: Type.STRING },
              scoreSourceReliability: { type: Type.INTEGER },
              scoreFeasibility: { type: Type.INTEGER },
              scoreEvidence: { type: Type.INTEGER },
              status: {
                type: Type.STRING,
                enum: ["REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED"],
              },
            },
            required: [
              "title",
              "summary",
              "newsCategory",
              "speakerName",
              "speakerPosition",
              "speakerOrganization",
              "scoreSourceReliability",
              "scoreFeasibility",
              "scoreEvidence",
              "status",
            ],
          },
        },
      });

      const responseText = geminiResponse.text;
      if (!responseText) {
        throw new Error("Gemini AI로부터 응답을 받지 못했습니다.");
      }
      parsedData = JSON.parse(cleanJsonText(responseText));
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI that summarizes news articles objectively. You must output strictly valid JSON conforming to the schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "article_summary",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                newsCategory: { type: "string", enum: ["금융/경제", "IT/기술", "산업/기업", "정책/규제", "사회/여론", "기타"] },
                speakerName: { type: "string" },
                speakerPosition: { type: "string" },
                speakerOrganization: { type: "string" },
                scoreSourceReliability: { type: "integer" },
                scoreFeasibility: { type: "integer" },
                scoreEvidence: { type: "integer" },
                status: { type: "string", enum: ["REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED"] }
              },
              required: [
                "title",
                "summary",
                "newsCategory",
                "speakerName",
                "speakerPosition",
                "speakerOrganization",
                "scoreSourceReliability",
                "scoreFeasibility",
                "scoreEvidence",
                "status"
              ],
              additionalProperties: false
            }
          }
        }
      });

      const resultText = completion.choices[0].message.content;
      if (!resultText) throw new Error("AI로부터 응답을 받지 못했습니다.");
      parsedData = JSON.parse(cleanJsonText(resultText));
    }
    const realityIndex = parsedData.scoreSourceReliability + parsedData.scoreFeasibility + parsedData.scoreEvidence;
    const referenceNumber = "SIG-" + Math.floor(Math.random() * 10000);
    const defaultExpiryDate = expiryDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: archiveData, error: archiveError } = await getSupabaseClient()
      .from("archives")
      .insert({
        reference_number: referenceNumber,
        category: CategoryType.ENTRY_QUOTE,
        news_category: parsedData.newsCategory,
        core_claim_quote: parsedData.title,
        core_claim_context: parsedData.summary,
        speaker_name: parsedData.speakerName,
        speaker_position: parsedData.speakerPosition,
        speaker_organization: parsedData.speakerOrganization,
        reality_index: realityIndex,
        status: parsedData.status,
        check_interval: checkInterval,
        expiry_date: defaultExpiryDate,
        target_dates: targetDates,
        user_votes: {
          [RealityStatus.REALIZING]: 0,
          [RealityStatus.FADING]: 0,
          [RealityStatus.DEBATING]: 0,
          [RealityStatus.DEFUNCT]: 0,
          [RealityStatus.REALIZED]: 0,
        }
      })
      .select()
      .single();

    if (archiveError || !archiveData) {
      throw new Error(`DB 저장 실패: ${archiveError?.message || "알 수 없는 오류"}`);
    }

    const { error: timelineError } = await getSupabaseClient()
      .from("timelines")
      .insert({
        archive_id: archiveData.id,
        source_venue: sourceVenue,
        source_url: url,
        title: parsedData.title,
        summary: parsedData.summary,
        reality_index: realityIndex,
        status: parsedData.status,
      });

    if (timelineError) {
      throw new Error(`타임라인 DB 저장 실패: ${timelineError.message}`);
    }

    const { error: logError } = await getSupabaseClient()
      .from("notification_logs")
      .insert({
        archive_id: archiveData.id,
        message: `🔍 첫 분석 완료! [${parsedData.newsCategory}] 소식이며, AI 팩트 지수 ${realityIndex}%로 추적을 시작해요.`,
      });

    if (logError) {
      throw new Error(`알림 로그 DB 저장 실패: ${logError.message}`);
    }

    const { data: fullArchive, error: fetchError } = await getSupabaseClient()
      .from("archives")
      .select(`
        *,
        timelines (*),
        notification_logs (*)
      `)
      .eq("id", archiveData.id)
      .single();

    if (fetchError || !fullArchive) {
      throw new Error(`DB 조회 실패: ${fetchError?.message || "알 수 없는 오류"}`);
    }

    const dbArchive = fullArchive as DBArchive;
    const dbTimelines = dbArchive.timelines || [];
    const dbLogs = dbArchive.notification_logs || [];

    const timelineItems: TimelineItem[] = dbTimelines.map((timelineItem) => ({
      id: timelineItem.id,
      recordedAt: timelineItem.recorded_at,
      sourceVenue: timelineItem.source_venue,
      sourceUrl: timelineItem.source_url,
      title: timelineItem.title,
      summary: timelineItem.summary,
      realityIndex: timelineItem.reality_index,
      status: timelineItem.status as RealityStatus,
    }));

    const notificationLogsList: NotificationLog[] = dbLogs.map((notificationLogItem) => ({
      id: notificationLogItem.id,
      recordedAt: notificationLogItem.recorded_at,
      message: notificationLogItem.message,
    }));

    return {
      id: dbArchive.id,
      referenceNumber: dbArchive.reference_number,
      category: dbArchive.category as CategoryType,
      newsCategory: dbArchive.news_category,
      coreClaim: {
        quote: dbArchive.core_claim_quote,
        contextDescription: dbArchive.core_claim_context,
      },
      speaker: {
        id: "speaker-" + dbArchive.id,
        name: dbArchive.speaker_name,
        position: dbArchive.speaker_position,
        organization: dbArchive.speaker_organization,
        imageUrl: "",
      },
      evidence: {
        recordedAt: dbArchive.created_at,
        sourceVenue,
        sourceUrl: url,
      },
      realityMeter: {
        currentIndex: dbArchive.reality_index,
        status: dbArchive.status as RealityStatus,
      },
      observationStats: {
        totalObservers: 1,
        distribution: {
          [RealityStatus.REALIZING]: dbArchive.status === "REALIZING" ? 1 : 0,
          [RealityStatus.FADING]: dbArchive.status === "FADING" ? 1 : 0,
          [RealityStatus.DEBATING]: dbArchive.status === "DEBATING" ? 1 : 0,
          [RealityStatus.DEFUNCT]: dbArchive.status === "DEFUNCT" ? 1 : 0,
          [RealityStatus.REALIZED]: dbArchive.status === "REALIZED" ? 1 : 0,
        },
      },
      checkInterval: dbArchive.check_interval as CheckInterval,
      expiryDate: dbArchive.expiry_date,
      targetDates: dbArchive.target_dates || [],
      timeline: timelineItems,
      notificationLogs: notificationLogsList,
      userVotes: dbArchive.user_votes as Record<RealityStatus, number>,
    };
  } catch (error: unknown) {
    console.error("뉴스 분석 실패:", error);
    throw new Error(error instanceof Error ? error.message : "뉴스 분석에 실패했습니다.");
  }
}

export async function createDirectArchive(
  statement: string,
  context: string = "",
  checkInterval: CheckInterval = CheckInterval.WEEKLY,
  expiryDate: string = "",
  targetDates: string[] = [],
  authorName: string = "나"
): Promise<ArchiveReference> {
  const trimmedStatement = statement.trim();
  if (!trimmedStatement) {
    throw new Error("작성한 생각을 입력해 주십시오.");
  }

  const contextDescription = context.trim() || "직접 작성한 HETJE입니다.";
  const referenceNumber = "HTJ-" + Math.floor(Math.random() * 10000);
  const defaultExpiryDate = expiryDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const realityIndex = 50;
  const status = RealityStatus.DEBATING;

  const { data: archiveData, error: archiveError } = await getSupabaseClient()
    .from("archives")
    .insert({
      reference_number: referenceNumber,
      category: CategoryType.ENTRY_QUOTE,
      news_category: "직접 작성",
      core_claim_quote: trimmedStatement,
      core_claim_context: contextDescription,
      speaker_name: authorName,
      speaker_position: "작성자",
      speaker_organization: "My HETJE",
      reality_index: realityIndex,
      status,
      check_interval: checkInterval,
      expiry_date: defaultExpiryDate,
      target_dates: targetDates,
      user_votes: {
        [RealityStatus.REALIZING]: 0,
        [RealityStatus.FADING]: 0,
        [RealityStatus.DEBATING]: 0,
        [RealityStatus.DEFUNCT]: 0,
        [RealityStatus.REALIZED]: 0,
      },
    })
    .select()
    .single();

  if (archiveError || !archiveData) {
    throw new Error(`DB 저장 실패: ${archiveError?.message || "알 수 없는 오류"}`);
  }

  const { error: timelineError } = await getSupabaseClient()
    .from("timelines")
    .insert({
      archive_id: archiveData.id,
      source_venue: "직접 작성",
      source_url: "",
      title: trimmedStatement,
      summary: contextDescription,
      reality_index: realityIndex,
      status,
    });

  if (timelineError) {
    throw new Error(`타임라인 DB 저장 실패: ${timelineError.message}`);
  }

  const { error: logError } = await getSupabaseClient()
    .from("notification_logs")
    .insert({
      archive_id: archiveData.id,
      message: "✍️ 직접 작성한 HETJE를 등록했어요. 이제 현실이 어떻게 흘러가는지 추적할 수 있어요.",
    });

  if (logError) {
    throw new Error(`알림 로그 DB 저장 실패: ${logError.message}`);
  }

  const { data: fullArchive, error: fetchError } = await getSupabaseClient()
    .from("archives")
    .select(`
      *,
      timelines (*),
      notification_logs (*)
    `)
    .eq("id", archiveData.id)
    .single();

  if (fetchError || !fullArchive) {
    throw new Error(`DB 조회 실패: ${fetchError?.message || "알 수 없는 오류"}`);
  }

  const dbArchive = fullArchive as DBArchive;

  const timelineItems: TimelineItem[] = (dbArchive.timelines || []).map((timelineItem) => ({
    id: timelineItem.id,
    recordedAt: timelineItem.recorded_at,
    sourceVenue: timelineItem.source_venue,
    sourceUrl: timelineItem.source_url,
    title: timelineItem.title,
    summary: timelineItem.summary,
    realityIndex: timelineItem.reality_index,
    status: timelineItem.status as RealityStatus,
  }));

  const notificationLogsList: NotificationLog[] = (dbArchive.notification_logs || []).map((notificationLogItem) => ({
    id: notificationLogItem.id,
    recordedAt: notificationLogItem.recorded_at,
    message: notificationLogItem.message,
  }));

  return {
    id: dbArchive.id,
    referenceNumber: dbArchive.reference_number,
    category: dbArchive.category as CategoryType,
    newsCategory: dbArchive.news_category,
    coreClaim: {
      quote: dbArchive.core_claim_quote,
      contextDescription: dbArchive.core_claim_context,
    },
    speaker: {
      id: "speaker-" + dbArchive.id,
      name: dbArchive.speaker_name,
      position: dbArchive.speaker_position,
      organization: dbArchive.speaker_organization,
      imageUrl: "",
    },
    evidence: {
      recordedAt: dbArchive.created_at,
      sourceVenue: "직접 작성",
      sourceUrl: "",
    },
    realityMeter: {
      currentIndex: dbArchive.reality_index,
      status: dbArchive.status as RealityStatus,
    },
    observationStats: {
      totalObservers: 1,
      distribution: {
        [RealityStatus.REALIZING]: 0,
        [RealityStatus.FADING]: 0,
        [RealityStatus.DEBATING]: dbArchive.status === "DEBATING" ? 1 : 0,
        [RealityStatus.DEFUNCT]: 0,
        [RealityStatus.REALIZED]: 0,
      },
    },
    checkInterval: dbArchive.check_interval as CheckInterval,
    expiryDate: dbArchive.expiry_date,
    targetDates: dbArchive.target_dates || [],
    timeline: timelineItems,
    notificationLogs: notificationLogsList,
    userVotes: dbArchive.user_votes as Record<RealityStatus, number>,
  };
}

export async function analyzeTimelineUpdate(
  originalArchive: ArchiveReference,
  newArticleUrl: string
): Promise<{ timelineItem: TimelineItem; updatedRealityIndex: number; updatedStatus: RealityStatus }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const openai = new OpenAI({ apiKey });

  try {
    const isYoutube = newArticleUrl.includes("youtube.com") || newArticleUrl.includes("youtu.be");
    let textContent = "";
    let title = "";
    let sourceVenue = "알 수 없음";

    if (isYoutube) {
      const videoIdMatch = newArticleUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
      const youtubeVideoId = videoIdMatch ? videoIdMatch[1] : null;
      if (!youtubeVideoId) {
        throw new Error("유효한 유튜브 동영상 식별자를 찾을 수 없습니다.");
      }
      const transcriptData = await fetchYoutubeTranscript(youtubeVideoId);
      title = transcriptData.title;
      textContent = transcriptData.textContent;
      sourceVenue = "YouTube";
    } else {
      const response = await fetch(newArticleUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`URL 가져오기 실패: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      $("script, style, nav, footer, header, aside, form").remove();

      textContent = $("p, h1, h2, h3")
        .map((_, element) => $(element).text())
        .get()
        .join("\n")
        .replace(/\s+/g, " ")
        .substring(0, 12000);

      if (textContent.trim().length < 50) {
        textContent = $("body").text().replace(/\s+/g, " ").substring(0, 12000);
      }

      title = $("title").text() || "제목 없음";
      try {
        sourceVenue = new URL(newArticleUrl).hostname.replace("www.", "");
      } catch {
      }
    }

    const prompt = `
당신은 뉴스 팩트체크 및 신뢰성 분석가입니다.
최초 보도 및 발언 대비, 새로 수집된 기사가 해당 내용의 현실화 과정에서 어떤 변화를 나타내는지 분석하십시오.

최초 발언: ${originalArchive.coreClaim.quote}
최초 맥락: ${originalArchive.coreClaim.contextDescription}

새로운 기사 제목: ${title}
새로운 기사 본문:
${textContent}

규칙:
1. 언어: 반드시 한국어로 작성할 것.
2. title: 새로운 기사가 나타내는 타임라인 사건의 제목.
3. summary: 새로운 기사 내용을 요약하고, 최초 보도 및 발언 대비 어떠한 변화(진전, 후퇴, 정체, 논쟁 등)가 있었는지 분석 (3~4문장).
4. scoreSourceReliability: 이 시점 기준 출처 및 인물 신뢰도 지수 재평가 (0~30 사이의 정수).
5. scoreFeasibility: 이 시점 기준 구체성 및 실현 가능성 지수 재평가 (0~40 사이의 정수).
6. scoreEvidence: 이 시점 기준 객관적 근거 신뢰도 지수 재평가 (0~30 사이의 정수).
7. status: "REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED" 중 이 사건으로 인해 변화된 최종 상태 선택.
8. trajectory: 전개 방향성 판별. 최초 주장대로 추진 중이면 "FORWARD", 원래 목적과 달리 우회하거나 변질되었으면 "DETOUR", 당초 예상과 완전히 반대 방향으로 전개되었으면 "REVERSED" 중 하나 선택.
`;

    let parsedData: {
      title: string;
      summary: string;
      scoreSourceReliability: number;
      scoreFeasibility: number;
      scoreEvidence: number;
      status: string;
      trajectory?: string;
    };

    if (isYoutube) {
      const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
      }
      const googleGenAIClient = new GoogleGenAI({ apiKey: geminiApiKey });
      const geminiResponse = await googleGenAIClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              scoreSourceReliability: { type: Type.INTEGER },
              scoreFeasibility: { type: Type.INTEGER },
              scoreEvidence: { type: Type.INTEGER },
              status: {
                type: Type.STRING,
                enum: ["REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED"],
              },
            },
            required: ["title", "summary", "scoreSourceReliability", "scoreFeasibility", "scoreEvidence", "status"],
          },
        },
      });

      const responseText = geminiResponse.text;
      if (!responseText) {
        throw new Error("Gemini AI로부터 응답을 받지 못했습니다.");
      }
      parsedData = JSON.parse(cleanJsonText(responseText));
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI that analyzes timelines. You must output strictly valid JSON conforming to the schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "timeline_update",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                scoreSourceReliability: { type: "integer" },
                scoreFeasibility: { type: "integer" },
                scoreEvidence: { type: "integer" },
                status: { type: "string", enum: ["REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED"] }
              },
              required: ["title", "summary", "scoreSourceReliability", "scoreFeasibility", "scoreEvidence", "status"],
              additionalProperties: false
            }
          }
        }
      });

      const resultText = completion.choices[0].message.content;
      if (!resultText) throw new Error("AI로부터 응답을 받지 못했습니다.");
      parsedData = JSON.parse(cleanJsonText(resultText));
    }
    const realityIndex = parsedData.scoreSourceReliability + parsedData.scoreFeasibility + parsedData.scoreEvidence;

    const { data: timelineData, error: timelineError } = await getSupabaseClient()
      .from("timelines")
      .insert({
        archive_id: originalArchive.id,
        source_venue: sourceVenue,
        source_url: newArticleUrl,
        title: parsedData.title,
        summary: parsedData.summary,
        reality_index: realityIndex,
        status: parsedData.status,
      })
      .select()
      .single();

    if (timelineError || !timelineData) {
      throw new Error(`타임라인 DB 저장 실패: ${timelineError?.message || "알 수 없는 오류"}`);
    }

    const { error: archiveUpdateError } = await getSupabaseClient()
      .from("archives")
      .update({
        reality_index: realityIndex,
        status: parsedData.status,
      })
      .eq("id", originalArchive.id);

    if (archiveUpdateError) {
      throw new Error(`아카이브 상태 갱신 실패: ${archiveUpdateError.message}`);
    }

    const { error: logError } = await getSupabaseClient()
      .from("notification_logs")
      .insert({
        archive_id: originalArchive.id,
        message: `관련 기사 분석을 기반으로 타임라인이 갱신되었습니다. 지수: ${realityIndex}%, 상태: ${parsedData.status}`,
      });

    if (logError) {
      throw new Error(`알림 로그 DB 저장 실패: ${logError.message}`);
    }

    const timelineItem: TimelineItem = {
      id: timelineData.id,
      recordedAt: timelineData.recorded_at,
      sourceVenue: timelineData.source_venue,
      sourceUrl: timelineData.source_url,
      title: timelineData.title,
      summary: timelineData.summary,
      realityIndex: timelineData.reality_index,
      status: timelineData.status as RealityStatus,
      trajectory: (parsedData.trajectory as RealizationTrajectory) || RealizationTrajectory.FORWARD,
    };

    return {
      timelineItem,
      updatedRealityIndex: realityIndex,
      updatedStatus: parsedData.status as RealityStatus,
    };
  } catch (error: unknown) {
    console.error("타임라인 분석 실패:", error);
    throw new Error(error instanceof Error ? error.message : "타임라인 분석에 실패했습니다.");
  }
}

export async function updateVote(
  archiveId: string,
  status: RealityStatus,
  currentVotes: Record<RealityStatus, number>,
  userId: string
): Promise<Record<RealityStatus, number>> {
  const { data: existingVote, error: selectError } = await getSupabaseClient()
    .from("votes")
    .select("status")
    .eq("archive_id", archiveId)
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`기존 투표 조회 실패: ${selectError.message}`);
  }

  const updatedVotes = { ...currentVotes };

  if (!existingVote) {
    const { error: insertError } = await getSupabaseClient()
      .from("votes")
      .insert({
        archive_id: archiveId,
        user_id: userId,
        status: status,
      });

    if (insertError) {
      throw new Error(`투표 저장 실패: ${insertError.message}`);
    }

    updatedVotes[status] = (updatedVotes[status] || 0) + 1;
  } else {
    const oldStatus = existingVote.status as RealityStatus;
    if (oldStatus === status) {
      return currentVotes;
    }

    const { error: updateError } = await getSupabaseClient()
      .from("votes")
      .update({ status: status })
      .eq("archive_id", archiveId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(`투표 변경 실패: ${updateError.message}`);
    }

    updatedVotes[oldStatus] = Math.max(0, (updatedVotes[oldStatus] || 0) - 1);
    updatedVotes[status] = (updatedVotes[status] || 0) + 1;
  }

  const { error: archiveUpdateError } = await getSupabaseClient()
    .from("archives")
    .update({
      user_votes: updatedVotes,
    })
    .eq("id", archiveId);

  if (archiveUpdateError) {
    throw new Error(`아카이브 집계 갱신 실패: ${archiveUpdateError.message}`);
  }

  return updatedVotes;
}

export async function fetchUserVote(
  archiveId: string,
  userId: string
): Promise<RealityStatus | null> {
  const { data, error } = await getSupabaseClient()
    .from("votes")
    .select("status")
    .eq("archive_id", archiveId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data ? (data.status as RealityStatus) : null;
}

export async function purgeAllArchives(): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("archives")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    throw new Error(`DB 초기화 실패: ${error.message}`);
  }
}

export async function runPeriodicCheckForArchive(
  archiveId: string
): Promise<ArchiveReference> {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  const { data: archiveData, error: archiveError } = await getSupabaseClient()
    .from("archives")
    .select(`
      *,
      timelines (*),
      notification_logs (*)
    `)
    .eq("id", archiveId)
    .single();

  if (archiveError || !archiveData) {
    throw new Error(`아카이브 조회 실패: ${archiveError?.message || "알 수 없는 오류"}`);
  }

  const dbArchive = archiveData as DBArchive;
  const quote = dbArchive.core_claim_quote;
  const speaker = dbArchive.speaker_name;
  const currentRealityIndex = dbArchive.reality_index;
  const currentStatus = dbArchive.status;

  const googleGenAIClient = new GoogleGenAI({ apiKey: geminiApiKey });
  const prompt = `주장: "${quote}" (화자: ${speaker})
현재 현실화 지수: ${currentRealityIndex}%, 현재 상태: ${currentStatus}
현재 시간: ${new Date().toISOString()}

위 주장의 진행 상황이나 현실화 여부에 대한 최근 뉴스 및 정보를 구글 검색을 통해 확인하십시오.
검색 결과 새로운 의미 있는 진전, 논쟁, 후퇴 등의 사실 변화나 기사가 발견되었다면, 이를 바탕으로 상태와 지수를 재평가하여 순수 JSON 형태로 반환하십시오.
최근 새로운 정보가 없거나 변동 사항이 없다면 {"hasUpdate": false}를 반환하십시오.

반드시 한국어로 작성하십시오.

JSON 반환 형식 (업데이트가 있는 경우):
{
  "hasUpdate": true,
  "title": "뉴스 제목",
  "summary": "핵심 요약",
  "sourceUrl": "뉴스 URL",
  "sourceVenue": "언론사",
  "scoreSourceReliability": 20,
  "scoreFeasibility": 25,
  "scoreEvidence": 15,
  "status": "REALIZING",
  "trajectory": "FORWARD"
}

점수 산식 규칙:
1. 출처 신뢰도 지수 (0~30): 정부/대기업 공식 발표 30, 언론사 보도 20, 커뮤니티/블로그 10
2. 구체성 및 실현 가능성 지수 (0~40): 계획/수치/예산 명시 40, 방향성만 명시 25, 선언적 희망 사항 10
3. 객관적 근거 신뢰도 지수 (0~30): 공식 통계/계약서 30, 정황 증거 15, 단순 주장 0
상태(status): "REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED" 중 선택.
전개방향(trajectory): 정방향 추진 "FORWARD", 변질/우회 "DETOUR", 역행/반대전개 "REVERSED" 중 선택.`;

  const geminiResponse = await googleGenAIClient.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const responseText = geminiResponse.text;
  if (!responseText) {
    throw new Error("Gemini AI로부터 응답을 받지 못했습니다.");
  }

  interface PeriodicCheckResponse {
    hasUpdate: boolean;
    title?: string;
    summary?: string;
    sourceUrl?: string;
    sourceVenue?: string;
    scoreSourceReliability?: number;
    scoreFeasibility?: number;
    scoreEvidence?: number;
    status?: string;
    trajectory?: string;
  }

  const parsedData = JSON.parse(cleanJsonText(responseText)) as PeriodicCheckResponse;

  if (parsedData.hasUpdate && parsedData.title && parsedData.summary && parsedData.status) {
    const scoreSourceReliability = parsedData.scoreSourceReliability ?? 0;
    const scoreFeasibility = parsedData.scoreFeasibility ?? 0;
    const scoreEvidence = parsedData.scoreEvidence ?? 0;
    const updatedRealityIndex = scoreSourceReliability + scoreFeasibility + scoreEvidence;
    const updatedStatus = parsedData.status;

    const { error: timelineError } = await getSupabaseClient()
      .from("timelines")
      .insert({
        archive_id: archiveId,
        source_venue: parsedData.sourceVenue || "Google Search",
        source_url: parsedData.sourceUrl || "",
        title: parsedData.title,
        summary: parsedData.summary,
        reality_index: updatedRealityIndex,
        status: updatedStatus,
      });

    if (timelineError) {
      throw new Error(`타임라인 DB 저장 실패: ${timelineError.message}`);
    }

    const { error: archiveUpdateError } = await getSupabaseClient()
      .from("archives")
      .update({
        reality_index: updatedRealityIndex,
        status: updatedStatus,
      })
      .eq("id", archiveId);

    if (archiveUpdateError) {
      throw new Error(`아카이브 상태 갱신 실패: ${archiveUpdateError.message}`);
    }

    const { error: logError } = await getSupabaseClient()
      .from("notification_logs")
      .insert({
        archive_id: archiveId,
        message: `🤖 AI 탐정이 새로운 관련 뉴스를 찾아서 분석했어요! (팩트 지수: ${updatedRealityIndex}%)`,
      });

    if (logError) {
      throw new Error(`알림 로그 DB 저장 실패: ${logError.message}`);
    }
  } else {
    const { error: logError } = await getSupabaseClient()
      .from("notification_logs")
      .insert({
        archive_id: archiveId,
        message: "😴 AI 탐정이 최신 소식을 검색해봤는데, 아직 새로 바뀐 내용은 없어요.",
      });

    if (logError) {
      throw new Error(`알림 로그 DB 저장 실패: ${logError.message}`);
    }
  }

  const { data: updatedFullArchive, error: fetchError } = await getSupabaseClient()
    .from("archives")
    .select(`
      *,
      timelines (*),
      notification_logs (*)
    `)
    .eq("id", archiveId)
    .single();

  if (fetchError || !updatedFullArchive) {
    throw new Error(`DB 조회 실패: ${fetchError?.message || "알 수 없는 오류"}`);
  }

  const updatedDbArchive = updatedFullArchive as DBArchive;
  const dbTimelines = updatedDbArchive.timelines || [];
  const dbLogs = updatedDbArchive.notification_logs || [];

  const timelineItems: TimelineItem[] = dbTimelines.map((timeline) => ({
    id: timeline.id,
    recordedAt: timeline.recorded_at,
    sourceVenue: timeline.source_venue,
    sourceUrl: timeline.source_url,
    title: timeline.title,
    summary: timeline.summary,
    realityIndex: timeline.reality_index,
    status: timeline.status as RealityStatus,
  }));

  const notificationLogsList: NotificationLog[] = dbLogs.map((log) => ({
    id: log.id,
    recordedAt: log.recorded_at,
    message: log.message,
  }));

  return {
    id: updatedDbArchive.id,
    referenceNumber: updatedDbArchive.reference_number,
    category: updatedDbArchive.category as CategoryType,
    newsCategory: updatedDbArchive.news_category,
    coreClaim: {
      quote: updatedDbArchive.core_claim_quote,
      contextDescription: updatedDbArchive.core_claim_context,
    },
    speaker: {
      id: "speaker-" + updatedDbArchive.id,
      name: updatedDbArchive.speaker_name,
      position: updatedDbArchive.speaker_position,
      organization: updatedDbArchive.speaker_organization,
      imageUrl: "",
    },
    evidence: {
      recordedAt: updatedDbArchive.created_at,
      sourceVenue: updatedDbArchive.speaker_organization,
      sourceUrl: timelineItems[0]?.sourceUrl || "",
    },
    realityMeter: {
      currentIndex: updatedDbArchive.reality_index,
      status: updatedDbArchive.status as RealityStatus,
    },
    observationStats: {
      totalObservers: 1,
      distribution: {
        [RealityStatus.REALIZING]: updatedDbArchive.status === "REALIZING" ? 1 : 0,
        [RealityStatus.FADING]: updatedDbArchive.status === "FADING" ? 1 : 0,
        [RealityStatus.DEBATING]: updatedDbArchive.status === "DEBATING" ? 1 : 0,
        [RealityStatus.DEFUNCT]: updatedDbArchive.status === "DEFUNCT" ? 1 : 0,
        [RealityStatus.REALIZED]: updatedDbArchive.status === "REALIZED" ? 1 : 0,
      },
    },
    checkInterval: updatedDbArchive.check_interval as CheckInterval,
    expiryDate: updatedDbArchive.expiry_date,
    targetDates: updatedDbArchive.target_dates || [],
    timeline: timelineItems,
    notificationLogs: notificationLogsList,
    userVotes: updatedDbArchive.user_votes as Record<RealityStatus, number>,
  };
}

export async function fetchSpeakerLeaderboard(): Promise<SpeakerRankItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("archives")
    .select("speaker_name, speaker_organization, speaker_position, status");

  if (error || !data) {
    return [];
  }

  interface SpeakerGroup {
    speakerName: string;
    organization: string;
    position: string;
    totalClaims: number;
    realizedClaims: number;
    realizingClaims: number;
  }

  const groupedMap = new Map<string, SpeakerGroup>();

  for (const item of data) {
    const key = `${item.speaker_name}_${item.speaker_organization}`;
    const existingGroup = groupedMap.get(key) || {
      speakerName: item.speaker_name,
      organization: item.speaker_organization,
      position: item.speaker_position,
      totalClaims: 0,
      realizedClaims: 0,
      realizingClaims: 0,
    };

    existingGroup.totalClaims += 1;
    if (item.status === RealityStatus.REALIZED) {
      existingGroup.realizedClaims += 1;
    } else if (item.status === RealityStatus.REALIZING) {
      existingGroup.realizingClaims += 1;
    }

    groupedMap.set(key, existingGroup);
  }

  const rankingList: SpeakerRankItem[] = Array.from(groupedMap.values()).map((groupItem) => {
    const weightedScore = groupItem.realizedClaims * 1.0 + groupItem.realizingClaims * 0.5;
    const battingAverage = Math.round((weightedScore / groupItem.totalClaims) * 100);
    return {
      ...groupItem,
      factBattingAverage: battingAverage,
    };
  });

  return rankingList.sort((firstItem, secondItem) => secondItem.factBattingAverage - firstItem.factBattingAverage);
}

export async function fetchUserLeaderboard(): Promise<UserRankItem[]> {
  const { data: votesData, error: votesError } = await getSupabaseClient()
    .from("votes")
    .select("user_id, status, archive_id");

  if (votesError || !votesData) {
    return [];
  }

  const { data: archivesData, error: archivesError } = await getSupabaseClient()
    .from("archives")
    .select("id, status");

  if (archivesError || !archivesData) {
    return [];
  }

  const archiveStatusMap = new Map<string, string>();
  for (const archiveItem of archivesData) {
    archiveStatusMap.set(archiveItem.id, archiveItem.status);
  }

  interface UserGroup {
    userId: string;
    totalVotes: number;
    correctVotes: number;
  }

  const userGroupMap = new Map<string, UserGroup>();

  for (const voteItem of votesData) {
    const existingUser = userGroupMap.get(voteItem.user_id) || {
      userId: voteItem.user_id,
      totalVotes: 0,
      correctVotes: 0,
    };

    existingUser.totalVotes += 1;
    const actualStatus = archiveStatusMap.get(voteItem.archive_id);
    if (actualStatus && actualStatus === voteItem.status) {
      existingUser.correctVotes += 1;
    }

    userGroupMap.set(voteItem.user_id, existingUser);
  }

  const userRankingList: UserRankItem[] = Array.from(userGroupMap.values()).map((userGroupItem) => {
    const accuracy = Math.round((userGroupItem.correctVotes / userGroupItem.totalVotes) * 100);
    let badgeTitle = "🔮 초보 예언가";
    if (userGroupItem.correctVotes >= 5 && accuracy >= 80) {
      badgeTitle = "🎯 족집게 탐정";
    } else if (userGroupItem.correctVotes >= 3) {
      badgeTitle = "👁️ 성지 관리자";
    }

    const maskedId = userGroupItem.userId.length > 8 
      ? `user_${userGroupItem.userId.substring(0, 4)}***` 
      : "익명 탐정";

    return {
      userId: userGroupItem.userId,
      userEmailMasked: maskedId,
      totalVotes: userGroupItem.totalVotes,
      correctVotes: userGroupItem.correctVotes,
      accuracyRate: accuracy,
      badgeTitle: badgeTitle,
    };
  });

  return userRankingList.sort((firstUserItem, secondUserItem) => secondUserItem.accuracyRate - firstUserItem.accuracyRate);
}

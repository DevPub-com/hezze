"use server";

import * as cheerio from "cheerio";
import OpenAI from "openai";
import { getSupabaseClient } from "@/lib/supabase";
import { ArchiveReference, CategoryType, RealityStatus, CheckInterval, TimelineItem, NotificationLog } from "../model/archive.model";

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
    const timelineItems: TimelineItem[] = (archive.timelines || []).map((t) => ({
      id: t.id,
      recordedAt: t.recorded_at,
      sourceVenue: t.source_venue,
      sourceUrl: t.source_url,
      title: t.title,
      summary: t.summary,
      realityIndex: t.reality_index,
      status: t.status as RealityStatus,
    }));

    const notificationLogsList: NotificationLog[] = (archive.notification_logs || []).map((l) => ({
      id: l.id,
      recordedAt: l.recorded_at,
      message: l.message,
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
        sourceUrl: "",
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

    let textContent = $("p, h1, h2, h3")
      .map((_, el) => $(el).text())
      .get()
      .join("\n")
      .replace(/\s+/g, " ")
      .substring(0, 12000);

    if (textContent.trim().length < 50) {
      textContent = $("body").text().replace(/\s+/g, " ").substring(0, 12000);
    }

    const title = $("title").text() || "제목 없음";
    let sourceVenue = "알 수 없음";
    try {
      sourceVenue = new URL(url).hostname.replace("www.", "");
    } catch {
    }

    const prompt = ` 
아래 뉴스 기사 본문을 읽고 분석하여 객관적인 사실을 요약하고, 관련 화자 정보 및 카테고리를 분류하십시오.
B2B SaaS 관점에서 신뢰할 수 있는 정보를 추출하는 것이 목적입니다.

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
8. realityIndex: 이 기사의 실현 가능성 혹은 사실 신뢰성 지수(0~100 사이의 정수). 신호 분석을 위한 초기값입니다.
9. status: 기사 내용을 종합하여 현재 신호의 상태를 "REALIZING" (실현 중), "FADING" (흐려지는 중), "DEBATING" (논쟁 중), "DEFUNCT" (소멸함), "REALIZED" (실현 완료) 중 하나로 판별할 것.
`;

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
              realityIndex: { type: "integer" },
              status: { type: "string", enum: ["REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED"] }
            },
            required: [
              "title",
              "summary",
              "newsCategory",
              "speakerName",
              "speakerPosition",
              "speakerOrganization",
              "realityIndex",
              "status"
            ],
            additionalProperties: false
          }
        }
      }
    });

    const resultText = completion.choices[0].message.content;
    if (!resultText) throw new Error("AI로부터 응답을 받지 못했습니다.");

    const parsedData = JSON.parse(resultText);
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
        reality_index: parsedData.realityIndex,
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
        reality_index: parsedData.realityIndex,
        status: parsedData.status,
      });

    if (timelineError) {
      throw new Error(`타임라인 DB 저장 실패: ${timelineError.message}`);
    }

    const { error: logError } = await getSupabaseClient()
      .from("notification_logs")
      .insert({
        archive_id: archiveData.id,
        message: `기사 분석 완료: 카테고리 [${parsedData.newsCategory}], 최초 현실화 지수 [${parsedData.realityIndex}%]`,
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

    const timelineItems: TimelineItem[] = dbTimelines.map((t) => ({
      id: t.id,
      recordedAt: t.recorded_at,
      sourceVenue: t.source_venue,
      sourceUrl: t.source_url,
      title: t.title,
      summary: t.summary,
      realityIndex: t.reality_index,
      status: t.status as RealityStatus,
    }));

    const notificationLogsList: NotificationLog[] = dbLogs.map((l) => ({
      id: l.id,
      recordedAt: l.recorded_at,
      message: l.message,
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

    let textContent = $("p, h1, h2, h3")
      .map((_, el) => $(el).text())
      .get()
      .join("\n")
      .replace(/\s+/g, " ")
      .substring(0, 12000);

    if (textContent.trim().length < 50) {
      textContent = $("body").text().replace(/\s+/g, " ").substring(0, 12000);
    }

    const title = $("title").text() || "제목 없음";
    let sourceVenue = "알 수 없음";
    try {
      sourceVenue = new URL(newArticleUrl).hostname.replace("www.", "");
    } catch {
    }

    const prompt = `
당신은 B2B SaaS의 시그널 분석가입니다.
최초 발언(Root Claim)과 비교하여, 새로 수집된 기사가 해당 발언/약속의 현실화 과정에서 어떤 변화를 나타내는지 분석하십시오.

최초 발언: ${originalArchive.coreClaim.quote}
최초 맥락: ${originalArchive.coreClaim.contextDescription}

새로운 기사 제목: ${title}
새로운 기사 본문:
${textContent}

규칙:
1. 언어: 반드시 한국어로 작성할 것.
2. title: 새로운 기사가 나타내는 타임라인 사건의 제목 (예: "AR 글래스 시제품 공개와 투자 지속").
3. summary: 새로운 기사 내용을 요약하고, 최초 발언 대비 어떠한 변화(진전, 후퇴, 정체, 논쟁 등)가 있었는지 B2B 관점에서 분석 (3~4문장).
4. realityIndex: 이 시점 기준 최초 발언이 실현될 가능성을 0~100 사이 숫자로 재평가.
5. status: "REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED" 중 이 사건으로 인해 변화된 최종 상태 선택.
`;

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
              realityIndex: { type: "integer" },
              status: { type: "string", enum: ["REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED"] }
            },
            required: ["title", "summary", "realityIndex", "status"],
            additionalProperties: false
          }
        }
      }
    });

    const resultText = completion.choices[0].message.content;
    if (!resultText) throw new Error("AI로부터 응답을 받지 못했습니다.");

    const parsedData = JSON.parse(resultText);

    const { data: timelineData, error: timelineError } = await getSupabaseClient()
      .from("timelines")
      .insert({
        archive_id: originalArchive.id,
        source_venue: sourceVenue,
        source_url: newArticleUrl,
        title: parsedData.title,
        summary: parsedData.summary,
        reality_index: parsedData.realityIndex,
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
        reality_index: parsedData.realityIndex,
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
        message: `관련 기사 분석을 기반으로 타임라인이 갱신되었습니다. 지수: ${parsedData.realityIndex}%, 상태: ${parsedData.status}`,
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
    };

    return {
      timelineItem,
      updatedRealityIndex: parsedData.realityIndex,
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

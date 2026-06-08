"use server";

import * as cheerio from "cheerio";
import OpenAI from "openai";
import { ArchiveReference, CategoryType, RealityStatus, CheckInterval, TimelineItem } from "../model/archive.model";

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
아래 뉴스 기사 본문을 읽고 사실 그대로를 요약하십시오.
어떠한 B2B 관점 분석이나 파급력 예측, 미래 전망도 가미하지 말고 기사의 객관적 사실만을 정밀히 요약하십시오.

기사 제목: ${title}
기사 본문:
${textContent}

규칙:
1. 언어: 반드시 한국어로 작성할 것.
2. title: 기사 내용을 함축하는 사실적 제목.
3. summary: 기사 내용의 객관적 핵심 사실 요약 (3문장 이내).
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
              summary: { type: "string" }
            },
            required: ["title", "summary"],
            additionalProperties: false
          }
        }
      }
    });

    const resultText = completion.choices[0].message.content;
    if (!resultText) throw new Error("AI로부터 응답을 받지 못했습니다.");

    const parsedData = JSON.parse(resultText);

    const archiveId = "archive-" + Date.now();
    const formattedRecordedAt = new Date().toISOString();

    const initialTimelineItem: TimelineItem = {
      id: "timeline-" + Date.now() + "-1",
      recordedAt: formattedRecordedAt,
      sourceVenue,
      sourceUrl: url,
      title: parsedData.title,
      summary: parsedData.summary,
      realityIndex: 50,
      status: RealityStatus.DEBATING,
    };

    const defaultExpiryDate = expiryDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const finalData: ArchiveReference = {
      id: archiveId,
      referenceNumber: "SIG-" + Math.floor(Math.random() * 10000),
      category: CategoryType.ENTRY_QUOTE,
      coreClaim: {
        quote: parsedData.title,
        contextDescription: parsedData.summary,
      },
      speaker: {
        id: "speaker-" + Date.now(),
        name: "미지정",
        position: "관련인",
        organization: sourceVenue,
        imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=150&auto=format&fit=crop",
      },
      evidence: {
        recordedAt: formattedRecordedAt,
        sourceVenue,
        sourceUrl: url,
      },
      realityMeter: {
        currentIndex: 50,
        status: RealityStatus.DEBATING,
      },
      observationStats: {
        totalObservers: 100,
        distribution: {
          [RealityStatus.REALIZING]: 10,
          [RealityStatus.FADING]: 10,
          [RealityStatus.DEBATING]: 60,
          [RealityStatus.DEFUNCT]: 10,
          [RealityStatus.REALIZED]: 10,
        },
      },
      checkInterval,
      expiryDate: defaultExpiryDate,
      targetDates,
      timeline: [initialTimelineItem],
      notificationLogs: [
        {
          id: "log-" + Date.now() + "-1",
          recordedAt: formattedRecordedAt,
          message: "기사 정보 스크랩 및 최초 요약 등록이 완료되었습니다.",
        }
      ],
      userVotes: {
        [RealityStatus.REALIZING]: 0,
        [RealityStatus.FADING]: 0,
        [RealityStatus.DEBATING]: 0,
        [RealityStatus.DEFUNCT]: 0,
        [RealityStatus.REALIZED]: 0,
      },
    };

    return finalData;
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

    const timelineItem: TimelineItem = {
      id: "timeline-" + Date.now(),
      recordedAt: new Date().toISOString(),
      sourceVenue,
      sourceUrl: newArticleUrl,
      title: parsedData.title,
      summary: parsedData.summary,
      realityIndex: parsedData.realityIndex,
      status: parsedData.status as RealityStatus,
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

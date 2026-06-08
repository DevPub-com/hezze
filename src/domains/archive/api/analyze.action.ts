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

    const archiveId = "archive-" + Date.now();
    const formattedRecordedAt = new Date().toISOString();

    const initialTimelineItem: TimelineItem = {
      id: "timeline-" + Date.now() + "-1",
      recordedAt: formattedRecordedAt,
      sourceVenue,
      sourceUrl: url,
      title: parsedData.title,
      summary: parsedData.summary,
      realityIndex: parsedData.realityIndex,
      status: parsedData.status as RealityStatus,
    };

    const defaultExpiryDate = expiryDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const finalData: ArchiveReference = {
      id: archiveId,
      referenceNumber: "SIG-" + Math.floor(Math.random() * 10000),
      category: CategoryType.ENTRY_QUOTE,
      newsCategory: parsedData.newsCategory,
      coreClaim: {
        quote: parsedData.title,
        contextDescription: parsedData.summary,
      },
      speaker: {
        id: "speaker-" + Date.now(),
        name: parsedData.speakerName,
        position: parsedData.speakerPosition,
        organization: parsedData.speakerOrganization,
        imageUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=150&auto=format&fit=crop",
      },
      evidence: {
        recordedAt: formattedRecordedAt,
        sourceVenue,
        sourceUrl: url,
      },
      realityMeter: {
        currentIndex: parsedData.realityIndex,
        status: parsedData.status as RealityStatus,
      },
      observationStats: {
        totalObservers: 1,
        distribution: {
          [RealityStatus.REALIZING]: parsedData.status === "REALIZING" ? 1 : 0,
          [RealityStatus.FADING]: parsedData.status === "FADING" ? 1 : 0,
          [RealityStatus.DEBATING]: parsedData.status === "DEBATING" ? 1 : 0,
          [RealityStatus.DEFUNCT]: parsedData.status === "DEFUNCT" ? 1 : 0,
          [RealityStatus.REALIZED]: parsedData.status === "REALIZED" ? 1 : 0,
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
          message: `기사 분석 완료: 카테고리 [${parsedData.newsCategory}], 최초 현실화 지수 [${parsedData.realityIndex}%]`,
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

"use server";

import * as cheerio from "cheerio";
import OpenAI from "openai";
import { ArchiveReference, CategoryType, RealityStatus } from "../model/archive.model";

export async function analyzeNewsUrl(url: string): Promise<ArchiveReference> {
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

    // 불필요한 태그 제거 (성능 최적화 및 토큰 절약)
    $("script, style, nav, footer, header, aside, form").remove();
    
    // 본문 추출 (h1~h3, p 태그)
    const textContent = $("p, h1, h2, h3")
      .map((_, el) => $(el).text())
      .get()
      .join("\n")
      .replace(/\s+/g, " ")
      .substring(0, 12000); // gpt-4o-mini 토큰 제한 고려

    const title = $("title").text() || "제목 없음";
    let sourceVenue = "알 수 없음";
    try {
      sourceVenue = new URL(url).hostname.replace("www.", "");
    } catch (e) {
      // url 파싱 에러 무시
    }

    const prompt = `
당신은 B2B SaaS의 시그널 분석가입니다.
아래 뉴스 기사를 분석하여 핵심 발언(Core Claim)이나 약속(Promise)을 추출하고,
'ArchiveReference' 데이터 구조에 맞는 JSON으로 변환하십시오.

기사 제목: ${title}
기사 본문:
${textContent}

규칙:
1. 언어: 반드시 '한국어'로 작성할 것 (JSON 값).
2. category: "ENTRY.QUOTE" 또는 "ENTRY.PROMISE" 중 택일.
3. coreClaim.quote: 기사에서 가장 핵심이 되는 직접 인용문이나 발언 (1~2문장).
4. coreClaim.contextDescription: 이 발언이 나온 배경, 정치/경제적 의미, 향후 파급력을 B2B 관점에서 냉철하게 분석 (3~4문장).
5. speaker.name, position, organization: 발언자의 이름, 직책, 소속 (없으면 기사에서 가장 비중 있는 인물).
6. speaker.imageUrl: 실제 이미지 URL이 없다면 빈 문자열("")로 둘 것.
7. realityMeter.currentIndex: 이 발언/약속이 현실화될 가능성을 0~100 사이 숫자로 예측.
8. realityMeter.status: "REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED" 중 현재 상태에 가장 적합한 것 선택.
9. observationStats: 총 관측자 수와 각 상태별 분포를 임의로(하지만 현실성 있게) 생성하여 합이 totalObservers가 되도록 할 것.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI that extracts and analyzes signals from news. You must output strictly valid JSON conforming to the schema.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "archive_reference",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["ENTRY.QUOTE", "ENTRY.PROMISE"] },
              coreClaim: {
                type: "object",
                properties: {
                  quote: { type: "string" },
                  contextDescription: { type: "string" }
                },
                required: ["quote", "contextDescription"],
                additionalProperties: false
              },
              speaker: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  position: { type: "string" },
                  organization: { type: "string" },
                  imageUrl: { type: "string" }
                },
                required: ["name", "position", "organization", "imageUrl"],
                additionalProperties: false
              },
              realityMeter: {
                type: "object",
                properties: {
                  currentIndex: { type: "integer" },
                  status: { type: "string", enum: ["REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED"] }
                },
                required: ["currentIndex", "status"],
                additionalProperties: false
              },
              observationStats: {
                type: "object",
                properties: {
                  totalObservers: { type: "integer" },
                  distribution: {
                    type: "object",
                    properties: {
                      REALIZING: { type: "integer" },
                      FADING: { type: "integer" },
                      DEBATING: { type: "integer" },
                      DEFUNCT: { type: "integer" },
                      REALIZED: { type: "integer" }
                    },
                    required: ["REALIZING", "FADING", "DEBATING", "DEFUNCT", "REALIZED"],
                    additionalProperties: false
                  }
                },
                required: ["totalObservers", "distribution"],
                additionalProperties: false
              }
            },
            required: ["category", "coreClaim", "speaker", "realityMeter", "observationStats"],
            additionalProperties: false
          }
        }
      }
    });

    const resultText = completion.choices[0].message.content;
    if (!resultText) throw new Error("AI로부터 응답을 받지 못했습니다.");

    const parsedData = JSON.parse(resultText);

    // AI가 생성하지 못한 필수 필드 조합
    const finalData: ArchiveReference = {
      ...parsedData,
      id: "archive-" + Date.now(),
      referenceNumber: "SIG-" + Math.floor(Math.random() * 10000),
      evidence: {
        recordedAt: new Date().toISOString(),
        sourceVenue,
        sourceUrl: url,
      },
    };

    // 이미지 fallback (만약 비어있다면)
    if (!finalData.speaker.imageUrl) {
      finalData.speaker.imageUrl = "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=150&auto=format&fit=crop";
    }

    return finalData as ArchiveReference;
  } catch (error) {
    console.error("뉴스 분석 실패:", error);
    throw new Error(error instanceof Error ? error.message : "뉴스 분석에 실패했습니다.");
  }
}

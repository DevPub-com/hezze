import { ArchiveReference, CategoryType, RealityStatus, CheckInterval } from '../../model/archive.model';

export const MOCK_ARCHIVE_LIST: ArchiveReference[] = [
  {
    id: 'archive-metaverse-zuckerberg',
    referenceNumber: 'SIG-9842',
    category: CategoryType.ENTRY_QUOTE,
    coreClaim: {
      quote: '메타버스가 인터넷을 대체할 것이다. 우리는 그 중심에 있다.',
      contextDescription: '2021년 페이스북이 사명을 메타로 변경하며 발표한 비전 선포 내용과 현재의 AI 중심 기술 트렌드 변화, 투자 지연 등에 대한 비판적 회의론 요약 텍스트.',
    },
    speaker: {
      id: 'speaker-zuckerberg',
      name: '마크 저커버그',
      position: 'CEO',
      organization: 'Meta',
      imageUrl: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?q=80&w=200&auto=format&fit=crop',
    },
    evidence: {
      recordedAt: '2021-10-28T00:00:00Z',
      sourceVenue: 'Meta Connect',
      sourceUrl: 'https://www.meta.com/connect/2021',
    },
    realityMeter: {
      currentIndex: 12,
      status: RealityStatus.FADING,
    },
    observationStats: {
      totalObservers: 2800,
      distribution: {
        [RealityStatus.REALIZING]: 420,
        [RealityStatus.FADING]: 1960,
        [RealityStatus.DEBATING]: 420,
        [RealityStatus.DEFUNCT]: 0,
        [RealityStatus.REALIZED]: 0,
      },
    },
    checkInterval: CheckInterval.MONTHLY,
    expiryDate: '2026-12-31',
    targetDates: ['2026-06-30', '2026-12-31'],
    timeline: [
      {
        id: 'timeline-meta-1',
        recordedAt: '2021-10-28T00:00:00Z',
        sourceVenue: 'Meta Connect 2021',
        sourceUrl: 'https://www.meta.com/connect/2021',
        title: 'Meta 사명 변경 및 메타버스 비전 발표',
        summary: '페이스북이 사명을 Meta로 전격 변경하며 가상 현실 공간인 메타버스를 차세대 핵심 비전으로 천명하고 리얼리티 랩스 투자를 확대하겠다고 선언했습니다.',
        realityIndex: 80,
        status: RealityStatus.REALIZING,
      },
      {
        id: 'timeline-meta-2',
        recordedAt: '2023-03-14T00:00:00Z',
        sourceVenue: 'TechCrunch',
        sourceUrl: 'https://techcrunch.com/2023/03/14/meta-efficiency',
        title: '효율성의 해 선언 및 메타버스 투자 축소',
        summary: '저커버그 CEO가 효율성의 해를 선언하고 대규모 구조조정과 함께 생성형 AI 분야 투자에 집중하겠다고 발표하면서 메타버스 우선순위가 뒤로 밀리게 되었습니다.',
        realityIndex: 30,
        status: RealityStatus.FADING,
      },
      {
        id: 'timeline-meta-3',
        recordedAt: '2025-10-01T00:00:00Z',
        sourceVenue: 'Bloomberg',
        sourceUrl: 'https://www.bloomberg.com/news/meta-ar-glasses',
        title: 'AR 글래스 시제품 공개와 메타버스 연계 전략 지속',
        summary: 'Orion AR 글래스 시제품을 공개하며 하드웨어 기반의 현실 접목을 시도하고 있으나 여전히 수익화와 기술 대중화에는 상당한 시일이 걸릴 것으로 평가됩니다.',
        realityIndex: 12,
        status: RealityStatus.FADING,
      }
    ],
    notificationLogs: [
      {
        id: 'log-meta-1',
        recordedAt: '2026-05-01T10:00:00Z',
        message: '월간 현실성 자동 체크가 실행되었습니다. 새로운 타임라인 항목 1건이 갱신되었습니다.',
      },
      {
        id: 'log-meta-2',
        recordedAt: '2026-06-01T10:00:00Z',
        message: '월간 현실성 자동 체크 결과, 특별한 추가 동향이 확인되지 않았습니다.',
      }
    ],
    userVotes: {
      [RealityStatus.REALIZING]: 15,
      [RealityStatus.FADING]: 120,
      [RealityStatus.DEBATING]: 35,
      [RealityStatus.DEFUNCT]: 40,
      [RealityStatus.REALIZED]: 2,
    },
  },
  {
    id: 'archive-fsd-musk',
    referenceNumber: 'SIG-2104',
    category: CategoryType.ENTRY_PROMISE,
    coreClaim: {
      quote: '올해 말까지 완전한 자율주행(FSD)을 달성할 것이며, 운전자가 잠들어도 될 수준에 이를 것입니다.',
      contextDescription: '2020년 테슬라 CEO 일론 머스크가 자율주행 기술의 성장에 대해 선언한 공약으로, 수년간 매년 말 자율주행 완료를 공언해온 역사와 기술적 난제에 대한 시장의 의구심을 요약한 텍스트.',
    },
    speaker: {
      id: 'speaker-musk',
      name: '일론 머스크',
      position: 'CEO',
      organization: 'Tesla',
      imageUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=200&auto=format&fit=crop',
    },
    evidence: {
      recordedAt: '2020-07-09T00:00:00Z',
      sourceVenue: 'WASC Conference',
      sourceUrl: 'https://www.tesla.com/blog',
    },
    realityMeter: {
      currentIndex: 45,
      status: RealityStatus.DEBATING,
    },
    observationStats: {
      totalObservers: 4500,
      distribution: {
        [RealityStatus.REALIZING]: 1125,
        [RealityStatus.FADING]: 900,
        [RealityStatus.DEBATING]: 2025,
        [RealityStatus.DEFUNCT]: 450,
        [RealityStatus.REALIZED]: 0,
      },
    },
    checkInterval: CheckInterval.WEEKLY,
    expiryDate: '2027-01-01',
    targetDates: ['2026-08-08', '2026-12-25'],
    timeline: [
      {
        id: 'timeline-fsd-1',
        recordedAt: '2020-07-09T00:00:00Z',
        sourceVenue: 'WASC 2020',
        sourceUrl: 'https://www.tesla.com/blog',
        title: '완전 자율주행 연내 달성 공언',
        summary: '일론 머스크가 가상 컨퍼런스에서 연내 레벨 5 완전 자율주행을 위한 기본 기능 구축이 완료될 것이라 확언했습니다.',
        realityIndex: 90,
        status: RealityStatus.REALIZING,
      },
      {
        id: 'timeline-fsd-2',
        recordedAt: '2022-10-31T00:00:00Z',
        sourceVenue: 'Reuters',
        sourceUrl: 'https://www.reuters.com/business/autos-transportation',
        title: 'FSD 베타 테스트 확장 및 규제 당국 조사 착수',
        summary: '북미 지역에서 10만 명 이상의 고객을 대상으로 FSD 베타를 출시했으나, 잇따른 사고 보고로 인해 미 도로교통안전국(NHTSA)의 조사가 본격화되었습니다.',
        realityIndex: 50,
        status: RealityStatus.DEBATING,
      },
      {
        id: 'timeline-fsd-3',
        recordedAt: '2026-03-15T00:00:00Z',
        sourceVenue: 'TechCrunch',
        sourceUrl: 'https://techcrunch.com/tesla-fsd-v12-ai',
        title: 'FSD V12 종단간 인공지능 제어 탑재로 성능 개선',
        summary: '규칙 기반 코드를 제거하고 인공신경망이 입출력을 완전 제어하는 V12 소프트웨어가 대대적으로 배포되면서 주행 완성도는 높아졌으나, 여전히 운전자의 상시 감독이 필요하다는 한계가 있습니다.',
        realityIndex: 45,
        status: RealityStatus.DEBATING,
      }
    ],
    notificationLogs: [
      {
        id: 'log-fsd-1',
        recordedAt: '2026-06-01T09:00:00Z',
        message: '주간 정기 AI 분석 보고서가 발행되었습니다. 현실성 변동 지수가 48%에서 45%로 하향 조정되었습니다.',
      }
    ],
    userVotes: {
      [RealityStatus.REALIZING]: 240,
      [RealityStatus.FADING]: 180,
      [RealityStatus.DEBATING]: 520,
      [RealityStatus.DEFUNCT]: 90,
      [RealityStatus.REALIZED]: 5,
    },
  }
];

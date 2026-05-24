import { ArchiveReference, CategoryType, RealityStatus } from '../../model/archive.model';

export const MOCK_ARCHIVE_DATA: ArchiveReference = {
  id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  referenceNumber: 'REF: N° 00001',
  category: CategoryType.ENTRY_QUOTE,
  coreClaim: {
    quote: '메타버스가 인터넷을 대체할 것이다. 우리는 그 중심에 있다.',
    contextDescription: '2021년 페이스북이 사명을 \'메타(Meta)\'로 변경하며 발표한 비전 선포 내용과 현재의 AI 중심 기술 트렌드 변화, 투자 지연 등에 대한 비판적 회의론 요약 텍스트.',
  },
  speaker: {
    id: 'spk-001',
    name: '마크 저커버그',
    position: 'CEO',
    organization: 'Meta',
    imageUrl: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?q=80&w=200&auto=format&fit=crop', // Placeholder for Zuckerberg
  },
  evidence: {
    recordedAt: '2021-10-28T00:00:00Z',
    sourceVenue: 'Meta Connect',
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
};

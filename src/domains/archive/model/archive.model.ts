export enum RealityStatus {
  REALIZING = 'REALIZING',
  FADING = 'FADING',
  DEBATING = 'DEBATING',
  DEFUNCT = 'DEFUNCT',
  REALIZED = 'REALIZED',
}

export enum CategoryType {
  ENTRY_QUOTE = 'ENTRY.QUOTE',
  ENTRY_PROMISE = 'ENTRY.PROMISE',
}

export interface ArchiveReference {
  id: string;
  referenceNumber: string;
  category: CategoryType;
  
  coreClaim: {
    quote: string;
    contextDescription: string;
  };

  speaker: {
    id: string;
    name: string;
    position: string;
    imageUrl: string;
    organization: string;
  };

  evidence: {
    recordedAt: string;
    sourceVenue: string;
    sourceUrl?: string | null;
  };

  realityMeter: {
    currentIndex: number;
    status: RealityStatus;
  };

  observationStats: {
    totalObservers: number;
    distribution: Record<RealityStatus, number>;
  };
}

export const REALITY_STATUS_LABEL: Record<RealityStatus, string> = {
  [RealityStatus.REALIZING]: '현실화 중',
  [RealityStatus.FADING]: '흐릿해짐',
  [RealityStatus.DEBATING]: '논쟁 중',
  [RealityStatus.DEFUNCT]: '완전 소멸',
  [RealityStatus.REALIZED]: '완전 현실화',
};

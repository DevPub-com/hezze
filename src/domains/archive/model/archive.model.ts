export enum RealityStatus {
  REALIZING = 'REALIZING',
  FADING = 'FADING',
  DEBATING = 'DEBATING',
  DEFUNCT = 'DEFUNCT',
  REALIZED = 'REALIZED',
}

export enum RealizationTrajectory {
  FORWARD = 'FORWARD',
  DETOUR = 'DETOUR',
  REVERSED = 'REVERSED',
}

export enum RelationType {
  SUPPORTS = 'SUPPORTS',
  CONTRADICTS = 'CONTRADICTS',
  DERIVED = 'DERIVED',
}

export const RELATION_TYPE_LABEL: Record<RelationType, string> = {
  [RelationType.SUPPORTS]: '같은 방향',
  [RelationType.CONTRADICTS]: '반대 방향',
  [RelationType.DERIVED]: '파생 아젠다',
};

export interface ClaimRelation {
  id: string;
  targetArchiveId: string;
  relationType: RelationType;
}

export enum CategoryType {
  ENTRY_QUOTE = 'ENTRY.QUOTE',
  ENTRY_PROMISE = 'ENTRY.PROMISE',
}

export enum CheckInterval {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export const CHECK_INTERVAL_LABEL: Record<CheckInterval, string> = {
  [CheckInterval.DAILY]: '매일',
  [CheckInterval.WEEKLY]: '매주',
  [CheckInterval.MONTHLY]: '매월',
};

export interface TimelineItem {
  id: string;
  recordedAt: string;
  sourceVenue: string;
  sourceUrl: string;
  title: string;
  summary: string;
  realityIndex: number;
  status: RealityStatus;
  trajectory?: RealizationTrajectory;
}

export interface NotificationLog {
  id: string;
  recordedAt: string;
  message: string;
}

export interface ArchiveReference {
  id: string;
  referenceNumber: string;
  category: CategoryType;
  newsCategory: string;
  
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
    trajectory?: RealizationTrajectory;
  };

  observationStats: {
    totalObservers: number;
    distribution: Record<RealityStatus, number>;
  };

  checkInterval: CheckInterval;
  expiryDate: string;
  targetDates: string[];
  timeline: TimelineItem[];
  notificationLogs: NotificationLog[];
  userVotes: Record<RealityStatus, number>;
}

export const REALITY_STATUS_LABEL: Record<RealityStatus, string> = {
  [RealityStatus.REALIZING]: '🚀 착착 진행 중',
  [RealityStatus.FADING]: '🌫️ 소문만 무성해요',
  [RealityStatus.DEBATING]: '🔥 갑론을박 핫해요',
  [RealityStatus.DEFUNCT]: '🪦 없었던 일로…',
  [RealityStatus.REALIZED]: '🎉 진짜 해냈어요!',
};

export const REALIZATION_TRAJECTORY_LABEL: Record<RealizationTrajectory, string> = {
  [RealizationTrajectory.FORWARD]: '🎯 계획대로 척척',
  [RealizationTrajectory.DETOUR]: '🔀 삼천포로 새는 중',
  [RealizationTrajectory.REVERSED]: '↩️ 오히려 반대로!',
};

export interface SpeakerRankItem {
  speakerName: string;
  organization: string;
  position: string;
  totalClaims: number;
  realizedClaims: number;
  realizingClaims: number;
  factBattingAverage: number;
}

export interface UserRankItem {
  userId: string;
  userEmailMasked: string;
  totalVotes: number;
  correctVotes: number;
  accuracyRate: number;
  badgeTitle: string;
}



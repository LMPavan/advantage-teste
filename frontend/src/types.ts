export type Role = "OWNER" | "MANAGER" | "ATTENDANT";
export type Period = "DAILY" | "WEEKLY" | "MONTHLY";
export type ItemCalculationType = "SIMPLE" | "MIX_RATIO";
export type GoalDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
export type CommissionType =
  | "CENTS_PER_LITER"
  | "CURRENCY_PER_LITER"
  | "CURRENCY_PER_UNIT"
  | "PERCENTAGE_OF_VALUE"
  | "FIXED_PER_PERIOD";
export type PayoutMode = "THRESHOLD" | "PROPORTIONAL";
export type RedemptionStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  photoUrl?: string | null;
  networkId: string | null;
  stationId: string | null;
}

export interface Item {
  id: string;
  name: string;
  description?: string | null;
  unit: string;
  calculationType: ItemCalculationType;
  direction: GoalDirection;
  commissionType: CommissionType;
  commissionValue: string;
  payoutMode: PayoutMode;
  achievementThresholdPercent: string;
  active: boolean;
}

export interface GoalProgress {
  actualValue: number;
  targetValue: number;
  achievementPercent: number;
  commissionAmount: number;
}

export interface Goal {
  id: string;
  stationId: string;
  itemId: string;
  attendantId: string | null;
  period: Period;
  targetValue: string;
  startDate: string;
  endDate: string;
  item: Item;
  attendant: { id: string; name: string; email: string; photoUrl?: string | null } | null;
  station?: { id: string; name: string };
  progress: GoalProgress;
}

export interface RedemptionPolicy {
  id: string;
  stationId: string;
  allowDaily: boolean;
  allowWeekly: boolean;
  allowMonthly: boolean;
}

export interface Station {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  networkId: string;
  manager: { id: string; name: string; email: string; photoUrl?: string | null } | null;
  redemptionPolicy: RedemptionPolicy | null;
  _count?: { attendants: number };
  // Ausentes na resposta para o papel ATTENDANT (não precisam desses códigos).
  managerInviteCode?: string;
  attendantInviteCode?: string;
}

export interface Attendant {
  id: string;
  name: string;
  email: string;
  stationId: string;
  photoUrl?: string | null;
}

export interface Redemption {
  id: string;
  attendantId: string;
  stationId: string;
  period: Period;
  periodStart: string;
  periodEnd: string;
  commissionAmount: string;
  status: RedemptionStatus;
  requestedAt: string;
  attendant?: { id: string; name: string };
  station?: { id: string; name: string };
  notes?: string | null;
}

export interface StationRankingRow {
  stationId: string;
  stationName: string;
  managerId: string | null;
  managerName: string | null;
  managerPhotoUrl?: string | null;
  avgAchievement: number;
  totalCommission: number;
  attendantsCount: number;
}

export interface AttendantRankingRow {
  attendantId: string;
  name: string;
  photoUrl?: string | null;
  stationId: string;
  stationName: string;
  avgAchievement: number;
  totalCommission: number;
  goalsCount: number;
}

export interface ExecutiveDashboard {
  stationsCount: number;
  totalCommission: number;
  stationRankings: StationRankingRow[];
  attendantRankings: AttendantRankingRow[];
}

export interface TeamDashboard {
  stationId: string;
  attendants: {
    attendantId: string;
    name: string;
    goalsCount: number;
    avgAchievement: number;
    totalCommission: number;
  }[];
}

export interface HallOfFame {
  month: string;
  topAttendants: AttendantRankingRow[];
  topStations: StationRankingRow[];
}

export interface ItemBreakdownRow {
  itemId: string;
  itemName: string;
  unit: string;
  totalCommission: number;
  avgAchievement: number;
  goalsCount: number;
}

export interface RedemptionStatusSummary {
  count: number;
  amount: number;
}

export type RedemptionSummary = Record<RedemptionStatus, RedemptionStatusSummary>;

export interface OwnerSummary {
  stationsCount: number;
  managersCount: number;
  attendantsCount: number;
  totalCommission: number;
  avgAchievement: number;
  itemBreakdown: ItemBreakdownRow[];
  redemptionSummary: RedemptionSummary;
  bestStation: StationRankingRow | null;
  worstStation: StationRankingRow | null;
}

export interface ManagerSummary {
  attendantsCount: number;
  totalCommission: number;
  avgAchievement: number;
  itemBreakdown: ItemBreakdownRow[];
  redemptionSummary: RedemptionSummary;
  topAttendant: AttendantRankingRow | null;
  attendantNeedingAttention: AttendantRankingRow | null;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  achieved: boolean;
}

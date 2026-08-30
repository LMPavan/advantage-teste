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
  attendant: { id: string; name: string; email: string } | null;
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
  manager: { id: string; name: string; email: string } | null;
  redemptionPolicy: RedemptionPolicy | null;
  _count?: { attendants: number };
}

export interface Attendant {
  id: string;
  name: string;
  email: string;
  stationId: string;
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

export interface ExecutiveDashboard {
  stationsCount: number;
  totalCommission: number;
  stationRankings: {
    stationId: string;
    stationName: string;
    managerName: string | null;
    avgAchievement: number;
    totalCommission: number;
    attendantsCount: number;
  }[];
  attendantRankings: {
    attendantId: string;
    name: string;
    stationId: string;
    stationName: string;
    avgAchievement: number;
    totalCommission: number;
    goalsCount: number;
  }[];
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

export const HEALTH_STATUS_VALUES = ["healthy", "degraded", "unhealthy"] as const;
export type HealthStatus = (typeof HEALTH_STATUS_VALUES)[number];

export type ComponentHealth = {
  component: string;
  status: HealthStatus;
  metrics: Record<string, number>;
  message: string;
};

export type SystemHealth = {
  clinicId: string;
  status: HealthStatus;
  components: ComponentHealth[];
  windowHours: number;
  generatedAt: string;
};

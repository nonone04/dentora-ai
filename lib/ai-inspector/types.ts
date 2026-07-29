import type { TraceStepType } from "@/lib/observability";

/** Timeline search + filter state -- purely a UI concern, mirrors lib/calendar/types.ts's CalendarFilters. */
export type InspectorFilters = {
  search: string;
  stepTypes: TraceStepType[];
  errorsOnly: boolean;
};

export const EMPTY_INSPECTOR_FILTERS: InspectorFilters = { search: "", stepTypes: [], errorsOnly: false };

/** Conversation-list search + filter state, filtered client-side over the bounded list listConversationsAction already fetched -- same posture as lib/calendar/types.ts's CalendarFilters over calendar appointments. */
export type ConversationListFilters = {
  search: string;
  statuses: string[];
  channels: string[];
};

export const EMPTY_CONVERSATION_LIST_FILTERS: ConversationListFilters = { search: "", statuses: [], channels: [] };

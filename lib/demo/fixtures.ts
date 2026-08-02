/**
 * Static, realistic seed data for the shared interactive demo clinic --
 * "Clinique Dentaire Atlas" in Casablanca. Pure data only; no I/O. Ids are
 * assigned by the database on insert, so appointments are built from the
 * already-inserted dentist/service/patient rows (see buildDemoAppointments).
 */

export const DEMO_CLINIC = {
  name: "Clinique Dentaire Atlas",
  slug: "demo-clinique-atlas",
  phone: "+212522123456",
  whatsappNumber: "+212661234567",
  email: "contact@clinique-atlas-demo.ma",
  address: "12 Boulevard Zerktouni",
  city: "Casablanca",
  timezone: "Africa/Casablanca",
  defaultLanguage: "fr" as const,
};

export const DEMO_OWNER = {
  fullName: "Dr. Amine Tazi",
  preferredLanguage: "fr" as const,
};

export type DemoDentistFixture = {
  fullName: string;
  specialty: string;
  licenseNumber: string;
  color: string;
};

export const DEMO_DENTISTS: DemoDentistFixture[] = [
  { fullName: "Dr. Amine Tazi", specialty: "Orthodontics", licenseNumber: "DEN-10234", color: "#2563eb" },
  { fullName: "Dr. Salma El Fassi", specialty: "General Dentistry", licenseNumber: "DEN-10567", color: "#16a34a" },
  { fullName: "Dr. Karim Idrissi", specialty: "Endodontics", licenseNumber: "DEN-10892", color: "#d97706" },
  { fullName: "Dr. Nadia Benjelloun", specialty: "Pediatric Dentistry", licenseNumber: "DEN-11045", color: "#db2777" },
];

export type DemoServiceFixture = { name: string; durationMinutes: number; price: number };

export const DEMO_SERVICES: DemoServiceFixture[] = [
  { name: "Consultation", durationMinutes: 20, price: 150 },
  { name: "Dental Cleaning", durationMinutes: 30, price: 300 },
  { name: "Cavity Filling", durationMinutes: 45, price: 450 },
  { name: "Root Canal Treatment", durationMinutes: 90, price: 1800 },
  { name: "Tooth Extraction", durationMinutes: 30, price: 400 },
  { name: "Teeth Whitening", durationMinutes: 60, price: 1200 },
  { name: "Dental Crown", durationMinutes: 60, price: 2200 },
  { name: "Orthodontic Consultation", durationMinutes: 30, price: 250 },
];

export type DemoPatientFixture = {
  fullName: string;
  phone: string;
  email?: string;
  preferredLanguage: "ar" | "fr" | "en";
  gender?: string;
  notes?: string;
};

export const DEMO_PATIENTS: DemoPatientFixture[] = [
  { fullName: "Sara Amrani", phone: "+212600111001", email: "sara.amrani@example.com", preferredLanguage: "fr", gender: "female" },
  { fullName: "Youssef Bennis", phone: "+212600111002", preferredLanguage: "ar", gender: "male" },
  { fullName: "Fatima Zahra Idrissi", phone: "+212600111003", email: "fz.idrissi@example.com", preferredLanguage: "ar", gender: "female", notes: "Prefers morning appointments." },
  { fullName: "Omar Chraibi", phone: "+212600111004", preferredLanguage: "fr", gender: "male" },
  { fullName: "Nadia Berrada", phone: "+212600111005", email: "nadia.berrada@example.com", preferredLanguage: "fr", gender: "female" },
  { fullName: "Hamza El Amrani", phone: "+212600111006", preferredLanguage: "ar", gender: "male", notes: "Anxious about needles -- explain each step." },
  { fullName: "Khadija Tazi", phone: "+212600111007", preferredLanguage: "fr", gender: "female" },
  { fullName: "Ayoub Fassi", phone: "+212600111008", preferredLanguage: "en", gender: "male" },
  { fullName: "Meryem Ouazzani", phone: "+212600111009", email: "meryem.o@example.com", preferredLanguage: "fr", gender: "female" },
  { fullName: "Yassine Benjelloun", phone: "+212600111010", preferredLanguage: "ar", gender: "male" },
  { fullName: "Ghita Sqalli", phone: "+212600111011", preferredLanguage: "fr", gender: "female" },
  { fullName: "Reda Cherkaoui", phone: "+212600111012", preferredLanguage: "fr", gender: "male" },
  { fullName: "Imane Alaoui", phone: "+212600111013", email: "imane.alaoui@example.com", preferredLanguage: "ar", gender: "female" },
  { fullName: "Mehdi Lahlou", phone: "+212600111014", preferredLanguage: "fr", gender: "male" },
  { fullName: "Salma Bouzidi", phone: "+212600111015", preferredLanguage: "fr", gender: "female", notes: "Follow-up on crown fitting." },
  { fullName: "Anas Zniber", phone: "+212600111016", preferredLanguage: "ar", gender: "male" },
  { fullName: "Houda Kabbaj", phone: "+212600111017", preferredLanguage: "fr", gender: "female" },
  { fullName: "Ismail Rachidi", phone: "+212600111018", preferredLanguage: "en", gender: "male" },
  { fullName: "Zineb Guessous", phone: "+212600111019", email: "zineb.g@example.com", preferredLanguage: "fr", gender: "female" },
  { fullName: "Othmane Belkadi", phone: "+212600111020", preferredLanguage: "ar", gender: "male" },
  { fullName: "Lamiae Squalli", phone: "+212600111021", preferredLanguage: "fr", gender: "female" },
  { fullName: "Adil Mernissi", phone: "+212600111022", preferredLanguage: "fr", gender: "male" },
  { fullName: "Widad Chaoui", phone: "+212600111023", preferredLanguage: "ar", gender: "female" },
  { fullName: "Karim Sefrioui", phone: "+212600111024", preferredLanguage: "fr", gender: "male" },
  { fullName: "Nawal Benkirane", phone: "+212600111025", email: "nawal.benkirane@example.com", preferredLanguage: "fr", gender: "female" },
];

const DAILY_SLOT_HOURS = [9, 10.5, 12, 14, 15.5, 17];

// 60% completed, 20% cancelled, 20% no-show -- a believable mix for an
// already-happened slot ("pending" doesn't apply to the past).
const APPOINTMENT_STATUSES_PAST = ["completed", "completed", "completed", "cancelled", "no_show"] as const;

// Mostly confirmed/pending (scheduled) for upcoming slots, with an
// occasional cancellation mixed in -- real patients do cancel ahead of time,
// not only after the fact.
const APPOINTMENT_STATUSES_FUTURE = [
  "confirmed",
  "scheduled",
  "confirmed",
  "scheduled",
  "confirmed",
  "cancelled",
  "scheduled",
] as const;

// Fixed day counts rather than "start of last/next week" -- independent of
// which weekday `now` falls on, this always guarantees a full 14 days of
// past history (matching SPARKLINE_DAYS in lib/dashboard/trends.ts, so the
// revenue/appointment sparklines are never sparse) plus 14 days of upcoming
// bookings for the calendar, with `now`'s own day always included.
const WINDOW_PAST_DAYS = 14;
const WINDOW_FUTURE_DAYS = 14;

export type DemoAppointmentDraft = {
  dentistIndex: number;
  serviceIndex: number;
  patientIndex: number;
  startAt: string;
  endAt: string;
  status: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show";
};

/**
 * Builds a rolling spread of appointments (14 days past, today, 14 days
 * ahead) relative to `now`, one grid of fixed slots per dentist per weekday
 * so no two appointments for the same dentist ever overlap (required by the
 * appointments_no_overlap exclusion constraint). Purely deterministic --
 * same inputs always produce the same schedule, which is what "reset demo
 * data" relies on -- and always relative to `now`, so the demo clinic never
 * goes stale: every reset/reseed lands the whole schedule in the current
 * month again instead of wherever it happened to be seeded originally.
 */
export function buildDemoAppointments(now: Date = new Date()): DemoAppointmentDraft[] {
  const drafts: DemoAppointmentDraft[] = [];
  let patientCursor = 0;
  let serviceCursor = 0;
  let pastCursor = 0;
  let futureCursor = 0;

  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - WINDOW_PAST_DAYS);

  const totalDays = WINDOW_PAST_DAYS + WINDOW_FUTURE_DAYS + 1;

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const day = new Date(windowStart);
    day.setDate(day.getDate() + dayOffset);
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue; // weekends closed

    DEMO_DENTISTS.forEach((_, dentistIndex) => {
      // Each dentist gets 1-2 slots a day, offset so schedules don't collide.
      const slotsForDentist = DAILY_SLOT_HOURS.filter((_, i) => i % DEMO_DENTISTS.length === dentistIndex);

      slotsForDentist.forEach((hour) => {
        const start = new Date(day);
        const wholeHour = Math.floor(hour);
        const minutes = Math.round((hour - wholeHour) * 60);
        start.setHours(wholeHour, minutes, 0, 0);

        const service = DEMO_SERVICES[serviceCursor % DEMO_SERVICES.length];
        const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

        const isPast = start.getTime() < now.getTime();
        let status: DemoAppointmentDraft["status"];
        if (isPast) {
          status = APPOINTMENT_STATUSES_PAST[pastCursor % APPOINTMENT_STATUSES_PAST.length];
          pastCursor++;
        } else {
          status = APPOINTMENT_STATUSES_FUTURE[futureCursor % APPOINTMENT_STATUSES_FUTURE.length];
          futureCursor++;
        }

        drafts.push({
          dentistIndex,
          serviceIndex: serviceCursor % DEMO_SERVICES.length,
          patientIndex: patientCursor % DEMO_PATIENTS.length,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          status,
        });

        patientCursor++;
        serviceCursor++;
      });
    });
  }

  return drafts;
}

export type DemoKnowledgeBaseFixture = { category: string; question: string; answer: string };

export const DEMO_KNOWLEDGE_BASE: DemoKnowledgeBaseFixture[] = [
  {
    category: "Hours",
    question: "What are your opening hours?",
    answer: "We're open Monday to Friday, 9:00 AM to 6:00 PM, and Saturday 9:00 AM to 1:00 PM. Closed Sundays and public holidays.",
  },
  {
    category: "Pricing",
    question: "Do you offer payment plans for expensive treatments?",
    answer: "Yes, interest-free payment plans are available for treatments over 1,500 MAD, split over up to 3 months. Ask our front desk at checkout.",
  },
  {
    category: "Insurance",
    question: "Which insurance providers do you work with?",
    answer: "We accept CNSS, CNOPS, and most major private insurance providers in Morocco. Bring your insurance card to your first visit.",
  },
  {
    category: "Parking",
    question: "Is parking available at the clinic?",
    answer: "Yes, free parking is available in the building's underground garage, accessible from Boulevard Zerktouni.",
  },
  {
    category: "Cancellation",
    question: "What is your cancellation policy?",
    answer: "Please cancel or reschedule at least 24 hours in advance. Late cancellations may incur a 100 MAD fee.",
  },
  {
    category: "Emergency",
    question: "What should I do in a dental emergency outside office hours?",
    answer: "Call our emergency line at +212 522 123 456. For severe trauma or uncontrolled bleeding, go to the nearest hospital emergency room.",
  },
];

export type DemoAppointmentDraftFixture = {
  dentistIndex: number;
  serviceIndex: number;
  patientIndex: number;
  hoursFromNow: number;
  status: "proposed" | "confirmed" | "rejected" | "expired";
  notes?: string;
};

/** A handful of AI-proposed bookings -- some still awaiting staff review, some already resolved -- so the AI Inbox never renders empty on the demo account. */
export const DEMO_APPOINTMENT_DRAFTS: DemoAppointmentDraftFixture[] = [
  { dentistIndex: 0, serviceIndex: 1, patientIndex: 3, hoursFromNow: 26, status: "proposed", notes: "Requested via WhatsApp -- prefers afternoon slots." },
  { dentistIndex: 1, serviceIndex: 0, patientIndex: 9, hoursFromNow: 50, status: "proposed" },
  { dentistIndex: 2, serviceIndex: 4, patientIndex: 16, hoursFromNow: 74, status: "proposed", notes: "Follow-up after a recent extraction." },
  { dentistIndex: 0, serviceIndex: 2, patientIndex: 6, hoursFromNow: -30, status: "confirmed" },
  { dentistIndex: 3, serviceIndex: 5, patientIndex: 20, hoursFromNow: -50, status: "rejected", notes: "Requested slot was no longer available." },
  { dentistIndex: 1, serviceIndex: 3, patientIndex: 11, hoursFromNow: -80, status: "expired" },
];

export type DemoEscalatedConversationFixture = {
  patientIndex: number;
  channel: "whatsapp" | "web_chat" | "sms";
  reason: string;
  hoursAgo: number;
};

/** Conversations the AI handed off to staff -- populates the AI Inbox's "Escalated" section and the Settings page's conversation log. */
export const DEMO_ESCALATED_CONVERSATIONS: DemoEscalatedConversationFixture[] = [
  { patientIndex: 5, channel: "whatsapp", reason: "Patient reports severe pain and swelling, requesting a same-day emergency slot.", hoursAgo: 3 },
  { patientIndex: 12, channel: "web_chat", reason: "Patient wants to dispute a charge on their last invoice.", hoursAgo: 20 },
  { patientIndex: 18, channel: "whatsapp", reason: "Insurance coverage question the assistant couldn't answer confidently.", hoursAgo: 44 },
];

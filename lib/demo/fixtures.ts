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
const APPOINTMENT_STATUSES_PAST = ["completed", "completed", "completed", "cancelled", "no_show"] as const;

export type DemoAppointmentDraft = {
  dentistIndex: number;
  serviceIndex: number;
  patientIndex: number;
  startAt: string;
  endAt: string;
  status: "scheduled" | "confirmed" | "cancelled" | "completed" | "no_show";
};

/**
 * Builds a 3-week spread of appointments (1 week past, current week, 1 week
 * ahead) relative to `now`, one grid of fixed slots per dentist per weekday
 * so no two appointments for the same dentist ever overlap (required by the
 * appointments_no_overlap exclusion constraint). Purely deterministic --
 * same inputs always produce the same schedule, which is what "reset demo
 * data" relies on.
 */
export function buildDemoAppointments(now: Date = new Date()): DemoAppointmentDraft[] {
  const drafts: DemoAppointmentDraft[] = [];
  let patientCursor = 0;
  let serviceCursor = 0;

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() - 7);

  for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
    const day = new Date(startOfWeek);
    day.setDate(day.getDate() + dayOffset);
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue; // weekends closed

    DEMO_DENTISTS.forEach((_, dentistIndex) => {
      // Each dentist gets 2-3 slots a day, offset so schedules don't collide.
      const slotsForDentist = DAILY_SLOT_HOURS.filter((_, i) => i % DEMO_DENTISTS.length === dentistIndex);

      slotsForDentist.forEach((hour) => {
        const start = new Date(day);
        const wholeHour = Math.floor(hour);
        const minutes = Math.round((hour - wholeHour) * 60);
        start.setHours(wholeHour, minutes, 0, 0);

        const service = DEMO_SERVICES[serviceCursor % DEMO_SERVICES.length];
        const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

        const isPast = start.getTime() < now.getTime();
        const status: DemoAppointmentDraft["status"] = isPast
          ? APPOINTMENT_STATUSES_PAST[(dentistIndex + dayOffset) % APPOINTMENT_STATUSES_PAST.length]
          : dayOffset % 3 === 0
            ? "confirmed"
            : "scheduled";

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

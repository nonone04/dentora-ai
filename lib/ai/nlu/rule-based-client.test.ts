import { describe, expect, it } from "vitest";
import { extractWithRules, RuleBasedNLUClient } from "@/lib/ai/nlu/rule-based-client";

// Fixed reference "now" so date-relative assertions (today/tomorrow/next
// Tuesday/...) are deterministic. 2026-07-27 is a Monday.
const NOW = new Date("2026-07-27T09:00:00Z");

describe("extractWithRules: intent detection", () => {
  it("detects book_appointment", () => {
    expect(extractWithRules("I'd like to book an appointment for a cleaning", NOW).intent).toBe("book_appointment");
  });

  it("detects book_appointment in French", () => {
    expect(extractWithRules("Je voudrais prendre rendez-vous", NOW).intent).toBe("book_appointment");
  });

  it("detects cancel_appointment even when the message also mentions 'appointment'", () => {
    expect(extractWithRules("I need to cancel my appointment tomorrow", NOW).intent).toBe("cancel_appointment");
  });

  it("detects reschedule_appointment", () => {
    expect(extractWithRules("Can I reschedule my appointment to Friday?", NOW).intent).toBe("reschedule_appointment");
  });

  it("detects check_availability", () => {
    expect(extractWithRules("What slots are available tomorrow?", NOW).intent).toBe("check_availability");
  });

  it("detects get_clinic_info", () => {
    expect(extractWithRules("What are your opening hours?", NOW).intent).toBe("get_clinic_info");
  });

  it("detects ask_faq", () => {
    expect(extractWithRules("How much does a whitening cost?", NOW).intent).toBe("ask_faq");
  });

  it("detects escalate_to_staff", () => {
    expect(extractWithRules("I want to speak to a human please", NOW).intent).toBe("escalate_to_staff");
  });

  it("detects a bare greeting", () => {
    expect(extractWithRules("Hello!", NOW).intent).toBe("greeting");
  });

  it("does not classify a longer message containing a greeting word as just a greeting", () => {
    const result = extractWithRules("Hi, I need to book an appointment for next Tuesday", NOW);
    expect(result.intent).toBe("book_appointment");
  });

  it("falls back to other for unrelated chatter", () => {
    expect(extractWithRules("The weather is nice today", NOW).intent).toBe("other");
  });
});

describe("extractWithRules: date entity", () => {
  it("resolves an explicit ISO date", () => {
    expect(extractWithRules("Book me for 2026-08-05", NOW).entities.date).toBe("2026-08-05");
  });

  it("resolves 'today'", () => {
    expect(extractWithRules("Can I come in today?", NOW).entities.date).toBe("2026-07-27");
  });

  it("resolves 'tomorrow'", () => {
    expect(extractWithRules("Can I come in tomorrow?", NOW).entities.date).toBe("2026-07-28");
  });

  it("resolves 'demain' (French tomorrow)", () => {
    expect(extractWithRules("Je peux venir demain ?", NOW).entities.date).toBe("2026-07-28");
  });

  it("resolves 'day after tomorrow'", () => {
    expect(extractWithRules("Let's do the day after tomorrow", NOW).entities.date).toBe("2026-07-29");
  });

  it("resolves the next occurrence of a named weekday, skipping today if it matches", () => {
    // NOW is a Monday -- "next Monday" should resolve a full week out, not today.
    expect(extractWithRules("Can we do Monday?", NOW).entities.date).toBe("2026-08-03");
  });

  it("resolves a weekday later in the same week", () => {
    expect(extractWithRules("How about Friday?", NOW).entities.date).toBe("2026-07-31");
  });

  it("resolves 'month day' phrasing", () => {
    expect(extractWithRules("Let's do August 5th", NOW).entities.date).toBe("2026-08-05");
  });

  it("resolves 'day month' phrasing", () => {
    expect(extractWithRules("Let's do 5 August", NOW).entities.date).toBe("2026-08-05");
  });

  it("rolls a month/day that's already passed this year into next year", () => {
    expect(extractWithRules("Let's do January 5th", NOW).entities.date).toBe("2027-01-05");
  });

  it("returns null when no date is mentioned", () => {
    expect(extractWithRules("What services do you offer?", NOW).entities.date).toBeNull();
  });
});

describe("extractWithRules: time entity", () => {
  it("resolves 12h time with am/pm", () => {
    expect(extractWithRules("How about 3pm?", NOW).entities.time).toBe("15:00");
  });

  it("resolves 12h time with minutes", () => {
    expect(extractWithRules("How about 9:30am?", NOW).entities.time).toBe("09:30");
  });

  it("resolves 24h time", () => {
    expect(extractWithRules("Book it for 14:30", NOW).entities.time).toBe("14:30");
  });

  it("resolves noon", () => {
    expect(extractWithRules("Around noon works", NOW).entities.time).toBe("12:00");
  });

  it("captures a vague period as-is", () => {
    expect(extractWithRules("Sometime in the morning", NOW).entities.time).toBe("morning");
  });
});

describe("extractWithRules: phone entity", () => {
  it("extracts a phone number", () => {
    expect(extractWithRules("You can reach me at 0612345678", NOW).entities.phone).toBe("0612345678");
  });

  it("extracts an internationally formatted phone number", () => {
    expect(extractWithRules("My number is +212 6 12 34 56 78", NOW).entities.phone).toBe("+212612345678");
  });

  it("does not mistake an ISO date for a phone number", () => {
    const result = extractWithRules("Let's book 2026-08-05 please", NOW);
    expect(result.entities.date).toBe("2026-08-05");
    expect(result.entities.phone).toBeNull();
  });
});

describe("extractWithRules: service/dentist/patientName entities", () => {
  it("extracts a mentioned service", () => {
    expect(extractWithRules("I'd like a cleaning please", NOW).entities.service).toBe("cleaning");
  });

  it("extracts a mentioned dentist", () => {
    expect(extractWithRules("I'd like to see Dr. Amrani", NOW).entities.dentist).toBe("Dr. Amrani");
  });

  it("extracts a patient name from 'my name is'", () => {
    expect(extractWithRules("Hi, my name is Sara Idrissi", NOW).entities.patientName).toBe("Sara Idrissi");
  });

  it("extracts a patient name from French 'je m'appelle'", () => {
    expect(extractWithRules("Bonjour, je m'appelle Yassine", NOW).entities.patientName).toBe("Yassine");
  });
});

describe("extractWithRules: urgency", () => {
  it("flags an emergency", () => {
    expect(extractWithRules("This is an emergency, I can't stop bleeding", NOW).urgency).toBe("emergency");
  });

  it("flags high urgency for 'urgent' without emergency language", () => {
    expect(extractWithRules("I need an urgent appointment", NOW).urgency).toBe("high");
  });

  it("flags medium urgency for a passing mention of pain", () => {
    expect(extractWithRules("I have some tooth pain, when can I come in?", NOW).urgency).toBe("medium");
  });

  it("defaults to low urgency", () => {
    expect(extractWithRules("What are your hours?", NOW).urgency).toBe("low");
  });
});

describe("extractWithRules: language", () => {
  it("detects Arabic by script", () => {
    expect(extractWithRules("مرحبا، أريد حجز موعد", NOW).language).toBe("ar");
  });

  it("detects French by marker words", () => {
    expect(extractWithRules("Bonjour, je voudrais prendre rendez-vous demain", NOW).language).toBe("fr");
  });

  it("defaults to English", () => {
    expect(extractWithRules("Hi, I'd like to book an appointment", NOW).language).toBe("en");
  });
});

describe("extractWithRules: confidence", () => {
  it("is higher for a keyword-matched intent with all required fields present", () => {
    const withFields = extractWithRules("Book a cleaning for 2026-08-05", NOW);
    const withoutFields = extractWithRules("I'd like to book something", NOW);
    expect(withFields.confidence).toBeGreaterThan(withoutFields.confidence);
  });

  it("is low for an unmatched, ambiguous message", () => {
    expect(extractWithRules("The weather is nice today", NOW).confidence).toBeLessThanOrEqual(0.25);
  });

  it("always stays within [0, 1]", () => {
    const result = extractWithRules("Book a cleaning with Dr. Amrani for 2026-08-05 at 14:00, I'm Sara, 0612345678", NOW);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("extractWithRules: missingFields integration", () => {
  it("computes missing fields consistently with the extracted entities", () => {
    const result = extractWithRules("I'd like to book an appointment", NOW);
    expect(result.intent).toBe("book_appointment");
    expect(result.missingFields).toEqual(expect.arrayContaining(["service", "date"]));
  });

  it("has no missing fields once every required entity is present", () => {
    const result = extractWithRules("Book a cleaning for 2026-08-05, my name is Sara Idrissi", NOW);
    expect(result.missingFields).toEqual([]);
  });
});

describe("RuleBasedNLUClient", () => {
  it("extracts from the last user message in a multi-turn conversation", async () => {
    const client = new RuleBasedNLUClient();
    const result = await client.extract({
      clinicName: "Test Clinic",
      messages: [
        { role: "user", content: "Hi there" },
        { role: "assistant", content: "Hello! How can I help?" },
        { role: "user", content: "I'd like to book a cleaning for 2026-08-05" },
      ],
    });

    expect(result.intent).toBe("book_appointment");
    expect(result.entities.service).toBe("cleaning");
    expect(result.entities.date).toBe("2026-08-05");
    expect(result.rawMessage).toBe("I'd like to book a cleaning for 2026-08-05");
  });

  it("returns a neutral extraction when there is no user message", async () => {
    const client = new RuleBasedNLUClient();
    const result = await client.extract({ clinicName: "Test Clinic", messages: [] });
    expect(result.intent).toBe("other");
    expect(result.rawMessage).toBe("");
  });
});

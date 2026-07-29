import { DetailField } from "@/components/detail-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";

type PatientRecord = {
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  preferred_language: string;
  preferred_contact_channel: string;
  reminder_opt_in: boolean;
  notes: string | null;
};

const LANGUAGE_KEY: Record<string, keyof Dictionary["language"]> = { ar: "arabic", fr: "french", en: "english" };
const CHANNEL_KEY: Record<string, keyof Dictionary["channel"]> = { email: "email", sms: "sms", whatsapp: "whatsapp" };

export function MedicalInfoCard({ patient, t, locale }: { patient: PatientRecord; t: Dictionary; locale: Locale }) {
  const languageLabel = t.language[LANGUAGE_KEY[patient.preferred_language]] ?? patient.preferred_language;
  const channelLabel = t.channel[CHANNEL_KEY[patient.preferred_contact_channel]] ?? patient.preferred_contact_channel;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.patientDetail.medicalInfo.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <DetailField label={t.patients.phone} value={patient.phone} />
        <DetailField label={t.patients.email} value={patient.email} />
        <DetailField
          label={t.patientDetail.medicalInfo.dateOfBirth}
          value={patient.date_of_birth ? formatDate(patient.date_of_birth, locale) : null}
        />
        <DetailField label={t.patientDetail.medicalInfo.gender} value={patient.gender} />
        <DetailField label={t.patientDetail.medicalInfo.preferredLanguage} value={languageLabel} />
        <DetailField label={t.patientDetail.medicalInfo.preferredChannel} value={channelLabel} />
        <DetailField
          label={t.patientDetail.medicalInfo.reminders}
          value={patient.reminder_opt_in ? t.patientDetail.medicalInfo.remindersOptedIn : t.patientDetail.medicalInfo.remindersOptedOut}
        />
        {patient.notes && (
          <div className="col-span-full">
            <div className="text-muted-foreground">{t.patientDetail.medicalInfo.clinicNotes}</div>
            <div className="whitespace-pre-wrap">{patient.notes}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { MeetingForm } from "../MeetingForm";

export const metadata = {
  title: "Naujas susirinkimas | Administravimas",
};

export default function NewMeetingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Naujas susirinkimas</h1>
      <MeetingForm />
    </div>
  );
}

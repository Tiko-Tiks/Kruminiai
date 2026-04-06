import { MemberForm } from "../MemberForm";

export default function NewMemberPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Naujas narys</h1>
        <p className="text-sm text-gray-500 mt-1">Užpildykite nario informaciją</p>
      </div>
      <MemberForm />
    </div>
  );
}

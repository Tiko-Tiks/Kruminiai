import { NewsForm } from "../NewsForm";

export default function NewNewsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nauja naujiena</h1>
        <p className="text-sm text-gray-500 mt-1">Parašykite ir paskelbkite naujieną</p>
      </div>
      <NewsForm />
    </div>
  );
}

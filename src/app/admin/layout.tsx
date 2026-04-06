import { AdminSidebar } from "@/components/layout/AdminSidebar";

export const metadata = {
  title: "Administravimas | Krūminių kaimo bendruomenė",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="ml-64 p-6">
        {children}
      </main>
    </div>
  );
}

import { MemberSidebar } from "@/components/layout/MemberSidebar";

export const metadata = {
  title: "Nario portalas",
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <MemberSidebar />
      <main className="lg:ml-64">
        <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

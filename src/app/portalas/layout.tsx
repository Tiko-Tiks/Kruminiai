import { MemberSidebar } from "@/components/layout/MemberSidebar";

export const metadata = {
  title: "Nario portalas",
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    // overflow-x-hidden – apsauga nuo horizontalaus scroll'o iOS Safari'yje
    // (kai kažkoks vidinis elementas viršija viewport plotį).
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <MemberSidebar />
      <main className="lg:ml-64">
        {/* pt-16 mobile režime – kad fixed meniu mygtukas (top-3 left-3)
            neuždengtų pirmos eilutės turinio. lg+ – įprastas py-8. */}
        <div className="px-4 sm:px-6 lg:px-8 pt-16 lg:pt-8 pb-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

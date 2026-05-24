import { PublicHeader } from "@/components/layout/PublicHeader";

/**
 * Loading skeleton'as – rodomas, kol vyksta server-side RPC į
 * get_contact_update_token_data. Pasitarnauja Vercel cold-start atveju,
 * kai pirma serverless funkcijos uždegimas trunka 1-2 sek.
 *
 * Geriausia UX – iškart matosi forma struktūra, ne baltas ekranas.
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col bg-amber-50/40">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-pulse">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-gray-200 mx-auto mb-3" />
              <div className="h-7 bg-gray-200 rounded mx-auto w-40 mb-2" />
              <div className="h-4 bg-gray-100 rounded mx-auto w-full mt-3" />
              <div className="h-4 bg-gray-100 rounded mx-auto w-3/4 mt-1" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
                <div className="h-12 bg-gray-100 rounded-lg" />
              </div>
              <div>
                <div className="h-4 bg-gray-100 rounded w-20 mb-2" />
                <div className="h-12 bg-gray-100 rounded-lg" />
              </div>
              <div>
                <div className="h-4 bg-gray-100 rounded w-20 mb-2" />
                <div className="h-12 bg-gray-100 rounded-lg" />
              </div>
              <div className="h-12 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

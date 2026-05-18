"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2, AlertCircle } from "lucide-react";

// PDF.js worker iš CDN – nereikia konfigūruoti webpack
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  url: string;
}

// Be zoom mygtukų – mobiliuose įrenginiuose naudotojai naudoja
// natūralų pinch-to-zoom dviem pirštais. PC – pakanka Ctrl + ratuko.
export function PdfViewer({ url }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [error, setError] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        // 32px viso padding (16 + 16)
        setContainerWidth(Math.min(containerRef.current.clientWidth - 32, 900));
      }
    }
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 p-6">
        <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
        <p className="text-sm font-medium mb-1">Nepavyko įkelti dokumento</p>
        <p className="text-xs text-gray-500 mb-4">Bandykite atsisiųsti tiesiogiai.</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-green-700 underline"
        >
          Atidaryti naujame lange
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto bg-gray-100">
      <div className="flex flex-col items-center py-4 px-4">
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setError(true)}
          loading={
            <div className="flex items-center gap-2 text-gray-500 py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Įkeliama...</span>
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i} className="mb-4 shadow-lg">
              <Page
                pageNumber={i + 1}
                width={containerWidth || undefined}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { DashboardForm } from "@/types/dashboard";

type QRCodeDisplayProps = {
  value: string;
  size?: number;
  formData?: DashboardForm;
  businessName?: string;
  businessLogo?: string | null;
  zoneId?: string;
};

export function QRCodeDisplay({
  value,
  size = 200,
  formData,
  businessName,
  businessLogo,
  zoneId,
}: QRCodeDisplayProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  // Clean URL with optional zone param
  let formUrl = formData
    ? `${window.location.origin}/start?form=${value}`
    : value;

  if (zoneId) {
    if (formUrl.includes("?")) {
      formUrl += `&zone_id=${zoneId}`;
    } else {
      formUrl += `?zone_id=${zoneId}`;
    }
  }

  const handleDownload = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    // Convert SVG to canvas for download
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `mirour-qr-${value}.png`;
      link.href = pngUrl;
      link.click();
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center p-4 bg-card rounded-xl" ref={qrRef}>
        <QRCodeSVG value={formUrl} size={size} level="H" includeMargin={true} />
      </div>

      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Or visit:{" "}
          <span className="text-primary font-mono break-all text-xs">
            {formUrl}
          </span>
        </p>

        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl hover:opacity-90 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download QR Code
        </button>
      </div>
    </div>
  );
}

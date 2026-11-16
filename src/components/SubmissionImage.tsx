import { useEffect, useState } from "react";
import { resolveImageUrl } from "@/lib/data";
import { ImageOff } from "lucide-react";

export function SubmissionImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveImageUrl(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src]);
  if (!src) return null;
  if (!url)
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}>
        <ImageOff className="h-5 w-5" />
      </div>
    );
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

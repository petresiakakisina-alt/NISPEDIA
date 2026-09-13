import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold text-foreground">NISPEDIA</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Edukasi Digital Interaktif Akses Informasi Pengajuan NISP KSP dan USP
      </p>
      <Button variant="default">Mulai</Button>
    </div>
  );
}

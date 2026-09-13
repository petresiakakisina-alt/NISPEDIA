import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Halaman tidak ditemukan</p>
      <Link href="/" className="text-primary underline">
        Kembali ke Beranda
      </Link>
    </div>
  );
}

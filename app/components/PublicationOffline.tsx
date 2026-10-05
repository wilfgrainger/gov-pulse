import Link from "next/link";
import BrandLogo from "./BrandLogo";

export default function PublicationOffline({ title = "Data publications are temporarily offline" }: { title?: string }) {
  return <div className="min-h-screen bg-background px-5 text-foreground md:px-8">
    <header className="mx-auto max-w-5xl border-b border-black/20 py-8"><BrandLogo /></header>
    <main className="mx-auto max-w-5xl py-16 md:py-24">
      <p className="eyebrow">Publication review</p>
      <h1 className="font-display mt-5 max-w-4xl text-4xl leading-tight md:text-6xl">{title}</h1>
      <p className="mt-7 max-w-2xl text-lg leading-8 text-gray-700">We have taken our data publications offline while we reverify the evidence. Publications will return once their data has been reverified.</p>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600">Figures, charts, downloads and historical editions are unavailable during this review.</p>
      <Link prefetch={false} href="/" className="mt-8 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">public-data.org</Link>
    </main>
    <footer className="mx-auto flex max-w-5xl flex-wrap gap-6 border-t border-black/20 py-8 text-sm"><Link prefetch={false} href="/about/" className="underline">About</Link><Link prefetch={false} href="/editorial-policy/" className="underline">Editorial policy</Link><Link prefetch={false} href="/contact/" className="underline">Contact</Link></footer>
  </div>;
}

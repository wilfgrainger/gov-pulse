import Link from "next/link";

export default function CountryPeersNotice({ published }: { published: boolean }) {
  return published ? (
    <p className="mt-4 max-w-3xl border-l-4 border-accent bg-white p-4 text-sm leading-6 text-gray-800">
      <strong>Country comparison:</strong> 13 countries across seven measures, with denominators, years and missing values disclosed, is on{" "}
      <Link href="/section/uk-in-context/" className="font-semibold underline underline-offset-4">UK in context</Link>.
    </p>
  ) : (
    <p role="status" className="mt-4 max-w-3xl text-sm leading-6 text-gray-700">Country comparison is held from publication until its evidence review is complete, so no country peers are shown here.</p>
  );
}

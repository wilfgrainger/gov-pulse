import Link from "next/link";

interface WithdrawnEvidenceProps {
  titleId: string;
  eyebrow: string;
  title: string;
  summary: string;
  requirements: string[];
  note?: string;
}

export default function WithdrawnEvidence({
  titleId,
  eyebrow,
  title,
  summary,
  requirements,
  note,
}: WithdrawnEvidenceProps) {
  return (
    <section
      aria-labelledby={titleId}
      className="border-y border-foreground bg-white py-6"
    >
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-red-800 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-900">
            Withdrawn evidence
          </span>
          <span className="text-sm font-semibold text-gray-600">{eyebrow}</span>
        </div>

        <h3
          id={titleId}
          className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] text-gray-950 md:text-5xl"
        >
          {title}
        </h3>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-700 md:text-lg md:leading-8">
          {summary}
        </p>

        <div className="mt-6 border-l-4 border-foreground pl-4">
          <h4 className="text-lg font-semibold text-gray-950">
            What must be true before this evidence returns
          </h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700">
            {requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>

        {note ? (
          <p className="mt-5 max-w-3xl text-sm leading-6 text-gray-600">{note}</p>
        ) : null}

        <Link
          href="/sources"
          prefetch={false}
          className="mt-5 inline-block text-sm font-semibold underline decoration-1 underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#172234]"
        >
          Read the evidence and withdrawal policy
        </Link>
      </div>
    </section>
  );
}

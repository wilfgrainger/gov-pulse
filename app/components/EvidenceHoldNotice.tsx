export default function EvidenceHoldNotice({
  id,
  children = "The feature is available, but its evidence is held from public release. No values are shown until the source has been verified and publication is authorised.",
}: {
  id: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      data-testid={id}
      role="status"
      aria-labelledby={`${id}-title`}
      className="border-l-4 border-[#8a5a12] bg-surface-warm p-5 md:p-6"
    >
      <h2 id={`${id}-title`} className="text-lg font-bold">Evidence held from publication</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700">{children}</p>
    </section>
  );
}

# Feed source contract schema

Every automated PULSE feed must define:

- `section`: stable frontend and Worker key.
- `title`: user-facing evidence title.
- `evidenceClass`: official data, public opinion or market signal.
- `geography`: exact territorial coverage.
- `retrieval`: Worker fetch or GitHub Actions ingest.
- `refreshCadence`: retrieval cadence, not publication cadence.
- `publicationCadence`: expected upstream publication rhythm.
- `operationalStatus`: active or an explicit debt state.
- `upstreams`: one or more named source records.

Each upstream source record must include:

- publisher;
- human-readable source label;
- direct HTTPS URL;
- source class;
- series and dataset identifiers where the publisher provides them;
- caveat where the source is secondary, commercial or methodologically constrained.

The registry is a control-plane contract, not a substitute for field-level provenance. A source-specific connector must still prove the observation period, unit, geography, transformation and revision status of every displayed metric.

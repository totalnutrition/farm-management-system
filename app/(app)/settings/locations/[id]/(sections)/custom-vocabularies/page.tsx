import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Location · Custom vocabularies" };

export default function LocationCustomVocabulariesPage() {
  return (
    <ComingSoon
      title="Custom vocabularies"
      description="Local additions to organization catalogs (diagnoses, drugs, cull reasons)."
      note="Inherits from organization catalogs; per-location overrides land alongside PR-A.6."
    />
  );
}

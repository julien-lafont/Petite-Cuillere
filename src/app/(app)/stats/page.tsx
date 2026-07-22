import { ComingSoon } from "@/components/coming-soon";
import { BarChart3 } from "lucide-react";

export default function Page() {
  return (
    <ComingSoon
      icon={BarChart3}
      title="Statistiques"
      description="Prends du recul : répartition des aliments et des catégories, diversité alimentaire et tendances, sur grand écran."
      iteration="8"
    />
  );
}

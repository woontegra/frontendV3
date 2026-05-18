import { Navigate, useParams } from "react-router-dom";

/** V2 → V3 eski fazla mesai URL'leri için `/:id` ile birlikte yönlendirme */
export function FazlaMesaiLegacyToBase({ base }: { base: string }) {
  const { id } = useParams();
  return <Navigate to={id !== undefined ? `${base}/${id}` : base} replace />;
}

import type { Historia } from "../../historias/tipos.ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs.tsx";

function Ejemplo() {
  return (
    <Tabs defaultValue="secciones">
      <TabsList aria-label="Panel del editor">
        <TabsTrigger value="secciones">Secciones</TabsTrigger>
        <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
        <TabsTrigger value="fotos">Fotos</TabsTrigger>
      </TabsList>
      <TabsContent value="secciones" className="text-sm text-ui-ink-muted">
        Reordena, oculta o cambia el diseño de cada sección de tu invitación.
      </TabsContent>
      <TabsContent value="apariencia" className="text-sm text-ui-ink-muted">
        Elige la paleta y la tipografía de la plantilla.
      </TabsContent>
      <TabsContent value="fotos" className="text-sm text-ui-ink-muted">
        Sube o cambia las fotos de tu invitación.
      </TabsContent>
    </Tabs>
  );
}

export const historias: Historia = {
  slug: "tabs",
  nombre: "Tabs",
  familia: "navegacion",
  descripcion:
    "Pestañas con activación manual (mover el foco con las flechas no cambia el panel hasta Enter o Espacio). Píldora contenedora en surface-alt; la activa resalta con surface-raised y shadow-ui-1.",
  variantes: [{ nombre: "Panel del editor", render: () => <Ejemplo /> }],
  estados: [
    {
      nombre: "Pestaña deshabilitada",
      render: () => (
        <Tabs defaultValue="a">
          <TabsList aria-label="Ejemplo">
            <TabsTrigger value="a">Secciones</TabsTrigger>
            <TabsTrigger value="b" disabled>
              Fotos
            </TabsTrigger>
          </TabsList>
          {/* Integración: cada pestaña necesita su panel; sin él, `aria-controls` apunta a un id
              inexistente y axe lo marca (aria-valid-attr-value). */}
          <TabsContent value="a">Contenido de secciones.</TabsContent>
          <TabsContent value="b">Contenido de fotos.</TabsContent>
        </Tabs>
      ),
    },
  ],
};

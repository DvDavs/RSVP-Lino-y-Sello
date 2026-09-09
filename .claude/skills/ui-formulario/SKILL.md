---
name: ui-formulario
description: Construir o modificar un formulario del producto con react-hook-form + Zod y los controles del sistema de diseño. Cárgala cuando el encargo pida un formulario, un campo validado, un flujo de captura de datos o cambios de validación/mensajes de error en frontend/apps/web.
---

# ui-formulario

Antes de nada, carga `identidad-visual` (`.claude/skills/identidad-visual/SKILL.md`). Este skill
asume ya cargado ese contexto.

## 0. Las dependencias YA están instaladas
Verificado en `frontend/apps/web/package.json`: `react-hook-form@7.87.0`, `zod@4.5.4`,
`@hookform/resolvers@5.9.1` son dependencias directas de `apps/web`. **No hace falta** `pnpm add`
nada para un formulario nuevo ahí. Si tu formulario vive en OTRO paquete del monorepo, comprueba
primero ese `package.json` (`grep -n "react-hook-form\|\"zod\"" frontend/packages/<paquete>/package.json`)
y, si faltan, dilo en tu bitácora con el comando exacto:
`pnpm --filter <paquete> add react-hook-form zod @hookform/resolvers`.

## 1. Dos patrones reales en este repo — elige el que corresponda
- **Autoguardado por campo** (panel de contenido del editor, `components/fields/TextField.tsx`):
  `useForm` con `mode: "onChange"`, sin botón de envío — cada `onChange` valida
  (`trigger`) y, si pasa, llama a `onCommit(valorNuevo)` para guardar ese campo solo. Usa esto
  cuando el formulario edita un documento que ya se autoguarda (como el editor).
- **Envío con botón** (login, alta de cuenta, cualquier formulario nuevo con un "Guardar"/"Enviar"
  explícito): `handleSubmit(alValido, alInvalido)`. Ver §4 para el detalle de foco y de deshabilitar
  el botón — este repo no tiene todavía un ejemplo end-to-end de este segundo patrón; síguelo al
  pie de la letra, no lo inventes distinto.

## 2. El esquema Zod
```tsx
const schema = z.object({
  correo: z.string().min(1, "Escribe tu correo electrónico.").email("Ese correo no tiene un formato válido."),
  contrasena: z.string().min(1, "Escribe tu contraseña."),
});
type Valores = z.infer<typeof schema>;

const { register, handleSubmit, formState, setFocus } = useForm<Valores>({
  resolver: zodResolver(schema),
  mode: "onChange", // valida en el borde (blur/change), además del envío
});
```
- **Validación en el borde Y en el envío**: `mode: "onChange"` (o `"onBlur"` si el borde correcto es
  perder el foco) más `handleSubmit`, que siempre revalida todo antes de llamar a tu `onSubmit` —
  nunca solo uno de los dos.
- Si el campo tiene una contraparte en el esquema Zod compartido de `frontend/packages/schema`,
  deriva las reglas de ahí (igual que `TextField.tsx` construye su `z.object` desde
  `spec.constraints` del `BlockSpec` del servidor) — nunca dupliques un límite a mano si ya existe
  en el esquema fuente.

## 3. Mensajes de error que sugieren la corrección
Nunca «Campo inválido» ni «Error de validación». Cada mensaje dice qué está mal y qué hacer, en
es-MX, y vive en `lib/i18n.ts` si el formulario es de pantalla (no un campo de contenido interno):
- Mal: `"Correo inválido"`.
- Bien: `"Ese correo no tiene un formato válido. Revisa que lleve una @ y un dominio."`
- Mira `TextField.tsx` (`Como máximo ${maxLength} caracteres — tiene ${maxLength + 1} o más.`) y
  `lib/i18n.ts` (`acceso.credencialesInvalidas`: «El correo o la contraseña no coinciden. Revísalos
  e inténtalo otra vez.») como el tono exacto a igualar.

## 4. Etiqueta, error asociado, foco al primer error, envío deshabilitado
- **Etiqueta siempre visible** asociada por `htmlFor`/`id` — nunca solo un `placeholder` como
  etiqueta. Usa `Field` de `@invitaciones/ui` (clona el control con `id`/`aria-invalid`/
  `aria-describedby`) si el formulario tiene un control por fila, o `FieldShell` +
  `describedByPara` (`components/fields/FieldShell.tsx`) si necesitas más de un control por fila
  (como `LocationField`).
- **Error asociado por `aria-describedby`**, apuntando al `id` del `<p role="alert">` del mensaje —
  el mismo valor que `Field`/`describedByPara` ya calculan, nunca un id inventado aparte.
- **Foco al primer error** en el envío: pasa un segundo argumento a `handleSubmit` y usa `setFocus`
  con el primer campo con error, en el orden del formulario (no el orden de `Object.keys`, que no
  está garantizado):
  ```tsx
  const ORDEN = ["correo", "contrasena"] as const;
  function alInvalido(errores: FieldErrors<Valores>) {
    const primero = ORDEN.find((campo) => errores[campo]);
    if (primero) setFocus(primero);
  }
  <form onSubmit={handleSubmit(alValido, alInvalido)}>
  ```
- **Envío deshabilitado SOLO mientras se envía** (`formState.isSubmitting`), nunca mientras el
  formulario tiene errores (eso le esconde al usuario CUÁL es el error — hazlo enviable siempre y
  que `handleSubmit` muestre los mensajes):
  ```tsx
  <Button type="submit" loading={formState.isSubmitting} loadingText="Entrando…">
    {es_MX.acceso.entrar}
  </Button>
  ```
- **Teclado completo**: Tab recorre los campos en orden visual, Enter en cualquier campo de una sola
  línea envía el formulario (comportamiento nativo de `<form>`, no lo rompas con `onKeyDown`
  personalizado salvo que el control lo necesite, como un `Textarea` multilínea), Escape en un
  `Dialog`/`Sheet` con formulario dentro lo cierra (lo da Radix si usas esos componentes).

## 5. Controles del sistema, nunca nativos sin estilo
`Input`, `Textarea`, `Select`, `Combobox`, `RadioGroup`, `Checkbox`, `Switch` de `@invitaciones/ui` —
todos ya aceptan `id`/`aria-invalid`/`aria-describedby` para funcionar con `Field`. Si necesitas un
control que no existe, ese es un encargo de `ui-componente`, no lo resuelvas local a mano en tu
formulario.

## 6. Pruebas
- Unitaria del formulario (Vitest + Testing Library, `user-event`): rellena, dispara un error de
  validación, confirma el mensaje visible y `aria-describedby`; confirma que el botón se deshabilita
  durante el envío y se reactiva; confirma foco en el primer campo con error tras un envío inválido.
- Si el formulario es de una pantalla del producto: e2e contra el backend real (política del
  proyecto — nunca mockees la API), con datos propios de la prueba (ver `pruebas-producto`).

## Lista de verificación
- [ ] `react-hook-form`/`zod`/`@hookform/resolvers` confirmados en el `package.json` correcto (ya están en `apps/web`).
- [ ] Patrón correcto elegido: autoguardado por campo vs envío con botón.
- [ ] Esquema Zod con reglas derivadas del esquema compartido cuando existe una contraparte de servidor.
- [ ] Validación en el borde (`mode`) y en el envío (`handleSubmit`).
- [ ] Cada mensaje de error sugiere la corrección, en es-MX, ninguno genérico.
- [ ] Etiqueta visible asociada (`htmlFor`/`id`), error por `aria-describedby`.
- [ ] Foco al primer error tras un envío inválido (`setFocus`, orden del formulario).
- [ ] Envío deshabilitado solo durante `formState.isSubmitting`, nunca por tener errores.
- [ ] Teclado completo: Tab, Enter, Escape donde aplique.
- [ ] Controles del sistema (`@invitaciones/ui`), ninguno nativo sin estilo.

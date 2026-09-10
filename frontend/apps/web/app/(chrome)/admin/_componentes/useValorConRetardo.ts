"use client";

// app/(chrome)/admin/_componentes/useValorConRetardo.ts — retardo mínimo (300 ms) antes de aplicar
// un valor de filtro de texto (`buscar` de Clientas e Invitaciones) a la petición de red. Sin esto,
// cada tecla dispara una llamada a `/product/admin/clientas`/`/invitaciones` completa; con el
// retardo, solo la ÚLTIMA tecla de una ráfaga la dispara. Puro, sin red, sin JSX: se prueba solo.
import { useEffect, useState } from "react";

export function useValorConRetardo<T>(valor: T, ms = 300): T {
  const [retardado, setRetardado] = useState(valor);

  useEffect(() => {
    const temporizador = setTimeout(() => setRetardado(valor), ms);
    return () => clearTimeout(temporizador);
  }, [valor, ms]);

  return retardado;
}

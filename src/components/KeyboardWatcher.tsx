"use client";
import { useEffect } from "react";

// iOS flyttar fasta element ovanför tangentbordet. Medan ett textfält har fokus
// sätts klassen "kb" på <html>, så att bottenmenyn kan gömmas och chattfältet
// ligga direkt ovanför tangentbordet.
const TEXT_INPUT = /^(text|search|email|number|tel|url|password|decimal)?$/;

export function KeyboardWatcher() {
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const isText = (el: EventTarget | null) =>
      el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXT_INPUT.test(el.type));
    const onIn = (e: FocusEvent) => {
      if (!isText(e.target)) return;
      clearTimeout(t);
      document.documentElement.classList.add("kb");
    };
    const onOut = () => {
      clearTimeout(t);
      // Vänta lite: fokus kan flytta direkt till ett annat fält.
      t = setTimeout(() => {
        if (!isText(document.activeElement)) document.documentElement.classList.remove("kb");
      }, 120);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      clearTimeout(t);
    };
  }, []);
  return null;
}

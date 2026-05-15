import { useState } from "react";
import type { ExtraItem, NetFromGrossData } from "./contract";

function createDefaultExtraItems(): ExtraItem[] {
  return [
    { id: crypto.randomUUID(), name: "Prim", value: "" },
    { id: crypto.randomUUID(), name: "İkramiye", value: "" },
    { id: crypto.randomUUID(), name: "Yol", value: "" },
    { id: crypto.randomUUID(), name: "Yemek", value: "" },
  ];
}

export function useDavaciUcretiState() {
  const currentYear = new Date().getFullYear();

  const [ciplakBrut, setCiplakBrut] = useState("");
  const [extraItems, setExtraItems] = useState<ExtraItem[]>(createDefaultExtraItems);
  const [notes, setNotes] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 2>(2);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedSets, setSavedSets] = useState<Array<{ id: number; name: string; data: ExtraItem[] }>>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [eklentiValues, setEklentiValues] = useState<Record<string, string[]>>({});
  const [netForGross, setNetForGross] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  return {
    ciplakBrut,
    setCiplakBrut,
    extraItems,
    setExtraItems,
    notes,
    setNotes,
    currentRecordName,
    setCurrentRecordName,
    selectedYear,
    setSelectedYear,
    selectedPeriod,
    setSelectedPeriod,
    showImportModal,
    setShowImportModal,
    showSaveModal,
    setShowSaveModal,
    savedSets,
    setSavedSets,
    activeModal,
    setActiveModal,
    eklentiValues,
    setEklentiValues,
    netForGross,
    setNetForGross,
    isSaving,
    setIsSaving,
    currentYear,
    createDefaultExtraItems,
  };
}

export type DavaciUcretiState = ReturnType<typeof useDavaciUcretiState>;

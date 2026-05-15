import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiClient } from "@/utils/apiClient";
import AddTagModal from "./AddTagModal";
import CalculationTag from "./CalculationTag";
import DraggableNote from "./DraggableNote";
import ToolsPanel from "./ToolsPanel";

interface Note {
  id: string;
  calculationId: string;
  x: number;
  y: number;
  text: string;
}

interface Tag {
  id: string;
  calculationId: string;
  color: string;
  label: string;
}

function extractIdFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && /^\d+$/.test(last)) {
    return last;
  }
  return `draft-${segments.join("-") || "home"}`;
}

const isDraft = (id: string) => id.startsWith("draft-");

export default function GlobalCalculationTools() {
  const location = useLocation();
  const calculationId = extractIdFromPath(location.pathname);

  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);

  useEffect(() => {
    if (isDraft(calculationId)) {
      setNotes([]);
      setTags([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [nRes, tRes] = await Promise.all([
          apiClient(`/api/calculation/${calculationId}/notes`),
          apiClient(`/api/calculation/${calculationId}/tags`),
        ]);
        if (!cancelled) {
          if (nRes.ok) {
            setNotes(await nRes.json());
          }
          if (tRes.ok) {
            setTags(await tRes.json());
          }
        }
      } catch {
        /* sessiz */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [calculationId]);

  const handleAddNote = useCallback(async () => {
    if (isDraft(calculationId)) {
      setNotes((prev) => [
        ...prev,
        {
          id: `draft-note-${Date.now()}`,
          calculationId,
          x: 150,
          y: 150,
          text: "",
        },
      ]);
      return;
    }
    try {
      const res = await apiClient(`/api/calculation/${calculationId}/notes`, {
        method: "POST",
        body: JSON.stringify({ x: 150, y: 150, text: "" }),
      });
      if (res.ok) {
        const newNote: Note = await res.json();
        setNotes((prev) => [...prev, newNote]);
      }
    } catch {
      /* sessiz */
    }
  }, [calculationId]);

  const handleNoteTextChange = useCallback(
    async (noteId: string, text: string) => {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, text } : n)));
      if (isDraft(calculationId)) {
        return;
      }
      try {
        await apiClient(`/api/calculation/${calculationId}/notes/${noteId}`, {
          method: "PUT",
          body: JSON.stringify({ text }),
        });
      } catch {
        /* sessiz */
      }
    },
    [calculationId],
  );

  const handleNoteDragEnd = useCallback(
    async (noteId: string, x: number, y: number) => {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, x, y } : n)));
      if (isDraft(calculationId)) {
        return;
      }
      try {
        await apiClient(`/api/calculation/${calculationId}/notes/${noteId}`, {
          method: "PUT",
          body: JSON.stringify({ x, y }),
        });
      } catch {
        /* sessiz */
      }
    },
    [calculationId],
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (isDraft(calculationId)) {
        return;
      }
      try {
        await apiClient(`/api/calculation/${calculationId}/notes/${noteId}`, { method: "DELETE" });
      } catch {
        /* sessiz */
      }
    },
    [calculationId],
  );

  const handleAddTag = useCallback(
    async (color: string, label: string) => {
      if (isDraft(calculationId)) {
        return;
      }
      try {
        const res = await apiClient(`/api/calculation/${calculationId}/tags`, {
          method: "POST",
          body: JSON.stringify({ color, label }),
        });
        if (res.ok) {
          const newTag: Tag = await res.json();
          setTags((prev) => [...prev, newTag]);
        }
      } catch {
        /* sessiz */
      }
    },
    [calculationId],
  );

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      if (isDraft(calculationId)) {
        return;
      }
      try {
        await apiClient(`/api/calculation/${calculationId}/tags/${tagId}`, { method: "DELETE" });
      } catch {
        /* sessiz */
      }
    },
    [calculationId],
  );

  return (
    <>
      {tags.length > 0 ? (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 flex flex-wrap justify-center gap-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-[90vw]">
          {tags.map((tag) => (
            <CalculationTag
              key={tag.id}
              id={tag.id}
              color={tag.color}
              label={tag.label}
              onDelete={handleDeleteTag}
            />
          ))}
        </div>
      ) : null}

      {notes.map((note) => (
        <DraggableNote
          key={note.id}
          id={note.id}
          x={note.x}
          y={note.y}
          text={note.text}
          onChange={handleNoteTextChange}
          onDragEnd={handleNoteDragEnd}
          onDelete={handleDeleteNote}
        />
      ))}

      <ToolsPanel
        calculationId={calculationId}
        onAddNote={handleAddNote}
        onAddTag={() => setShowTagModal(true)}
      />

      <AddTagModal open={showTagModal} onClose={() => setShowTagModal(false)} onAdd={handleAddTag} />
    </>
  );
}

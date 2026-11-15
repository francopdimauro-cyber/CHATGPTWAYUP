import type { EditorAction, HistoryState, ProjectDoc } from './studio-types';

export const HISTORY_LIMIT = 100;
const isSame = (a: ProjectDoc, b: ProjectDoc) => JSON.stringify(a) === JSON.stringify(b);
const commit = (state: HistoryState, next: ProjectDoc): HistoryState =>
  isSame(next, state.present) ? state :
    { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: next, future: [] };

/** El historial incluye tanto estilos como cambios estructurales del árbol de capas. */
export function historyReducer(state: HistoryState, action: EditorAction): HistoryState {
  if (action.type === 'deshacer') {
    if (!state.past.length) return state;
    const previous = state.past.at(-1)!;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
  }
  if (action.type === 'rehacer') {
    if (!state.future.length) return state;
    const [next, ...future] = state.future;
    return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: next, future };
  }
  if (action.type === 'restaurar') return { past: [], present: action.doc, future: [] };

  if (action.type === 'insertar') {
    const element = action.element;
    if (!element.id || state.present.elements[element.id]) return state;
    const sectionIndex = state.present.sections.findIndex(s => s.id === element.sectionId);
    if (sectionIndex < 0) return state;
    const sections = state.present.sections.map((section, index) => {
      if (index !== sectionIndex) return section;
      const children = [...section.children];
      const afterIndex = action.afterId ? children.indexOf(action.afterId) : -1;
      children.splice(afterIndex < 0 ? children.length : afterIndex + 1, 0, element.id);
      return { ...section, children };
    });
    return commit(state, {
      ...state.present, sections,
      elements: { ...state.present.elements, [element.id]: element },
    });
  }

  if (action.type === 'eliminar') {
    const element = state.present.elements[action.elementId];
    if (!element) return state;
    const elements = { ...state.present.elements };
    delete elements[element.id];
    const sections = state.present.sections.map(section => ({
      ...section, children: section.children.filter(id => id !== element.id),
    }));
    return commit(state, { ...state.present, elements, sections });
  }

  if (action.type === 'ordenar') {
    const element = state.present.elements[action.elementId];
    if (!element) return state;
    const section = state.present.sections.find(s => s.id === element.sectionId);
    if (!section) return state;
    const from = section.children.indexOf(element.id);
    const to = from + action.direction;
    if (from < 0 || to < 0 || to >= section.children.length) return state;
    const sections = state.present.sections.map(s => {
      if (s.id !== section.id) return s;
      const children = [...s.children];
      [children[from], children[to]] = [children[to]!, children[from]!];
      return { ...s, children };
    });
    return commit(state, { ...state.present, sections });
  }

  const element = state.present.elements[action.elementId];
  if (!element) return state;
  const nextElement = action.type === 'estilo'
    ? { ...element, style: { ...element.style, ...action.patch } }
    : { ...element, ...action.patch };
  return commit(state, {
    ...state.present, elements: { ...state.present.elements, [action.elementId]: nextElement },
  });
}
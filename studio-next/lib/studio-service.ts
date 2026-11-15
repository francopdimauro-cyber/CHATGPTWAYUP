import type { ProjectDoc } from './studio-types';

/**
 * Puerto de almacenamiento. La demo usa almacenamiento local y NO toca el Worker de WAYUP.
 * La implementación real debe adaptar el HTML y el control de versión del API de Cloudflare.
 */
export interface StudioRepository {
  getProject(id: string): Promise<ProjectDoc>;
  saveProject(doc: ProjectDoc, expectedVersion: number): Promise<{ version: number }>;
}

export const STORAGE_KEY = 'wayup-studio-next-demo-v1';

export function loadLocalDemo(fallback: ProjectDoc): ProjectDoc {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const doc: unknown = JSON.parse(raw);
    if (!doc || typeof doc !== 'object') return fallback;
    const candidate = doc as Partial<ProjectDoc>;
    if (candidate.id !== fallback.id || !candidate.elements || !Array.isArray(candidate.sections)) return fallback;
    // Compatible con documentos locales anteriores a la cabecera editable.
    // Conserva la edición del usuario y añade solo los nuevos nodos de la plantilla.
    const present=candidate as ProjectDoc;
    const elements={...fallback.elements,...present.elements};
    const sections=present.sections.map(section=>{
      const base=fallback.sections.find(item=>item.id===section.id);
      if(!base)return section;
      const required=base.children.filter(id=>!section.children.includes(id));
      return {...section,children:[...section.children,...required]};
    });
    for(const section of fallback.sections){
      if(!sections.some(item=>item.id===section.id)) sections.push(section);
    }
    return {...present,elements,sections};
  } catch { return fallback; }
}

export function persistLocalDemo(doc: ProjectDoc) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
}
/**
 * 编曲时间轴 — 将多个 Pattern 编排成完整段落
 */
const Arranger = (() => {
  const DEFAULT_SECTIONS = 8;
  let sections = [];
  let currentSection = 0;

  function init(patternCount = 4) {
    sections = Array(DEFAULT_SECTIONS)
      .fill(null)
      .map((_, i) => ({
        patternIndex: i % patternCount,
      }));
  }

  const MIN_SECTIONS = 1;

  function addSection(patternIndex) {
    const last = sections[sections.length - 1];
    const pi =
      patternIndex != null
        ? patternIndex
        : last
          ? last.patternIndex
          : 0;
    sections.push({ patternIndex: pi });
    return { count: sections.length, index: sections.length - 1 };
  }

  function setSectionPattern(sectionIndex, patternIndex) {
    if (sections[sectionIndex]) {
      sections[sectionIndex].patternIndex = patternIndex;
    }
  }

  function removeSection() {
    if (sections.length <= MIN_SECTIONS) return { ok: false, count: sections.length };
    sections.pop();
    return { ok: true, count: sections.length };
  }

  function getSection(index) {
    const s = sections[index];
    return s ? { patternIndex: s.patternIndex } : null;
  }

  function insertSectionAt(index, sectionData) {
    const data = sectionData || { patternIndex: 0 };
    const i = Math.max(0, Math.min(index, sections.length));
    sections.splice(i, 0, { patternIndex: data.patternIndex ?? 0 });
    return { ok: true, count: sections.length, index: i };
  }

  function removeSectionAt(index) {
    if (sections.length <= MIN_SECTIONS) {
      return { ok: false, count: sections.length };
    }
    if (index < 0 || index >= sections.length) {
      return { ok: false, count: sections.length };
    }
    sections.splice(index, 1);
    return { ok: true, count: sections.length };
  }

  function cycleSectionPattern(sectionIndex, patternCount) {
    const s = sections[sectionIndex];
    if (s) {
      s.patternIndex = (s.patternIndex + 1) % patternCount;
    }
  }

  function getSections() {
    return sections;
  }

  function getSectionCount() {
    return sections.length;
  }

  function exportState() {
    return { sections };
  }

  function importState(state, patternCount = 4) {
    if (state.sections && Array.isArray(state.sections)) {
      const max = Math.max(1, patternCount);
      sections = state.sections.map((s) => ({
        patternIndex: Math.min(max - 1, Math.max(0, s.patternIndex ?? 0)),
      }));
    }
  }

  init();

  return {
    init,
    addSection,
    removeSection,
    getSection,
    insertSectionAt,
    removeSectionAt,
    MIN_SECTIONS,
    setSectionPattern,
    cycleSectionPattern,
    getSections,
    getSectionCount,
    currentSection: () => currentSection,
    setCurrentSection: (i) => { currentSection = i; },
    exportState,
    importState,
  };
})();

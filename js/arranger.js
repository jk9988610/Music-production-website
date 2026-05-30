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

  function addSection() {
    const last = sections[sections.length - 1];
    sections.push({
      patternIndex: last ? last.patternIndex : 0,
    });
  }

  function setSectionPattern(sectionIndex, patternIndex) {
    if (sections[sectionIndex]) {
      sections[sectionIndex].patternIndex = patternIndex;
    }
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

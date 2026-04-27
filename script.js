/* ============================================================
   ▼ 変更点: 章と節の構造に変更
   章・節の情報を外部JSON（chapters.json）で管理し、
   チェック状態はローカルストレージで保持します。
   ============================================================ */
const CHAPTERS_DATA_URL = './chapters.json';

/* ─── 定数 ──────────────────────────────────────────────── */
const STORAGE_KEY = 'ai-passport-sections';

/* ─── 状態（State） ─────────────────────────────────────────── */
let chapters = [];

/* ─── DOM 参照 ──────────────────────────────────────────── */
const chapterList      = document.getElementById('chapter-list');
const statTotal        = document.getElementById('stat-total');
const statDone         = document.getElementById('stat-done');
const statRemaining    = document.getElementById('stat-remaining');

/* ─── 最小エラー表示（追加） ─────────────────────────────── */
function showError(msg) {
  alert(msg);
}

/* ============================================================
   ローカルストレージ（データ保存・読み込み）
   ============================================================ */

function loadTasks(chapterData) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const savedStatus = raw ? JSON.parse(raw) : {};

    chapters = chapterData.map(chapter => ({
      ...chapter,
      sections: chapter.sections.map(section => ({
        ...section,
        done: savedStatus[section.id] === true
      }))
    }));
  } catch (e) {
    showError('チェック状態の読み込みに失敗しました:', e);
    chapters = chapterData.map(chapter => ({
      ...chapter,
      sections: chapter.sections.map(section => ({ ...section, done: false }))
    }));
  }
}

function saveTasks() {
  try {
    const statusMap = {};
    chapters.forEach(chapter => {
      chapter.sections.forEach(section => {
        statusMap[section.id] = section.done;
      });
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statusMap));
  } catch (e) {
    showError('チェック状態の保存に失敗しました:', e);
  }
}

function getAllSections() {
  return chapters.flatMap(chapter => chapter.sections);
}

function getChapterDoneState(chapter) {
  return chapter.sections.length > 0 && chapter.sections.every(section => section.done);
}

function getChapterProgress(chapter) {
  const total = chapter.sections.length;
  const doneCount = chapter.sections.filter(section => section.done).length;
  return total > 0 ? Math.round((doneCount / total) * 100) : 0;
}

function getOverallProgress() {
  const allSections = getAllSections();
  const total = allSections.length;
  const doneCount = allSections.filter(section => section.done).length;
  return total > 0 ? Math.round((doneCount / total) * 100) : 0;
}

function toggleSection(sectionId, done, sectionItem) {
  const chapter = chapters.find(ch => ch.sections.some(section => section.id === sectionId));
  if (!chapter) return;

  const section = chapter.sections.find(section => section.id === sectionId);
  if (!section) return;

  section.done = done;
  saveTasks();

  sectionItem.classList.toggle('is-done', done);
  updateChapterCheckbox(chapter);
  updateStats();
  updateProgressBars();
}

function toggleChapter(chapterId, done) {
  const chapter = chapters.find(ch => ch.id === chapterId);
  if (!chapter) return;

  chapter.sections.forEach(section => {
    section.done = done;
  });

  saveTasks();
  updateChapterSectionUI(chapter, done);
  updateStats();
  updateProgressBars();
}

function updateChapterCheckbox(chapter) {
  const chapterCheckbox = document.getElementById(`chapter-checkbox-${chapter.id}`);
  if (!chapterCheckbox) return;
  chapterCheckbox.checked = getChapterDoneState(chapter);
}

function updateChapterSectionUI(chapter, done) {
  const sectionItems = chapterList.querySelectorAll(`li[data-chapter="${chapter.id}"] .section-item`);
  sectionItems.forEach(item => {
    const checkbox = item.querySelector('.section-checkbox');
    if (!checkbox) return;
    checkbox.checked = done;
    item.classList.toggle('is-done', done);
  });
}

function createSectionElement(section, chapterId) {
  const li = document.createElement('li');
  li.className = 'section-item' + (section.done ? ' is-done' : '');
  li.dataset.sectionId = section.id;
  li.dataset.chapterId = chapterId;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'section-checkbox';
  checkbox.checked = section.done;
  checkbox.setAttribute('aria-label', '節を完了にする');
  checkbox.addEventListener('click', event => event.stopPropagation());
  checkbox.addEventListener('change', () => {
    toggleSection(section.id, checkbox.checked, li);
  });

  const textSpan = document.createElement('span');
  textSpan.className = 'section-text';
  textSpan.textContent = section.text;

  li.appendChild(checkbox);
  li.appendChild(textSpan);

  return li;
}

function createChapterElement(chapter) {
  const li = document.createElement('li');
  li.className = 'chapter-card is-open';
  li.dataset.chapterId = chapter.id;

  const header = document.createElement('div');
  header.className = 'chapter-header';
  header.tabIndex = 0;
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'true');

  header.addEventListener('click', event => {
    if (event.target.closest('input')) return;
    toggleChapterCollapse(li);
  });

  header.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.target.closest('input')) return;
      toggleChapterCollapse(li);
    }
  });

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'chapter-checkbox';
  checkbox.id = `chapter-checkbox-${chapter.id}`;
  checkbox.checked = getChapterDoneState(chapter);
  checkbox.setAttribute('aria-label', '章を完了にする');
  checkbox.addEventListener('click', event => event.stopPropagation());
  checkbox.addEventListener('change', () => {
    toggleChapter(chapter.id, checkbox.checked);
  });

  const titleSpan = document.createElement('span');
  titleSpan.className = 'chapter-title';
  titleSpan.textContent = chapter.title;

  const progressWrapper = document.createElement('div');
  progressWrapper.className = 'chapter-progress';

  const progressLabel = document.createElement('span');
  progressLabel.className = 'chapter-progress-label';
  progressLabel.id = `chapter-progress-label-${chapter.id}`;
  progressLabel.textContent = `${getChapterProgress(chapter)}%`;

  const progressTrack = document.createElement('div');
  progressTrack.className = 'chapter-progress-track';
  const progressFill = document.createElement('div');
  progressFill.className = 'chapter-progress-fill';
  progressFill.id = `chapter-progress-fill-${chapter.id}`;
  progressFill.style.width = `${getChapterProgress(chapter)}%`;
  progressTrack.appendChild(progressFill);

  progressWrapper.appendChild(progressLabel);
  progressWrapper.appendChild(progressTrack);

  const toggleIcon = document.createElement('span');
  toggleIcon.className = 'chapter-toggle-icon';
  toggleIcon.textContent = '▾';

  header.appendChild(checkbox);
  header.appendChild(titleSpan);
  header.appendChild(progressWrapper);
  header.appendChild(toggleIcon);

  const sectionList = document.createElement('ul');
  sectionList.className = 'section-list';

  chapter.sections.forEach(section => {
    sectionList.appendChild(createSectionElement(section, chapter.id));
  });

  li.appendChild(header);
  li.appendChild(sectionList);

  return li;
}

function renderAllChapters() {
  chapterList.innerHTML = '';
  chapters.forEach(chapter => {
    chapterList.appendChild(createChapterElement(chapter));
  });
  updateStats();
  updateProgressBars();
}

function toggleChapterCollapse(chapterCard) {
  const isOpen = chapterCard.classList.toggle('is-open');
  const header = chapterCard.querySelector('.chapter-header');
  if (header) {
    header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
}

function updateOverallProgress() {
  const fill = document.getElementById('overall-progress-fill');
  const label = document.getElementById('overall-progress-label');
  if (!fill || !label) return;

  const percent = getOverallProgress();
  fill.style.width = `${percent}%`;
  label.textContent = `${percent}%`;
}

function updateChapterProgress(chapter) {
  const percent = getChapterProgress(chapter);
  const fill = document.getElementById(`chapter-progress-fill-${chapter.id}`);
  const label = document.getElementById(`chapter-progress-label-${chapter.id}`);
  if (!fill || !label) return;

  fill.style.width = `${percent}%`;
  label.textContent = `${percent}%`;
}

function updateProgressBars() {
  updateOverallProgress();
  chapters.forEach(updateChapterProgress);
}

function updateStats() {
  const allSections = getAllSections();
  const doneCount = allSections.filter(section => section.done).length;
  const total = allSections.length;
  statTotal.textContent = total;
  statDone.textContent = doneCount;
  statRemaining.textContent = total - doneCount;
}

async function fetchChapterData() {
  const response = await fetch(CHAPTERS_DATA_URL);
  if (!response.ok) {
    throw new Error(`章データの読み込みに失敗しました: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function initApp() {
  try {
    const chapterData = await fetchChapterData();
    loadTasks(chapterData);
    renderAllChapters();
  } catch (e) {
    showError('アプリケーションの初期化に失敗しました:', e);
  }
}

/* ============================================================
   初期化
   HTMLの読み込みが終わった瞬間に実行する
   ============================================================ */
document.addEventListener('DOMContentLoaded', initApp);

/* ============================================================
   ▼ 変更点: 初期タスクの定義
   AIパスポート試験の学習タスクをあらかじめここに定義しています。
   ユーザーが追加・削除するのではなく、最初からこの一覧が表示されます。
   ============================================================ */
const INITIAL_TASKS = [
  { id: 'task-01', text: '第1章 AI（人工知能）',       done: false },
  { id: 'task-02', text: '第2章 生成AI',              done: false },
  { id: 'task-03', text: '第3章 AIの活用事例',         done: false },
  { id: 'task-04', text: '第4章 AIのリスクと対策',     done: false },
  { id: 'task-05', text: '第5章 AIに関する法律・倫理', done: false },
];

/* ─── 定数 ──────────────────────────────────────────────── */
// ローカルストレージに保存するときのキー名
// ▼ 変更点: キー名をアプリ内容に合わせて変更
const STORAGE_KEY = 'ai-passport-tasks';

/* ─── 状態（State） ─────────────────────────────────────── */
// 現在のタスク一覧を保持する配列
let tasks = [];

/* ─── DOM 参照 ──────────────────────────────────────────── */
// HTMLの要素をJavaScriptから操作するための変数
const taskList      = document.getElementById('task-list');    // タスク一覧のul要素
const statTotal     = document.getElementById('stat-total');   // 「合計」の数値表示
const statDone      = document.getElementById('stat-done');    // 「完了」の数値表示
const statRemaining = document.getElementById('stat-remaining'); // 「残り」の数値表示



/* ============================================================
   ローカルストレージ（データ保存・読み込み）
   ============================================================ */

/**
 * ローカルストレージからチェック状態（完了/未完了）を読み込む
 *
 * ▼ 変更点:
 *   以前はタスク全体をローカルストレージから復元していましたが、
 *   タスク自体はINITIAL_TASKSで固定になったため、
 *   保存するのは「各タスクのチェック状態（完了かどうか）」だけに変更しました。
 *
 * 仕組み:
 *   { "task-01": true, "task-03": true } のような形式で保存し、
 *   INITIAL_TASKSのタスクにチェック状態を反映させます。
 */
function loadTasks() {
  try {
    // ローカルストレージから保存済みのチェック状態を取得する
    const raw = localStorage.getItem(STORAGE_KEY);
    const savedStatus = raw ? JSON.parse(raw) : {}; // 保存がなければ空のオブジェクト

    // INITIAL_TASKSをベースに、保存済みのチェック状態を反映してtasksを作成する
    tasks = INITIAL_TASKS.map(task => ({
      id:   task.id,
      text: task.text,
      // 保存済みの状態があればそれを使い、なければ false（未完了）にする
      done: savedStatus[task.id] === true
    }));

  } catch (e) {
    // 読み込みに失敗した場合はINITIAL_TASKSをそのまま使う
    console.error('チェック状態の読み込みに失敗しました:', e);
    tasks = INITIAL_TASKS.map(task => ({ ...task }));
  }
}

/**
 * 各タスクのチェック状態をローカルストレージに保存する
 *
 * ▼ 変更点:
 *   以前はタスク全体（テキスト・ID・日時など）を保存していましたが、
 *   タスク内容は固定になったため、チェック状態だけを保存する形に変更しました。
 */
function saveTasks() {
  try {
    // { "task-01": true, "task-03": false, ... } の形式で保存する
    const statusMap = {};
    tasks.forEach(task => {
      statusMap[task.id] = task.done;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statusMap));
  } catch (e) {
    console.error('チェック状態の保存に失敗しました:', e);
  }
}

/* ============================================================
   タスク操作
   ============================================================ */

/**
 * チェックボックスの変更時に呼ばれる
 * タスクの完了/未完了を切り替える
 *
 * @param {string} id       - 切り替えるタスクのID
 * @param {boolean} done    - チェックONならtrue、OFFならfalse
 * @param {HTMLElement} li  - 対応するli要素（見た目の変更に使う）
 */
function toggleTask(id, done, li) {
  // tasksの配列から対象のタスクを探して状態を更新する
  const task = tasks.find(t => t.id === id);
  if (!task) return; // 見つからなければ何もしない

  task.done = done; // 状態を更新

  // ローカルストレージに保存する
  saveTasks();

  // 見た目を更新（is-doneクラスのON/OFFで取り消し線やグレー表示が切り替わる）
  li.classList.toggle('is-done', done);

  // 統計と進捗バーを更新する
  updateStats();
  updateProgressBar();
}


/* ============================================================
   DOM 操作（画面の描画）
   ============================================================ */

/**
 * タスク1件分のHTML要素（li）を作成して返す
 *
 * ▼ 変更点:
 *   以前は「削除ボタン」も生成していましたが、削除機能が不要になったため削除しました。
 *   チェックボックスとテキスト、番号バッジのみを生成します。
 *
 * @param {Object} task   - タスクオブジェクト { id, text, done }
 * @param {number} index  - 表示順の番号（0始まり）
 * @returns {HTMLElement} - 作成したli要素
 */
function createTaskElement(task, index) {
  // liタグを作成し、完了状態ならis-doneクラスを付ける
  const li = document.createElement('li');
  li.className = 'task-item' + (task.done ? ' is-done' : '');
  li.dataset.id = task.id; // タスクIDをdata属性に保存

  /* ── 番号バッジ（例: 01, 02, ...） ── */
  const numSpan = document.createElement('span');
  numSpan.className = 'task-num';
  // 1桁の数字は頭に0を付けて2桁表示にする（例: 1 → "01"）
  numSpan.textContent = String(index + 1).padStart(2, '0');

  /* ── チェックボックス ── */
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.checked = task.done; // 保存済みの状態を反映
  checkbox.setAttribute('aria-label', '完了にする');

  // チェックボックスが変更されたときにtoggleTask()を呼ぶ
  checkbox.addEventListener('change', () => {
    toggleTask(task.id, checkbox.checked, li);
  });

  /* ── タスクのテキスト ── */
  const textSpan = document.createElement('span');
  textSpan.className = 'task-text';
  // textContentを使うことでHTMLタグを文字として扱い、セキュリティを確保する
  textSpan.textContent = task.text;


  // 作成した要素をliに追加して返す
  li.appendChild(numSpan);
  li.appendChild(checkbox);
  li.appendChild(textSpan);

  return li;
}

/**
 * 全タスクを画面に描画する
 * ページ読み込み時に1回だけ呼ばれる
 */
function renderAllTasks() {
  // 一覧をいったん空にしてから再描画する
  taskList.innerHTML = '';

  tasks.forEach((task, index) => {
    const taskEl = createTaskElement(task, index);
    taskList.appendChild(taskEl);
  });

  // 統計と進捗バーを更新する
  updateStats();
  updateProgressBar();
}

/**
 * ▼ 変更点: 進捗バーを更新する関数を追加
 * 完了タスク数に応じてプログレスバーの幅を変化させる
 */
function updateProgressBar() {
  const total     = tasks.length;
  const doneCount = tasks.filter(t => t.done).length;

  // 進捗バーの要素を取得する
  const fill  = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');

  if (!fill || !label) return; // 要素が存在しない場合は何もしない

  // 完了率を計算する（0〜100%）
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // バーの幅と表示テキストを更新する
  fill.style.width  = percent + '%';
  label.textContent = percent + '%';
}

/**
 * ヘッダーの統計（合計・完了・残り）を更新する
 */
function updateStats() {
  const total     = tasks.length;
  const doneCount = tasks.filter(t => t.done).length;
  const remaining = total - doneCount;

  statTotal.textContent     = total;
  statDone.textContent      = doneCount;
  statRemaining.textContent = remaining;
}


/* ============================================================
   ▼ 変更点: イベントリスナーの整理
   以前は addBtn（追加ボタン）と taskInput（テキスト入力欄）に
   イベントリスナーを登録していましたが、両方とも削除しました。
   チェックボックスのイベントは createTaskElement() 内で登録しています。
   ============================================================ */

/* ============================================================
   初期化
   ページが完全に読み込まれてから実行する
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // ① ローカルストレージからチェック状態を読み込む
  loadTasks();

  // ② 進捗バーをHTMLに動的に挿入する
  //    （HTMLファイルに直接書かず、JavaScriptで生成することで管理しやすくする）
  const progressHTML = `
    <div class="progress-bar-wrapper" id="progress-wrapper">
      <div class="progress-bar-label">
        <span>学習進捗</span>
        <span id="progress-label">0%</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" id="progress-fill"></div>
      </div>
    </div>
  `;
  // タスク一覧の直前に進捗バーを挿入する
  taskList.insertAdjacentHTML('beforebegin', progressHTML);

  // ③ タスク一覧を画面に描画する
  renderAllTasks();
});
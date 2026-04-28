/* ============================================================
   script.js — AIパスポート 学習管理 JavaScript
   ============================================================ */

'use strict';

/* ============================================================
   学習データの読み込み
   章と節の情報は chapters.json で管理しています。
   内容を変更したい場合は chapters.json を編集してください。

   chapters.json のデータ構造:
   [
     {
       "id"      : "ch1",            // 章の識別子（ローカルストレージのキーに使用）
       "title"   : "第1章 ...",      // 章のタイトル
       "sections": [                 // 節の配列
         { "id": "ch1-s1", "text": "..." }
       ]
     },
     ...
   ]
   ============================================================ */

/* ─── 定数 ──────────────────────────────────────────────── */
/** chapters.jsonというファイルを使う */
const CHAPTERS_JSON_PATH = 'chapters.json';

/** ローカルストレージへの保存キー */
const STORAGE_KEY = 'ai-passport-tasks';

/* ============================================================
   ローカルストレージ（チェック状態の保存・読み込み）

   保存形式（節のチェック状態のみを保存する）:
     { "ch1-s1": true, "ch1-s2": false, "ch2-s1": true, ... }

   ※ 章のチェックボックスは「節が全部ONかどうか」を表示するだけなので
      ローカルストレージには保存しない。
      ページ再読み込み時に節の状態から自動計算して復元する。
   ============================================================ */
   function showError(msg) {
    alert(msg);
   }

/**
 * 節のチェック状態をローカルストレージから読み込む
 * @returns {Object} チェック状態のオブジェクト
 */
function loadCheckStatus() { // 読み込み
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // 文字列をオブジェクトに変換して返す
    return raw ? JSON.parse(raw) : {}; // データがないときは空オブジェクトを返す
  } catch (e) {
    showError('チェック状態の読み込みに失敗しました:', e);
    return {};
  }
}

/**
 * 節のチェック状態をローカルストレージに保存する
 * @param {Object} status - 節IDをキー、チェック済みかどうかを値とするオブジェクト
 */
function saveCheckStatus(status) { // 保存
  try {
    // オブジェクトを文字列に変換して保存する
    localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
  } catch (e) {
    showError('チェック状態の保存に失敗しました:', e);
  }
}

/* ============================================================
   chapters.json の読み込み

   fetch API を使って JSON ファイルを非同期で取得する。
   ローカルファイルで動作させる場合は HTTPサーバー経由で開くこと
   （例: VS Code の Live Server, python -m http.server など）。
   ============================================================ */

/**
 * chapters.json を fetch で読み込み、章データの配列を返す
 * @returns {Promise<Array>} 章データの配列
 */
async function loadChapters() { // chapters.json を読み込む
  const response = await fetch(CHAPTERS_JSON_PATH);
  if (!response.ok) { // HTTPエラーが発生した場合は例外を投げる
    throw new Error(`chapters.json の読み込みに失敗しました: ${response.status} ${response.statusText}`);
  }
  const chapters = await response.json(); // JSON文字列をオブジェクトに変換する
  return chapters;
}

/* ============================================================
   進捗計算
   ※ 進捗率は「節のチェック数」のみで計算する。
      章のチェックボックスは進捗計算に含めない。
   ============================================================ */

/**
 * 1章分の進捗率（0〜100%）を計算する
 *
 * 計算式:
 *   チェック済みの節数 ÷ その章の総節数 × 100
 *
 * 例: 節が4つあり2つチェック済み → 2 ÷ 4 × 100 = 50%
 *
 * @param {Object} chapter - 章データ
 * @param {Object} status  - 節のチェック状態オブジェクト
 * @returns {number} 0〜100 の進捗率（整数）
 */
function calcChapterProgress(chapter, status) {
  const totalSections   = chapter.sections.length;   /* 節の合計数 */
  const checkedSections = chapter.sections.filter(
    sec => status[sec.id]                             /* チェック済みの節だけ抽出 */
  ).length;

  /* 節が0のとき（定義ミス防止）は0%を返す */
  if (totalSections === 0) return 0;
// 小数点以下切り捨てで整数にする
  return Math.floor((checkedSections / totalSections) * 100); 
}

/**
 * 全体の進捗率（0〜100%）を計算する
 *
 * 計算式:
 *   全節のうちチェック済みの節数 ÷ 全節数 × 100
 *
 * @param {Array}  chapters - 章データの配列（JSONから読み込んだもの）
 * @param {Object} status   - 節のチェック状態オブジェクト
 * @returns {number} 0〜100 の進捗率（整数）
 */
function calcTotalProgress(chapters, status) {
  /* 全章の節数・チェック済み節数を合計する */
  let totalSections   = 0; // 全節数の合計
  let checkedSections = 0; // チェック済みの節数の合計

  chapters.forEach(chapter => { // 章を1つずつ処理する
    totalSections   += chapter.sections.length; // 節の数を足していく
    checkedSections += chapter.sections.filter(sec => status[sec.id]).length;
  }); // チェック済みの節だけを抽出して数える 

  // 節が0のとき（定義ミス防止）は0%を返す
  if (totalSections === 0) return 0;

  return Math.floor((checkedSections / totalSections) * 100);
}

/**
 * ある章の配下の節がすべてチェック済みかどうかを返す
 * 章チェックボックスのON/OFF状態の判定に使う
 *
 * @param {Object} chapter - 章データ
 * @param {Object} status  - 節のチェック状態オブジェクト
 * @returns {boolean}
 */
function isAllSectionsDone(chapter, status) {
  /* 節が1つもない場合は false とする */
  if (chapter.sections.length === 0) return false;
  /* すべての節がチェック済みなら true */
  return chapter.sections.every(sec => status[sec.id]);
}

/* ============================================================
   画面の更新（統計・進捗バー・章ミニバー・章チェックボックス）
   ============================================================ */

/**
 * ヘッダーの統計（全節数・完了・残り）を更新する
 * ※ 章のチェックボックスは統計に含めない（節の数のみカウントする）
 *
 * @param {Array}  chapters - 章データの配列
 * @param {Object} status   - 節のチェック状態オブジェクト
 */
function updateStats(chapters, status) {
  let total = 0; //カウント用の変数を初期化する
  let done  = 0;

  // 二重ループで全章・全節を走査して、total と done を数える
  chapters.forEach(chapter => { // 章を1つずつ処理する
    chapter.sections.forEach(sec => { // 節を1つずつ処理する
      total++;
      if (status[sec.id]) done++;
    });
  });
// HTMLに反映
  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-done').textContent      = done;
  document.getElementById('stat-remaining').textContent = total - done;
}

/**
 * 全体の進捗バーを更新する
 * @param {Array}  chapters - 章データの配列
 * @param {Object} status   - 節のチェック状態オブジェクト
 */
function updateProgressBar(chapters, status) {
  const pct   = calcTotalProgress(chapters, status); //計算
// HTMLの要素を取得して更新する
  const fill  = document.getElementById('progress-fill'); 
  const label = document.getElementById('progress-label');
  // 見た目を更新
  if (fill)  fill.style.width  = pct + '%';
  if (label) label.textContent = pct + '%';
}

/**
 * 章ごとのミニ進捗バーを更新する
 * @param {Object} chapter - 章データ
 * @param {Object} status  - 節のチェック状態オブジェクト
 */
function updateChapterProgressBar(chapter, status) {
  const pct   = calcChapterProgress(chapter, status); // 計算
  // 章ごとのミニ進捗バーの要素をIDから取得して更新する
  const fill  = document.getElementById('chapter-progress-fill-' + chapter.id);
  const label = document.getElementById('chapter-progress-pct-'  + chapter.id);
  // 見た目を更新
  if (fill)  fill.style.width  = pct + '%';
  if (label) label.textContent = pct + '%';
}

/**
 * すべての進捗・統計・章チェックボックスをまとめて更新する
 * チェックボックスが変化するたびにこの関数を呼ぶ
 *
 * @param {Array}  chapters        - 章データの配列
 * @param {Object} status          - 節のチェック状態オブジェクト
 * @param {Map}    chapterElementMap - 章IDとDOM要素の対応マップ
 */
function updateAllDisplay(chapters, status, chapterElementMap) {
  /* 統計（個数）を更新 */
  updateStats(chapters, status);

  /* 全体進捗バーを更新 */
  updateProgressBar(chapters, status);

  /* 各章のミニ進捗バー・章チェックボックス・is-done クラスを更新 */
  chapters.forEach(chapter => {
    updateChapterProgressBar(chapter, status);

    /* 節が全部チェック済みかどうかを判定する */
    const allDone = isAllSectionsDone(chapter, status);

    /* chapterElementMap から章カードの DOM 情報を取得する */
    const chEls = chapterElementMap.get(chapter.id);
    if (!chEls) return;

    /* 章チェックボックスを自動更新する */
    chEls.chkEl.checked = allDone;

    /* 見た目を更新 */
    chEls.card.classList.toggle('is-done', allDone);
  });
}

/* ============================================================
   DOM 生成（HTMLを動的に作成する）
   ============================================================ */

/**
 * 全体進捗バーの HTML 要素を生成して返す
 * @returns {HTMLElement}
 */
function createProgressBarElement() { 
  const wrapper = document.createElement('div'); // 外枠
  wrapper.className = 'progress-bar-wrapper';
  // 内部のHTMLをまとめてセットする（ラベルとバーの構造）
  wrapper.innerHTML = ` 
    <div class="progress-bar-label">
      <span>学習進捗（全体）</span>
      <span id="progress-label">0%</span>
    </div>
    <div class="progress-bar-track">
      <div class="progress-bar-fill" id="progress-fill"></div>
    </div>
  `;
  return wrapper;
}

/**
 * 章カード 1枚分の HTML 要素を生成して返す
 *
 * 構造:
 *   .chapter-card
 *     .chapter-header  ← クリックで開閉（チェックボックスは独立して動作）
 *       チェックボックス / タイトル / ミニ進捗バー / 矢印アイコン
 *     .section-list-wrapper  ← アコーディオン部分
 *       ul.section-list
 *         li.section-item × 節の数
 *
 * @param {Array}  chapters        - 章データの配列（updateAllDisplay に渡すため）
 * @param {Object} chapter         - この章のデータ
 * @param {Object} status          - 節のチェック状態オブジェクト
 * @param {Map}    chapterElementMap - 章IDとDOM要素の対応マップ（更新用）
 * @returns {HTMLElement}
 */
function createChapterCard(chapters, chapter, status, chapterElementMap) {

  /* ── 章カードの外枠 ── */
  const card = document.createElement('div');
  card.className = 'chapter-card';

  /* ── 章ヘッダー（クリックで開閉する行） ── */
  const header = document.createElement('div');
  header.className = 'chapter-header';
  header.setAttribute('aria-expanded', 'false'); // アクセシビリティのため、初期状態は「閉じている」とする

  /* 章のチェックボックス
     節が全部チェック済みのとき checked = true にする */
  const chapterCheckbox = document.createElement('input');
  chapterCheckbox.type      = 'checkbox';
  chapterCheckbox.className = 'chapter-checkbox';
  // 章のチェック状態は「配下の節が全部チェック済みかどうか」で決まるので、初期状態を計算してセットする
  chapterCheckbox.checked   = isAllSectionsDone(chapter, status);
  chapterCheckbox.setAttribute('aria-label', chapter.title + ' 全節完了');

  /* 章のタイトルテキスト */
  const titleSpan = document.createElement('span');
  titleSpan.className   = 'chapter-title';
  titleSpan.textContent = chapter.title; // JSONのデータを表示する

  /* 章ごとのミニ進捗バー（節のチェック数で計算） */
  const progressWrap = document.createElement('div');
  progressWrap.className = 'chapter-progress-wrap';
  //章ごとに違うバーを作るためにIDに章IDを付与する
  progressWrap.innerHTML = `
    <span class="chapter-progress-pct" id="chapter-progress-pct-${chapter.id}">0%</span>
    <div class="chapter-progress-track">
      <div class="chapter-progress-fill" id="chapter-progress-fill-${chapter.id}"></div>
    </div>
  `;

  /* 開閉の矢印アイコン */
  const arrow = document.createElement('span');
  arrow.className = 'chapter-arrow';
  // 見た目用のSVGをセットする（下向きの矢印）
  arrow.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;

  /* ヘッダーに各要素を追加 */
  header.appendChild(chapterCheckbox);
  header.appendChild(titleSpan);
  header.appendChild(progressWrap);
  header.appendChild(arrow);

  /* ── 節リストのアコーディオンエリア ── */
  const sectionWrapper = document.createElement('div'); // 開閉する部分の外枠
  sectionWrapper.className = 'section-list-wrapper';

  const sectionList = document.createElement('ul'); // 節のリスト
  sectionList.className = 'section-list';

  /* 節ごとのDOM要素を記録するマップ（章チェック時の一括操作に使う） */
  const sectionElementMap = new Map();

  /* 節アイテムを1件ずつ生成してリストに追加する */
  chapter.sections.forEach((sec, index) => {
    const { li, checkbox: secChk } = createSectionItem(
      chapters, chapter, sec, index, status, chapterElementMap
    );
    sectionElementMap.set(sec.id, { li, chkEl: secChk });
    sectionList.appendChild(li);
  });

  sectionWrapper.appendChild(sectionList);
  card.appendChild(header);
  card.appendChild(sectionWrapper);

  /* chapterElementMap にこの章のDOM情報を登録する
     他の関数（updateAllDisplay）から参照できるようにするため */
  chapterElementMap.set(chapter.id, {
    card,
    chkEl: chapterCheckbox,
    sectionElementMap
  });

  /* 初期表示: 全節チェック済みなら is-done クラスを付ける */
  if (isAllSectionsDone(chapter, status)) {
    card.classList.add('is-done');
  }

  /* ─────────────────────────────────────────────────────────
     章ヘッダーのクリックイベント（開閉）

     チェックボックスをクリックしたときは開閉しない。
     それ以外の場所（タイトル・矢印・余白など）をクリックしたときだけ開閉する。
     ───────────────────────────────────────────────────────── */
  header.addEventListener('click', (e) => {
    /* クリック対象がチェックボックス自身の場合は、開閉処理をスキップする */
    if (e.target === chapterCheckbox) return;

    /* カードに is-open クラスをトグルして開閉する */
    const isOpen = card.classList.toggle('is-open');
    header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  /* ─────────────────────────────────────────────────────────
     章チェックボックスの変更イベント

     章チェックをONにしたら → 配下の全節をONにする
     章チェックをOFFにしたら → 配下の全節をOFFにする

     節のチェック状態を変えた結果として進捗率も変わる。
     ───────────────────────────────────────────────────────── */
     // 章チェックボックスの状態が変わったときの処理
     chapterCheckbox.addEventListener('change', () => {
    const currentStatus = loadCheckStatus(); // 最新のチェック状態を読み込む

    /* 章ON→全節ON、章OFF→全節OFF */
    chapter.sections.forEach(sec => {
      /* ① statusオブジェクトを更新する */
      currentStatus[sec.id] = chapterCheckbox.checked;

      /* ② 節のHTMLを取得 */
      const secEls = sectionElementMap.get(sec.id);
      if (secEls) {
        // 節のチェックボックスを更新する
        secEls.chkEl.checked = chapterCheckbox.checked;

        /* ③ みためを更新 */
        secEls.li.classList.toggle('is-done', chapterCheckbox.checked);
      }
    });

    /* ④ ローカルストレージに保存する */
    saveCheckStatus(currentStatus);

    /* ⑤ 進捗バー・統計を再計算して表示を更新する */
    updateAllDisplay(chapters, currentStatus, chapterElementMap);
  });

  return card;
}

/**
 * 節アイテム 1件分の HTML 要素を生成して返す
 *
 * @param {Array}  chapters        - 章データの配列（updateAllDisplay に渡すため）
 * @param {Object} chapter         - 親の章データ
 * @param {Object} sec             - 節データ { id, text }
 * @param {number} index           - 節のインデックス（番号表示に使用）
 * @param {Object} status          - 節のチェック状態オブジェクト
 * @param {Map}    chapterElementMap - 章IDとDOM要素の対応マップ
 * @returns {{ li: HTMLElement, checkbox: HTMLInputElement }}
 */
function createSectionItem(chapters, chapter, sec, index, status, chapterElementMap) {

  /* 節アイテムのルート要素 */
  const li = document.createElement('li');
  // すでにチェック済みの節なら is-done クラスを付ける（初期表示）
  li.className = 'section-item' + (status[sec.id] ? ' is-done' : '');

  /* 節の番号バッジ（例: 1-1, 1-2） */
  const numSpan = document.createElement('span');
  numSpan.className   = 'section-num';
  /* ch1 → 1、ch2 → 2 のように数字部分だけを取り出す */
  const chapterNum    = chapter.id.replace('ch', '');
  numSpan.textContent = chapterNum + '-' + (index + 1);

  /* 節のチェックボックス */
  const checkbox = document.createElement('input');
  checkbox.type      = 'checkbox';
  checkbox.className = 'section-checkbox';
  checkbox.checked   = !!status[sec.id]; /* !! で boolean 型に変換 */
  checkbox.setAttribute('aria-label', sec.text + ' 完了');

  /* 節のテキスト */
  const textSpan = document.createElement('span');
  textSpan.className   = 'section-text';
  textSpan.textContent = sec.text; // JSONのデータを表示する

  li.appendChild(numSpan);
  li.appendChild(checkbox);
  li.appendChild(textSpan);

  /* ─────────────────────────────────────────────────────────
     節チェックボックスの変更イベント

     1. 節のチェック状態を保存する
     2. 節アイテムの見た目（取り消し線）を更新する
     3. updateAllDisplay() を呼んで以下をまとめて更新する:
        - 章チェックボックス（全節ONなら章もON、1つでもOFFなら章もOFF）
        - 章ごとのミニ進捗バー
        - 全体の進捗バー
        - ヘッダーの統計
     ───────────────────────────────────────────────────────── */
  checkbox.addEventListener('change', () => {
    const currentStatus = loadCheckStatus();

    /* ① 節のチェック状態を更新する */
    currentStatus[sec.id] = checkbox.checked;

    /* ② ローカルストレージに保存する */
    saveCheckStatus(currentStatus);

    /* ③ 節アイテムの is-done クラスを切り替える */
    li.classList.toggle('is-done', checkbox.checked);

    /* ④ 全体の表示（進捗バー・統計・章チェック）を更新する */
    updateAllDisplay(chapters, currentStatus, chapterElementMap);
  });

  return { li, checkbox };
}

/* ============================================================
   初期化
   DOMContentLoaded 後に chapters.json を fetch で読み込み、
   読み込み完了後に UI を構築する。
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {

  /* ① chapters.json を読み込む */
  let chapters;
  try {
    chapters = await loadChapters();
  } catch (e) {
    showError('chapters.json の読み込みに失敗しました。');
    /* 読み込み失敗時はエラーメッセージをページに表示して処理を止める */
    const chapterListEl = document.getElementById('chapter-list');
    chapterListEl.innerHTML =
      '<p style="color:#f55;font-family:monospace;padding:16px;">' +
      '⚠️ chapters.json の読み込みに失敗しました。<br>' +
      'HTTPサーバー経由でページを開いているか確認してください。</p>';
    return;
  }

  /* ② ローカルストレージから節のチェック状態を読み込む */
  const status = loadCheckStatus();

  /* ③ 全体の進捗バーを生成して、chapter-list の直前に挿入する */
  const chapterListEl = document.getElementById('chapter-list');
  const progressBar   = createProgressBarElement();
  chapterListEl.before(progressBar);

  /* ④ 章カードとDOM要素の対応を管理するマップを作成する
        Map のキー: 章ID（例: 'ch1'）
        Map の値 : { card, chkEl, sectionElementMap } */
  const chapterElementMap = new Map();

  /* ⑤ 章リストのコンテナを作成する */
  const listContainer = document.createElement('div');
  listContainer.className = 'chapter-list';

  /* ⑥ 各章カードを生成してリストに追加する
        chapters 配列は JSON から読み込んだデータをそのまま使用する */
  chapters.forEach(chapter => {
    const card = createChapterCard(chapters, chapter, status, chapterElementMap);
    listContainer.appendChild(card);
  });

  /* ⑦ 章リストをページに挿入する */
  chapterListEl.appendChild(listContainer);

  /* ⑧ ページ読み込み時点のチェック状態で統計・進捗バーを初期表示する */
  updateAllDisplay(chapters, status, chapterElementMap);
});

/**
 * updateAllDisplay
 ├─① updateStats（数字）
 ├─② updateProgressBar（全体バー）
 └─③ 各章ループ
      ├─③-1 章進捗バー更新
      ├─③-2 全節完了か判定
      ├─③-3 MapからDOM取得
      ├─③-4 章チェック更新
      └─③-5 見た目更新
 */
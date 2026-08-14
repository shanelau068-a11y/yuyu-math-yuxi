const STORE_KEY = "yuyu-math-yuxi-v1";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function getState() {
  const s = loadState();
  if (!s.lessons) s.lessons = {};
  return s;
}

function lessonProgress(id) {
  return getState().lessons[id] || {};
}

function isLessonDone(id) {
  const p = lessonProgress(id);
  return !!(p.learn && p.examples && p.practice);
}

function lessonStatus(id) {
  const p = lessonProgress(id);
  const n = ["learn", "examples", "practice"].filter((k) => p[k]).length;
  if (n === 3) return "done";
  if (n > 0 || p.opened) return "doing";
  return "todo";
}

function markOpened(id) {
  const s = getState();
  s.lessons[id] = s.lessons[id] || {};
  s.lessons[id].opened = true;
  s.lastLesson = id;
  saveState(s);
}

function markStep(id, step) {
  const s = getState();
  s.lessons[id] = s.lessons[id] || {};
  s.lessons[id][step] = true;
  s.lessons[id].opened = true;
  s.lastLesson = id;
  s.lastStep = step;
  saveState(s);
}

function allLessons() {
  return YUXI.units.flatMap((u) => u.lessons);
}

function findLesson(id) {
  return allLessons().find((l) => l.id === id);
}

function findUnit(unitId) {
  return YUXI.units.find((u) => u.id === unitId);
}

function nextIncomplete() {
  return allLessons().find((l) => !isLessonDone(l.id)) || allLessons()[0];
}

function doneCount() {
  return allLessons().filter((l) => isLessonDone(l.id)).length;
}

function unitDoneCount(unit) {
  return unit.lessons.filter((l) => isLessonDone(l.id)).length;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.88;
  window.speechSynthesis.speak(u);
}

function stopSpeak() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function parseRoute() {
  const raw = (location.hash || "#/").replace(/^#/, "") || "/";
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] === "unit" && parts[1]) return { page: "unit", unitId: parts[1] };
  if (parts[0] === "lesson" && parts[1]) {
    return { page: "lesson", id: parts[1], step: parts[2] || "learn" };
  }
  return { page: "home" };
}

function go(hash) {
  stopSpeak();
  location.hash = hash;
}

function topbar({ back, title, eyebrow, reset }) {
  const left = back
    ? `<button class="back-btn" data-go="${back}" aria-label="返回">‹</button>`
    : `<div class="brand-mark">4×</div>`;
  const resetBtn = reset
    ? `<button class="icon-button" id="resetProgress" aria-label="重置进度">↺</button>`
    : `<span style="width:44px"></span>`;
  return `<header class="topbar">${left}<div class="grow"><p class="eyebrow">${eyebrow}</p><h1 class="page-title">${title}</h1></div>${resetBtn}</header>`;
}

function bindNav(root) {
  root.querySelectorAll("[data-go]").forEach((b) => {
    b.onclick = () => go(b.dataset.go);
  });
  const reset = root.querySelector("#resetProgress");
  if (reset) {
    reset.onclick = () => {
      if (confirm("把进度轻轻清掉，再从头玩一次？")) {
        localStorage.removeItem(STORE_KEY);
        sessionStorage.clear();
        go("#/");
        render();
      }
    };
  }
}

function renderHome() {
  const total = allLessons().length;
  const done = doneCount();
  const last = getState().lastLesson;
  const lastLesson = last && findLesson(last);
  const today = nextIncomplete();
  const allDone = done === total;
  const lastStep = getState().lastStep;
  const contHash =
    lastLesson && lastStep && lastStep !== "learn"
      ? `#/lesson/${lastLesson.id}/${lastStep}`
      : lastLesson
        ? `#/lesson/${lastLesson.id}`
        : "";
  const units = YUXI.units
    .map(
      (u) => `<button class="unit-card" data-go="#/unit/${u.id}">
      <span class="num">${u.n}</span>
      <span><strong>${u.title}</strong><small>${u.goal}</small></span>
      <span class="meta">${unitDoneCount(u)}/${u.lessons.length}</span>
    </button>`
    )
    .join("");
  return `${topbar({ eyebrow: "2026 秋 · 人教版四年级上册", title: "语语预习家", reset: true })}
    <section class="hero-card">
      <div><span class="unit-tag">数学预习小站</span>
      <h2>你好，语语</h2>
      <p>每次 10 到 15 分钟。看一看要点，跟一例题，练一练，就很好。</p></div>
      <div class="sun">＋</div>
    </section>
    <div class="home-actions">
      <button class="primary" data-go="#/lesson/${today.id}">${allDone ? "再练一课" : "今日学习"}</button>
      <button class="secondary" ${lastLesson ? `data-go="${contHash}"` : "disabled"}>${lastLesson ? "继续上次" : "还没开始"}</button>
    </div>
    <section class="panel">
      <div class="section-heading"><div><p class="eyebrow">学习足迹</p><h2>慢慢来就很棒</h2></div><strong>${done} / ${total}</strong></div>
      <div class="progress-track"><div style="width:${(done / total) * 100}%"></div></div>
      <p class="muted">一课里「学什么、看例题、练一练」都点过，这里就会亮一格。进度只存在这台手机里。</p>
    </section>
    <section class="panel">
      <div class="section-heading"><div><p class="eyebrow">课程地图</p><h2>先选一个单元</h2></div><span class="counter">9 单元</span></div>
      <div class="unit-grid">${units}</div>
    </section>
    <footer>预习讲解与练习为原创。请以纸质课本为准 · 无人教版插图、无 PDF 扫描</footer>`;
}

function renderUnit(unitId) {
  const unit = findUnit(unitId);
  if (!unit) return renderHome();
  const items = unit.lessons
    .map((l) => {
      const st = lessonStatus(l.id);
      const label = st === "done" ? "学完啦" : st === "doing" ? "进行中" : l.kindLabel;
      return `${l.group ? `<p class="group-label">${l.group}</p>` : ""}
        <button class="lesson-link" data-go="#/lesson/${l.id}">
          <span class="dot ${st}"></span>
          <span><strong>${l.title}</strong><small>${label}</small></span>
          <span class="arrow">›</span>
        </button>`;
    })
    .join("");
  return `${topbar({ back: "#/", eyebrow: unit.name, title: unit.title, reset: true })}
    <section class="hero-card">
      <div><span class="unit-tag">${unit.name}</span>
      <h2>${unit.short}</h2>
      <p>${unit.goal}</p></div>
      <div class="sun">${unit.emoji}</div>
    </section>
    <section class="panel">
      <div class="section-heading"><div><p class="eyebrow">本单元</p><h2>选一课开始</h2></div>
      <strong>${unitDoneCount(unit)} / ${unit.lessons.length}</strong></div>
      <div class="lesson-list">${items}</div>
    </section>`;
}

function tabbar(lesson, step) {
  const tabs = [
    ["learn", "🎯", "学什么"],
    ["examples", "例", "看例题"],
    ["practice", "练", "练一练"],
  ];
  return `<nav class="tabbar">${tabs
    .map(
      ([id, icon, name]) =>
        `<button class="${step === id ? "active" : ""}" data-go="#/lesson/${lesson.id}/${id}"><span>${icon}</span>${name}</button>`
    )
    .join("")}</nav>`;
}

function renderLearn(lesson) {
  const p = lessonProgress(lesson.id);
  const goals = lesson.goals.map((g) => `<li>${g}</li>`).join("");
  const points = lesson.points
    .map(
      (pt) => `<article class="point-card"><h4>${pt.title}</h4><p>${pt.body}</p>${pt.visual || ""}</article>`
    )
    .join("");
  return `<section class="panel">
      <div class="study-title"><h3>今天学什么</h3><span class="counter">预习目标</span></div>
      <p class="muted" style="margin-bottom:10px">${lesson.lead}</p>
      <ul class="goal-list">${goals}</ul>
    </section>
    <section class="panel">
      <div class="study-title"><h3>要点</h3><span class="counter">短讲解</span></div>
      ${points}
      ${lesson.note ? `<p class="note">${lesson.note}</p>` : ""}
      <div class="actions">
        <button class="secondary" id="speakPoints">读给我听</button>
        <button class="ghost" id="stopText">停一停</button>
      </div>
      <div class="actions">
        <button class="primary" id="learnDone">${p.learn ? "✓ 要点我看过了" : "学完啦，我会了"}</button>
      </div>
    </section>`;
}

function bindLearn(root, lesson) {
  const payload = lesson.points.map((pt) => pt.title + "。" + pt.body).join("。");
  root.querySelector("#speakPoints").onclick = () => speak(payload);
  root.querySelector("#stopText").onclick = () => stopSpeak();
  root.querySelector("#learnDone").onclick = () => {
    markStep(lesson.id, "learn");
    go(`#/lesson/${lesson.id}/examples`);
  };
}

function renderExamples(lesson) {
  const p = lessonProgress(lesson.id);
  const cards = lesson.examples
    .map(
      (ex, i) => `<article class="example-card">
        <span class="ex-label">例题 ${i + 1}</span>
        <p class="ex-q">${ex.q}</p>
        ${ex.math ? `<div class="big-math">${ex.math}</div>` : ""}
        <ol>${ex.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
        <p class="ex-a">答案：${ex.a}</p>
      </article>`
    )
    .join("");
  return `<section class="panel">
      <div class="study-title"><h3>看例题</h3><span class="counter">${lesson.examples.length} 道</span></div>
      <p class="muted" style="margin-bottom:12px">先看别人怎么想，再自己练。步骤慢慢看就好。</p>
      ${cards}
      <div class="actions">
        <button class="secondary" id="speakEx">读例题</button>
        <button class="primary" id="exDone">${p.examples ? "✓ 例题我看过了" : "例题看完了"}</button>
      </div>
    </section>`;
}

function bindExamples(root, lesson) {
  root.querySelector("#speakEx").onclick = () => {
    const t = lesson.examples
      .map((ex, i) => `例题${i + 1}。${ex.q}。${ex.steps.join("。")}。答案${ex.a}`)
      .join("。");
    speak(t);
  };
  root.querySelector("#exDone").onclick = () => {
    markStep(lesson.id, "examples");
    go(`#/lesson/${lesson.id}/practice`);
  };
}

function quizKey(lesson) {
  return "quiz-pack-" + lesson.id;
}
function quizIndexKey(lesson) {
  return "quiz-i-" + lesson.id;
}

function getQuizPack(lesson) {
  const raw = sessionStorage.getItem(quizKey(lesson));
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  const pack = lesson.quiz.slice();
  sessionStorage.setItem(quizKey(lesson), JSON.stringify(pack));
  return pack;
}

function setQuizPack(lesson, pack) {
  sessionStorage.setItem(quizKey(lesson), JSON.stringify(pack));
  sessionStorage.setItem(quizIndexKey(lesson), "0");
}

function renderPractice(lesson) {
  const pack = getQuizPack(lesson);
  const qi = Number(sessionStorage.getItem(quizIndexKey(lesson)) || 0);
  if (qi >= pack.length) {
    const p = lessonProgress(lesson.id);
    return `<section class="panel celebrate">
      <div class="big">🌟</div>
      <h3>这课练完啦</h3>
      <p class="muted">语语很认真。想再练一套新题，或者去下一课都可以。</p>
      <div class="actions">
        <button class="secondary" id="againQuiz">再练一套</button>
        <button class="primary" id="nextLesson">下一课</button>
      </div>
      <div class="actions">
        <button class="ghost" data-go="#/unit/${lesson.unitId}">回单元</button>
      </div>
      ${p.practice ? "" : ""}
    </section>`;
  }
  const q = pack[qi];
  let body = "";
  if (q.type === "fill") {
    body = `<div class="fill-row">
      <input id="fillAns" type="text" inputmode="${q.input || "text"}" autocomplete="off" placeholder="写在这里" />
      <button class="primary" id="fillOk">看看</button>
    </div>`;
  } else {
    body = `<div class="quiz-options">${q.options
      .map((o) => `<button data-answer="${encodeURIComponent(o)}">${o}</button>`)
      .join("")}</div>`;
  }
  return `<section class="panel">
      <div class="study-title"><h3>练一练</h3><span class="counter">第 ${qi + 1} / ${pack.length} 题</span></div>
      <div class="quiz-question">${q.q}</div>
      ${q.math ? `<div class="big-math">${q.math}</div>` : ""}
      ${body}
      <p class="feedback" id="quizFb" hidden></p>
      <p class="note">想错了也没关系，看提示再试一次就好。</p>
    </section>`;
}

function answersMatch(given, expected, alts) {
  const norm = (s) =>
    String(s)
      .trim()
      .replace(/,/g, "")
      .replace(/，/g, "")
      .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 65248))
      .replace(/．/g, ".")
      .replace(/\s+/g, "")
      .replace(/＋/g, "+")
      .replace(/－/g, "-")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .toLowerCase();
  const g = norm(given);
  const ok = [expected].concat(alts || []).map(norm);
  return ok.includes(g);
}

function bindPractice(root, lesson) {
  const pack = getQuizPack(lesson);
  const qi = Number(sessionStorage.getItem(quizIndexKey(lesson)) || 0);
  if (qi >= pack.length) {
    const again = root.querySelector("#againQuiz");
    if (again) {
      again.onclick = () => {
        const next = makePracticeSet(lesson);
        setQuizPack(lesson, next);
        render();
      };
    }
    const btn = root.querySelector("#nextLesson");
    if (btn) {
      btn.onclick = () => {
        const list = allLessons();
        const i = list.findIndex((x) => x.id === lesson.id);
        const next = list[i + 1] || list[0];
        go(`#/lesson/${next.id}`);
      };
    }
    return;
  }
  const q = pack[qi];
  const fb = root.querySelector("#quizFb");
  const succeed = () => {
    fb.hidden = false;
    fb.style.color = "#4eae7c";
    fb.textContent = q.ok || "真棒，就是这样！";
    setTimeout(() => {
      const n = qi + 1;
      sessionStorage.setItem(quizIndexKey(lesson), String(n));
      if (n >= pack.length) markStep(lesson.id, "practice");
      render();
    }, 700);
  };
  const fail = (btn) => {
    if (btn) btn.classList.add("tryagain");
    fb.hidden = false;
    fb.style.color = "#d96d3b";
    fb.textContent = q.hint || "再想一想，你可以的。";
  };
  if (q.type === "fill") {
    const input = root.querySelector("#fillAns");
    const goCheck = () => {
      if (answersMatch(input.value, q.a, q.alts)) succeed();
      else fail();
    };
    root.querySelector("#fillOk").onclick = goCheck;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") goCheck();
    });
    setTimeout(() => input.focus(), 50);
  } else {
    root.querySelectorAll(".quiz-options button").forEach((btn) => {
      btn.onclick = () => {
        const ans = decodeURIComponent(btn.dataset.answer);
        if (answersMatch(ans, q.a, q.alts)) {
          btn.classList.add("correct");
          succeed();
        } else fail(btn);
      };
    });
  }
}

function renderLesson(id, step) {
  const lesson = findLesson(id);
  if (!lesson) return renderHome();
  markOpened(id);
  const unit = findUnit(lesson.unitId);
  const eyebrow = `${unit.name} · ${lesson.kindLabel}`;
  const s = step === "examples" || step === "practice" ? step : "learn";
  let main = "";
  if (s === "examples") main = renderExamples(lesson);
  else if (s === "practice") main = renderPractice(lesson);
  else main = renderLearn(lesson);
  return `${topbar({ back: `#/unit/${lesson.unitId}`, eyebrow, title: lesson.title, reset: true })}
    ${main}${tabbar(lesson, s)}`;
}

function render() {
  const route = parseRoute();
  const app = document.querySelector("#app");
  stopSpeak();
  let html = "";
  if (route.page === "unit") html = renderUnit(route.unitId);
  else if (route.page === "lesson") html = renderLesson(route.id, route.step);
  else html = renderHome();
  app.className = "app-shell" + (route.page === "lesson" ? " has-tabs" : "");
  app.innerHTML = html;
  bindNav(app);
  if (route.page === "lesson") {
    const lesson = findLesson(route.id);
    const step = route.step === "examples" || route.step === "practice" ? route.step : "learn";
    if (lesson && step === "learn") bindLearn(app, lesson);
    if (lesson && step === "examples") bindExamples(app, lesson);
    if (lesson && step === "practice") bindPractice(app, lesson);
  }
}

window.addEventListener("hashchange", render);
function boot() {
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

/* ---------- 口算 / 填空生成器（不超出本课范围） ---------- */
function rand(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function choiceQ(q, answer, distractors, hint, ok, math) {
  let options = shuffle([String(answer)].concat(distractors.map(String)));
  options = Array.from(new Set(options)).slice(0, 3);
  if (!options.includes(String(answer))) options[0] = String(answer);
  if (options.length < 3) {
    while (options.length < 3) options.push(String(answer) + "？");
  }
  return {
    type: "choice",
    q,
    math,
    options: shuffle(options),
    a: String(answer),
    hint,
    ok,
  };
}
function fillQ(q, answer, hint, ok, extra) {
  return Object.assign(
    { type: "fill", q, a: String(answer), hint, ok, input: "numeric" },
    extra || {}
  );
}

const DIGITS_CN = "零一二三四五六七八九";
const SMALL_CN = ["千", "百", "十", ""];

function readSection(n, useShi) {
  if (n === 0) return "";
  const d = [Math.floor(n / 1000), Math.floor((n % 1000) / 100), Math.floor((n % 100) / 10), n % 10];
  let s = "";
  let zeroPending = false;
  let started = false;
  for (let i = 0; i < 4; i++) {
    const x = d[i];
    if (x === 0) {
      if (started) zeroPending = true;
    } else {
      if (zeroPending) {
        s += "零";
        zeroPending = false;
      }
      if (i === 2 && x === 1 && !started && useShi) s += "十";
      else s += DIGITS_CN[x] + SMALL_CN[i];
      started = true;
    }
  }
  return s;
}

function toChinese(n) {
  n = Math.floor(Math.abs(Number(n)));
  if (n === 0) return "零";
  const yi = Math.floor(n / 100000000);
  const wan = Math.floor((n % 100000000) / 10000);
  const ge = n % 10000;
  let s = "";
  if (yi) s += readSection(yi, true) + "亿";
  if (wan) {
    if (yi && wan < 1000) s += "零";
    s += readSection(wan, !(yi && wan < 1000)) + "万";
  } else if (yi && ge) s += "零";
  if (ge) {
    const precededLing = (yi || wan) && ge < 1000;
    if (precededLing && !s.endsWith("零")) s += "零";
    s += readSection(ge, !precededLing);
  }
  s = s.replace(/零+/g, "零");
  if (s.endsWith("零") && s !== "零") s = s.slice(0, -1);
  return s;
}

function nearbyReadings(n) {
  const correct = toChinese(n);
  const cands = [];
  const tries = [n + 10000, n - 10000, n + 100000, n - 1000, n + 100, n * 10, Math.floor(n / 10)];
  for (const t of tries) {
    if (t > 0 && t !== n) {
      const r = toChinese(t);
      if (r !== correct) cands.push(r);
    }
  }
  return Array.from(new Set(cands)).slice(0, 2);
}

function roundTo(n, place) {
  return Math.round(n / place) * place;
}

const GENERATORS = {
  readNumber() {
    const n = rand(12000, 89000000);
    const correct = toChinese(n);
    let wrong = nearbyReadings(n);
    while (wrong.length < 2) wrong.push(toChinese(n + 20000 * (wrong.length + 1)));
    return choiceQ(
      `下面哪个是 ${fmt(n)} 的读法？`,
      correct,
      wrong,
      "先分级（每四位一级），从万级读到个级。中间的 0 只读一个零，末尾的 0 不读。",
      "读对啦！"
    );
  },
  writeNumber() {
    const n = rand(10500, 76000000);
    return fillQ(
      `把「${toChinese(n)}」写成数字（不用写逗号）。`,
      String(n),
      "一级一级写。哪一位没有，就用 0 占位。",
      "写对啦！"
    );
  },
  compare() {
    let a = rand(100000, 90000000);
    let b = rand(100000, 90000000);
    if (a === b) b += 1000;
    const bigger = a > b ? fmt(a) : fmt(b);
    return choiceQ(
      `哪一个更大？`,
      bigger,
      [fmt(a), fmt(b), fmt(Math.min(a, b))].filter((x) => x !== bigger),
      "先比位数，位数相同再从最高位往下比。",
      "比对啦！",
      `${fmt(a)}  和  ${fmt(b)}`
    );
  },
  rewriteWan() {
    const k = rand(12, 9800);
    const n = k * 10000;
    return fillQ(
      `${fmt(n)} 用“万”作单位，可以改写成多少万？只写数字。`,
      String(k),
      "万后面有 4 个 0。把后面 4 个 0 去掉，就是多少万。",
      "改写对啦！"
    );
  },
  rewriteYi() {
    const tenths = rand(10, 90);
    const n = tenths * 10000000;
    const ans = (tenths / 10).toString().replace(/\.0$/, "");
    const pretty = tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
    return fillQ(
      `${fmt(n)} 用“亿”作单位，约是多少亿？可以写成 ${pretty} 这样。`,
      pretty,
      "1 亿是 8 个 0。小数点向左移 8 位。",
      "改写对啦！",
      { alts: [pretty, ans, pretty + "亿"] }
    );
  },
  roundWan() {
    const n = rand(10500, 985000);
    const a = roundTo(n, 10000);
    const opts = [a, roundTo(n, 1000), Math.floor(n / 10000) * 10000];
    return choiceQ(
      `${fmt(n)} 精确到万位，大约是多少？`,
      fmt(a),
      opts.filter((x) => x !== a).map(fmt).concat([fmt(a + 10000)]),
      "看千位：满 5 向前一位进 1，不满 5 就舍去。",
      "四舍五入对啦！"
    );
  },
  placeValue() {
    const n = rand(20304050, 80907060);
    const s = String(n).padStart(8, "0");
    const names = ["千万", "百万", "十万", "万", "千", "百", "十", "个"];
    const idxs = [];
    for (let i = 0; i < 8; i++) if (s[i] !== "0") idxs.push(i);
    const unique = idxs.filter((i) => s.split(s[i]).length - 1 === 1);
    const i = pick(unique.length ? unique : idxs);
    const d = s[i];
    const unit = names[i];
    return choiceQ(
      `在 ${fmt(n)} 里，数字 ${d} 在哪一位？`,
      unit + "位",
      shuffle(names.filter((x) => x !== unit))
        .slice(0, 2)
        .map((x) => x + "位"),
      "从右边起：个十百千是个级，万十万百万千万是万级。",
      "找对啦！"
    );
  },
  areaHa() {
    const ha = pick([1, 2, 3, 4, 5, 6, 8, 10]);
    return fillQ(
      `${ha} 公顷 = 多少平方米？`,
      String(ha * 10000),
      "1 公顷 = 10000 平方米。边长 100 米的正方形正好是 1 公顷。",
      "换算对啦！"
    );
  },
  areaKm() {
    const km = pick([1, 2, 3, 4, 5]);
    const mode = pick(["ha", "m2"]);
    if (mode === "ha") {
      return fillQ(
        `${km} 平方千米 = 多少公顷？`,
        String(km * 100),
        "1 平方千米 = 100 公顷。",
        "换算对啦！"
      );
    }
    return choiceQ(
      `${km} 平方千米 = 多少平方米？`,
      fmt(km * 1000000),
      [fmt(km * 10000), fmt(km * 100000), fmt(km * 10000000)],
      "1 平方千米 = 1000000 平方米。",
      "换算对啦！"
    );
  },
  mul3x2() {
    const a = rand(123, 876);
    const b = rand(12, 86);
    return fillQ(`${a} × ${b} = ？`, String(a * b), "先用个位去乘，再用十位去乘，注意错一位，然后加起来。", "乘对啦！");
  },
  mulZero() {
    const mode = pick(["mid", "end"]);
    if (mode === "mid") {
      const a = rand(1, 9) * 100 + rand(1, 9);
      const b = rand(12, 48);
      return fillQ(`${a} × ${b} = ？`, String(a * b), "中间的 0 也要乘，这一位通常是 0，别忘了占位。", "乘对啦！");
    }
    const a = rand(12, 89) * 10;
    const b = pick([20, 30, 40, 50, 60]);
    return fillQ(
      `${a} × ${b} = ？`,
      String(a * b),
      "末尾有 0，可以先把 0 前面的数相乘，再把 0 的个数补回去。",
      "乘对啦！"
    );
  },
  productRule() {
    const a = rand(12, 48);
    const b = rand(6, 19);
    const k = pick([2, 3, 4, 5, 10]);
    const mode = pick(["one", "both"]);
    if (mode === "one") {
      return fillQ(
        `${a} × ${b} = ${a * b}。那么 ${a} × ${b * k} = ？`,
        String(a * b * k),
        "一个因数乘几，积也乘几。",
        "规律用对啦！"
      );
    }
    return fillQ(
      `一个因数扩大 ${k} 倍，另一个不变，积会怎样？积等于原来的几倍？只写数字。`,
      String(k),
      "一个因数变几倍，积就变几倍。",
      "抓住规律啦！"
    );
  },
  priceQty() {
    const price = pick([6, 8, 12, 15, 18, 24, 36]);
    const qty = rand(3, 18);
    return fillQ(
      `一件玩具 ${price} 元，买 ${qty} 件，一共多少元？`,
      String(price * qty),
      "总价 = 单价 × 数量。",
      "算对啦！"
    );
  },
  speedTime() {
    const v = pick([40, 45, 50, 60, 72, 80, 90]);
    const t = pick([2, 3, 4, 5, 6, 8]);
    const mode = pick(["s", "t", "v"]);
    if (mode === "s") {
      return fillQ(
        `一辆车每小时行 ${v} 千米，行了 ${t} 小时，一共行多少千米？`,
        String(v * t),
        "路程 = 速度 × 时间。",
        "算对啦！"
      );
    }
    if (mode === "t") {
      return fillQ(
        `一辆车每小时行 ${v} 千米，一共行了 ${v * t} 千米，用了几小时？`,
        String(t),
        "时间 = 路程 ÷ 速度。",
        "算对啦！"
      );
    }
    return fillQ(
      `一辆车 ${t} 小时行了 ${v * t} 千米，平均每小时行多少千米？`,
      String(v),
      "速度 = 路程 ÷ 时间。",
      "算对啦！"
    );
  },
  mentalDiv() {
    const d = pick([20, 30, 40, 50, 60, 70, 80, 90]);
    const q = rand(2, 9);
    const n = d * q;
    return fillQ(`${n} ÷ ${d} = ？`, String(q), "口算时，可以都缩小 10 倍再除，比如 80÷20 想成 8÷2。", "口算对啦！");
  },
  div1digit() {
    const d = rand(12, 46);
    const q = rand(2, 9);
    const n = d * q;
    return fillQ(`${n} ÷ ${d} = ？`, String(q), "先看除数的前两位或前三位，试商。商是一位数。", "除对啦！");
  },
  trialQuotient() {
    const d = pick([19, 21, 28, 29, 31, 32, 38, 39, 41, 42]);
    const q = rand(3, 9);
    const n = d * q;
    const round = d % 10 >= 5 ? Math.ceil(d / 10) * 10 : Math.floor(d / 10) * 10;
    return fillQ(
      `${n} ÷ ${d} = ？想一想：除数 ${d} 可以看作 ${round} 来试商。`,
      String(q),
      "用四舍五入把除数看作整十数，试出商后再乘一乘，检查够不够减。",
      "试商成功！"
    );
  },
  div2digit() {
    const d = rand(12, 36);
    const q = rand(12, 48);
    const n = d * q;
    return fillQ(`${n} ÷ ${d} = ？`, String(q), "商是两位数：先除前面，写下第一位商，再把余数和下一位合起来继续除。", "除对啦！");
  },
  quotientRule() {
    const d = pick([12, 15, 16, 18, 24, 25, 30]);
    const q = rand(4, 12);
    const k = pick([2, 3, 4, 5]);
    const mode = pick(["same", "num"]);
    if (mode === "same") {
      return fillQ(
        `${d * q} ÷ ${d} = ${q}。那么 ${d * q * k} ÷ ${d * k} = ？`,
        String(q),
        "被除数和除数同时乘或除同一个数（0 除外），商不变。",
        "规律用对啦！"
      );
    }
    return fillQ(
      `${d * q} ÷ ${d} = ${q}。被除数变成 ${d * q * k}，除数不变，商是多少？`,
      String(q * k),
      "被除数乘几，除数不变，商也乘几。",
      "规律用对啦！"
    );
  },
  angleDeg() {
    const a = pick([20, 30, 45, 60, 75, 90, 120, 135, 150, 180]);
    let kind = "锐角";
    if (a === 90) kind = "直角";
    else if (a === 180) kind = "平角";
    else if (a > 90) kind = "钝角";
    return choiceQ(
      `一个 ${a}° 的角是什么角？`,
      kind,
      ["锐角", "直角", "钝角", "平角"].filter((x) => x !== kind).slice(0, 2),
      "锐角比直角小，钝角在直角和平角中间，平角是 180°。",
      "分对啦！"
    );
  },
};

function makePracticeSet(lesson) {
  const gens = [].concat(lesson.gen || []).filter((g) => GENERATORS[g]);
  if (gens.length) {
    const out = [];
    const seen = new Set();
    let guard = 0;
    while (out.length < 6 && guard < 50) {
      guard += 1;
      const q = GENERATORS[pick(gens)]();
      const k = q.q + (q.math || "") + q.a;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(q);
    }
    return out.length ? out : lesson.quiz.slice();
  }
  if (lesson.quizB && lesson.quizB.length) {
    const usedB = sessionStorage.getItem("quiz-usedb-" + lesson.id);
    if (!usedB) {
      sessionStorage.setItem("quiz-usedb-" + lesson.id, "1");
      return lesson.quizB.slice();
    }
    sessionStorage.removeItem("quiz-usedb-" + lesson.id);
    return lesson.quiz.slice();
  }
  return shuffle(lesson.quiz.slice());
}

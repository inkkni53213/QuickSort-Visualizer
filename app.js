(() => {
  "use strict";

  const MAX_ELEMENTS = 100;
  const DEFAULT_COUNT = 10;

  const dom = {
    chart: document.getElementById("chart"),
    chartWrap: document.getElementById("chartWrap"),
    pointerLayer: document.getElementById("pointerLayer"),
    beaconLayer: document.getElementById("beaconLayer"),
    dragGhost: document.getElementById("dragGhost"),
    arraySummary: document.getElementById("arraySummary"),
    statusPill: document.getElementById("statusPill"),
    stepCount: document.getElementById("stepCount"),
    roundCount: document.getElementById("roundCount"),
    compareCount: document.getElementById("compareCount"),
    moveCount: document.getElementById("moveCount"),
    pivotToken: document.getElementById("pivotToken"),
    pivotValueLabel: document.getElementById("pivotValueLabel"),
    pivotDockHint: document.getElementById("pivotDockHint"),
    rangeText: document.getElementById("rangeText"),
    rangeProgress: document.getElementById("rangeProgress"),
    missionIcon: document.getElementById("missionIcon"),
    missionKicker: document.getElementById("missionKicker"),
    missionTitle: document.getElementById("missionTitle"),
    missionText: document.getElementById("missionText"),
    mainAction: document.getElementById("mainAction"),
    undoButton: document.getElementById("undoButton"),
    resetButton: document.getElementById("resetButton"),
    feedback: document.getElementById("feedback"),
    stepGuide: Array.from(document.querySelectorAll("#stepGuide li")),
    pendingCount: document.getElementById("pendingCount"),
    pendingList: document.getElementById("pendingList"),
    countRange: document.getElementById("countRange"),
    countInput: document.getElementById("countInput"),
    countValue: document.getElementById("countValue"),
    randomCount: document.getElementById("randomCount"),
    randomButton: document.getElementById("randomButton"),
    customInput: document.getElementById("customInput"),
    applyCustom: document.getElementById("applyCustom"),
    inputError: document.getElementById("inputError"),
    successBanner: document.getElementById("successBanner"),
    successSummary: document.getElementById("successSummary"),
    confettiLayer: document.getElementById("confettiLayer")
  };

  const state = {
    original: [],
    array: [],
    phase: "selectPivot",
    range: { start: 0, end: 0 },
    pending: [],
    solved: [],
    pivot: null,
    left: null,
    right: null,
    hole: null,
    activePointer: null,
    pendingMove: null,
    round: 1,
    operations: 0,
    compares: 0,
    moves: 0,
    partitions: 0,
    lastCompared: null,
    comparison: null,
    awaitingPointerMove: null,
    justSettled: null,
    flash: null,
    history: [],
    drag: null,
    feedbackTimer: null,
    flashTimer: null,
    pointerTimer: null,
    celebrated: false,
    suppressClickUntil: 0
  };

  function clampInteger(value, min, max) {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
  }

  function shuffledPermutation(count) {
    const values = Array.from({ length: count }, (_, index) => index + 1);
    for (let index = values.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [values[index], values[target]] = [values[target], values[index]];
    }
    return values;
  }

  function barGapForCount(count) {
    if (count <= 14) return "8px";
    if (count <= 24) return "5px";
    if (count <= 40) return "3px";
    if (count <= 64) return "2px";
    return "0px";
  }

  function showFeedback(message, type = "info", duration = 1650) {
    window.clearTimeout(state.feedbackTimer);
    dom.feedback.textContent = message;
    dom.feedback.className = `feedback-toast visible ${type}`;
    state.feedbackTimer = window.setTimeout(() => {
      dom.feedback.classList.remove("visible");
    }, duration);
  }

  function flashBar(index, type = "error") {
    window.clearTimeout(state.flashTimer);
    state.flash = { index, type };
    render();
    state.flashTimer = window.setTimeout(() => {
      state.flash = null;
      render();
    }, 520);
  }

  function snapshotState() {
    return JSON.stringify({
      array: state.array,
      phase: state.phase,
      range: state.range,
      pending: state.pending,
      solved: state.solved,
      pivot: state.pivot,
      left: state.left,
      right: state.right,
      hole: state.hole,
      activePointer: state.activePointer,
      pendingMove: state.pendingMove,
      round: state.round,
      operations: state.operations,
      compares: state.compares,
      moves: state.moves,
      partitions: state.partitions,
      lastCompared: state.lastCompared,
      comparison: state.comparison,
      awaitingPointerMove: state.awaitingPointerMove,
      justSettled: state.justSettled,
      celebrated: state.celebrated
    });
  }

  function clearPointerTimer() {
    window.clearTimeout(state.pointerTimer);
    state.pointerTimer = null;
    state.awaitingPointerMove = null;
  }

  function pushHistory() {
    state.history.push(snapshotState());
    if (state.history.length > 600) state.history.shift();
    dom.undoButton.disabled = false;
  }

  function restoreSnapshot(serialized) {
    clearPointerTimer();
    const saved = JSON.parse(serialized);
    Object.assign(state, saved);
    state.flash = null;
    state.drag = null;
  }

  function undo() {
    cleanupDrag();
    const previous = state.history.pop();
    if (!previous) {
      showFeedback("还没有可以撤销的操作");
      return;
    }
    restoreSnapshot(previous);
    dom.undoButton.disabled = state.history.length === 0;
    render();
    showFeedback("已撤销上一步操作", "success");
  }

  function syncCountControls(count) {
    dom.countRange.value = String(count);
    dom.countInput.value = String(count);
    dom.countValue.textContent = String(count);
    dom.randomCount.textContent = String(count);
  }

  function resetFromOriginal() {
    cleanupDrag();
    clearPointerTimer();
    window.clearTimeout(state.flashTimer);
    state.array = state.original.slice();
    state.phase = "selectPivot";
    state.range = { start: 0, end: state.array.length - 1 };
    state.pending = [];
    state.solved = [];
    state.pivot = null;
    state.left = null;
    state.right = null;
    state.hole = null;
    state.activePointer = null;
    state.pendingMove = null;
    state.round = 1;
    state.operations = 0;
    state.compares = 0;
    state.moves = 0;
    state.partitions = 0;
    state.lastCompared = null;
    state.comparison = null;
    state.justSettled = null;
    state.flash = null;
    state.history = [];
    state.celebrated = false;
    dom.undoButton.disabled = true;
    dom.confettiLayer.replaceChildren();
    render();
  }

  function loadArray(values, message) {
    if (!Array.isArray(values) || values.length < 2 || values.length > MAX_ELEMENTS) return;
    state.original = values.slice();
    dom.customInput.value = values.join(", ");
    dom.inputError.textContent = "";
    syncCountControls(values.length);
    resetFromOriginal();
    if (message) showFeedback(message, "success");
  }

  function setRandomArray(count) {
    const safeCount = clampInteger(count, 2, MAX_ELEMENTS);
    syncCountControls(safeCount);
    loadArray(shuffledPermutation(safeCount), `已随机生成 1…${safeCount} 的排列`);
  }

  function parseCustomSequence(text) {
    let normalized = text.trim();
    if (!normalized) throw new Error("请先输入一组数字。");
    if ((normalized.startsWith("[") && normalized.endsWith("]")) ||
        (normalized.startsWith("【") && normalized.endsWith("】"))) {
      normalized = normalized.slice(1, -1).trim();
    }
    const tokens = normalized.split(/[\s,，;；]+/).filter(Boolean);
    if (tokens.length < 2) throw new Error("至少需要 2 个元素。");
    if (tokens.length > MAX_ELEMENTS) throw new Error(`最多支持 ${MAX_ELEMENTS} 个元素。`);
    const values = tokens.map((token) => {
      if (!/^\d+$/.test(token)) throw new Error(`“${token}”不是有效整数。`);
      return Number(token);
    });
    const n = values.length;
    const expected = Array.from({ length: n }, (_, index) => index + 1);
    const sorted = values.slice().sort((a, b) => a - b);
    const valid = sorted.every((value, index) => value === expected[index]);
    if (!valid) {
      throw new Error(`这组数据共有 ${n} 项，因此必须恰好包含 1 到 ${n}，每个数字只能出现一次。`);
    }
    return values;
  }

  function applyCustomSequence() {
    try {
      const values = parseCustomSequence(dom.customInput.value);
      dom.inputError.textContent = "";
      loadArray(values, `已应用新的 1…${values.length} 排列`);
    } catch (error) {
      dom.inputError.textContent = error.message;
      dom.customInput.focus();
    }
  }

  function currentElementDescription(index) {
    const value = state.array[index];
    if (value == null) return "空位";
    return `第 ${index + 1} 项的值 ${value}`;
  }

  function renderBars() {
    const maxValue = Math.max(state.original.length, 1);
    const pendingSet = new Set();
    state.pending.forEach((range) => {
      for (let index = range.start; index <= range.end; index += 1) pendingSet.add(index);
    });
    const solvedSet = new Set(state.solved);
    const fragment = document.createDocumentFragment();
    dom.chart.style.setProperty("--bar-gap", barGapForCount(state.array.length));
    dom.chart.style.setProperty("--bar-min-width", state.array.length > 64 ? "1px" : "2px");

    state.array.forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bar-button";
      button.dataset.index = String(index);
      if (index === 0) button.classList.add("first-bar");
      if (index === state.array.length - 1) button.classList.add("last-bar");
      button.style.setProperty("--bar-height", `${10 + ((value ?? 0) / maxValue) * 84}%`);

      if (index >= state.range.start && index <= state.range.end) button.classList.add("in-range");
      if (pendingSet.has(index)) button.classList.add("pending-range");
      if (solvedSet.has(index)) button.classList.add("settled");
      if (state.phase === "selectPivot" && index === state.range.start) button.classList.add("pivot-candidate");
      if (state.lastCompared === index) button.classList.add("compare-current");
      if (state.pendingMove && state.pendingMove.source === index) button.classList.add("move-source");
      if (state.left === index && state.right === index) {
        button.classList.add("pointer-under-both");
      } else if (state.left === index) {
        button.classList.add("pointer-under-left");
      } else if (state.right === index) {
        button.classList.add("pointer-under-right");
      }
      if (value == null) button.classList.add("hole");
      if (state.flash?.index === index) button.classList.add(state.flash.type === "ok" ? "flash-ok" : "flash-error");
      if (state.justSettled === index) button.classList.add("flash-ok");

      const label = value == null
        ? `第 ${index + 1} 个位置是空位。${state.phase === "moveElement" ? "点击这里填入元素" : ""}`
        : `第 ${index + 1} 个元素，值为 ${value}。${
            state.left === index && state.right === index
              ? "左右指针均在这里。"
              : state.left === index
                ? "当前左指针在这里。"
                : state.right === index
                  ? "当前右指针在这里，可点击判断。"
                  : ""
          }`;
      button.setAttribute("aria-label", label);

      if (value == null) {
        const holeLabel = document.createElement("span");
        holeLabel.className = "bar-hole";
        holeLabel.textContent = "空位";
        button.appendChild(holeLabel);
      } else {
        const fill = document.createElement("span");
        fill.className = "bar-fill";
        button.appendChild(fill);
        if (state.array.length <= 22) {
          const valueLabel = document.createElement("span");
          valueLabel.className = "bar-value";
          valueLabel.textContent = String(value);
          button.appendChild(valueLabel);
        }
      }

      if (state.array.length <= 28) {
        const indexLabel = document.createElement("span");
        indexLabel.className = "bar-index";
        indexLabel.textContent = String(index + 1);
        button.appendChild(indexLabel);
      }

      fragment.appendChild(button);
    });

    dom.chart.replaceChildren(fragment);
    const readable = state.array.slice(0, 24).map((value) => value ?? "空位").join("、");
    dom.chart.setAttribute(
      "aria-label",
      `当前数组：${readable}${state.array.length > 24 ? `，其余 ${state.array.length - 24} 项省略` : ""}`
    );
  }

  function renderPointerLayer() {
    dom.pointerLayer.replaceChildren();
    if (state.phase === "selectPivot") {
      const hitZone = document.createElement("button");
      hitZone.type = "button";
      hitZone.className = "pointer-hit-zone pivot";
      hitZone.dataset.action = "pivot";
      hitZone.style.left = `${((state.range.start + 0.5) / state.array.length) * 100}%`;
      hitZone.setAttribute("aria-label", `选择第 ${state.range.start + 1} 个元素作为基准点`);
      dom.pointerLayer.appendChild(hitZone);
      return;
    }
    if (state.left == null || state.right == null) return;
    const count = state.array.length;
    const samePosition = state.left === state.right;

    if (!samePosition && state.activePointer && (state.phase === "scanRight" || state.phase === "scanLeft")) {
      const activeIndex = state.activePointer === "right" ? state.right : state.left;
      const hitZone = document.createElement("button");
      hitZone.type = "button";
      hitZone.className = `pointer-hit-zone ${state.activePointer}`;
      hitZone.dataset.pointer = state.activePointer;
      hitZone.style.left = `${((activeIndex + 0.5) / count) * 100}%`;
      hitZone.setAttribute(
        "aria-label",
        `点击检查${state.activePointer === "right" ? "右" : "左"}指针下的第 ${activeIndex + 1} 个元素`
      );
      dom.pointerLayer.appendChild(hitZone);
    }

    if (samePosition) {
      const tag = document.createElement("div");
      tag.className = "pointer-tag left combined";
      tag.dataset.pointer = "both";
      tag.textContent = `L·R · ${state.left + 1}`;
      tag.style.left = `${Math.min(86, Math.max(14, ((state.left + 0.5) / count) * 100))}%`;
      tag.setAttribute("aria-label", "左右指针在当前空位相遇");
      dom.pointerLayer.appendChild(tag);
      return;
    }

    if (state.left != null) {
      const tag = document.createElement("div");
      tag.className = `pointer-tag left${state.activePointer === "left" ? " active" : ""}`;
      tag.dataset.pointer = "left";
      tag.textContent = `L · ${state.left + 1}`;
      tag.style.left = `${Math.min(86, Math.max(14, ((state.left + 0.5) / count) * 100))}%`;
      tag.setAttribute("aria-label", `左指针，第 ${state.left + 1} 项`);
      dom.pointerLayer.appendChild(tag);
    }

    if (state.right != null) {
      const tag = document.createElement("div");
      tag.className = `pointer-tag right${state.activePointer === "right" ? " active" : ""}`;
      tag.dataset.pointer = "right";
      tag.textContent = `R · ${state.right + 1}`;
      tag.style.left = `${Math.min(86, Math.max(14, ((state.right + 0.5) / count) * 100))}%`;
      tag.setAttribute("aria-label", `右指针，第 ${state.right + 1} 项`);
      dom.pointerLayer.appendChild(tag);
    }
  }

  function renderBeacon() {
    dom.beaconLayer.replaceChildren();
    const count = state.array.length;
    if (state.phase === "selectPivot") {
      const percentage = ((state.range.start + 0.5) / count) * 100;
      const beacon = document.createElement("div");
      beacon.className = "pivot-beacon";
      beacon.style.left = `${percentage}%`;
      beacon.style.setProperty("--anchor-shift", percentage < 20 ? "0%" : percentage > 80 ? "-100%" : "-50%");
      beacon.innerHTML = `点击这里选择轴点<br><small>当前子数组最左元素</small>`;
      dom.beaconLayer.appendChild(beacon);
      return;
    }

    if (state.comparison) {
      const comparison = state.comparison;
      const percentage = ((comparison.index + 0.5) / count) * 100;
      const bubble = document.createElement("div");
      bubble.className = `relation-bubble ${comparison.needsMove ? "need" : "stay"}`;
      bubble.style.left = `${percentage}%`;
      bubble.style.setProperty("--anchor-shift", percentage < 20 ? "0%" : percentage > 80 ? "-100%" : "-50%");
      bubble.innerHTML = `<strong>${comparison.value} ${comparison.operator} ${comparison.pivot}</strong><span>${comparison.needsMove ? "需要移动" : "不需要移动"}</span>`;
      dom.beaconLayer.appendChild(bubble);
    }
  }

  function activeGuide() {
    if (state.phase === "selectPivot") return "pivot";
    if (state.phase === "scanRight") return "right";
    if (state.phase === "scanLeft") return "left";
    if (state.phase === "moveElement") return state.pendingMove?.direction === "left" ? "left" : "right";
    if (state.phase === "placePivot" || state.phase === "partitionDone" || state.phase === "complete") return "place";
    return "pivot";
  }

  function renderGuide() {
    const active = activeGuide();
    dom.stepGuide.forEach((item) => {
      item.classList.toggle("active", item.dataset.guide === active);
    });
  }

  function renderPivotDock() {
    dom.pivotToken.classList.toggle("empty", state.pivot == null);
    dom.pivotToken.classList.toggle("pulse", state.phase === "placePivot");
    dom.pivotValueLabel.textContent = state.pivot ?? "—";
    if (state.pivot != null) {
      dom.pivotDockHint.textContent = state.phase === "placePivot"
        ? "指针相遇 · 点击或拖入空位"
        : "轴点暂时取出";
      dom.pivotToken.setAttribute("aria-label", `轴点 ${state.pivot}${state.phase === "placePivot" ? "，可放入空位" : ""}`);
    } else if (state.phase === "selectPivot") {
      dom.pivotDockHint.textContent = "等待选择最左元素";
      dom.pivotToken.setAttribute("aria-label", "尚未选择轴点");
    } else {
      dom.pivotDockHint.textContent = "当前轴点已就位";
      dom.pivotToken.setAttribute("aria-label", "当前轴点已就位");
    }
  }

  function renderPendingList() {
    dom.pendingCount.textContent = String(state.pending.length);
    dom.pendingList.replaceChildren();
    if (state.pending.length === 0) {
      const empty = document.createElement("span");
      empty.className = "empty-state";
      empty.textContent = state.phase === "complete" ? "全部子数组均已处理" : "暂无待处理子数组";
      dom.pendingList.appendChild(empty);
      return;
    }
    state.pending.slice(-10).forEach((range) => {
      const chip = document.createElement("span");
      chip.className = "pending-chip";
      chip.textContent = `[${range.start + 1}–${range.end + 1}]`;
      dom.pendingList.appendChild(chip);
    });
    if (state.pending.length > 10) {
      const more = document.createElement("span");
      more.className = "pending-chip";
      more.textContent = `+${state.pending.length - 10}`;
      dom.pendingList.appendChild(more);
    }
  }

  function renderMission() {
    dom.mainAction.disabled = false;
    dom.mainAction.className = "action-button primary";

    switch (state.phase) {
      case "selectPivot":
        dom.missionIcon.textContent = "1";
        dom.missionKicker.textContent = "NEXT ACTION";
        dom.missionTitle.textContent = "选择本轮基准点";
        dom.missionText.textContent = `当前子数组是第 ${state.range.start + 1}–${state.range.end + 1} 项。必须点击最左侧带光晕的柱子。`;
        dom.mainAction.textContent = "请点击图中高亮柱子";
        dom.mainAction.disabled = true;
        dom.statusPill.className = "status-pill waiting";
        dom.statusPill.textContent = "等待选择轴点";
        break;
      case "scanRight":
        dom.missionIcon.textContent = "R";
        dom.missionKicker.textContent = "RIGHT POINTER";
        if (state.awaitingPointerMove) {
          dom.missionTitle.textContent = `${state.comparison.value} ${state.comparison.operator} ${state.pivot}，不需要移动`;
          dom.missionText.textContent = `R 正在检查第 ${state.comparison.index + 1} 项。判断已完成，指针随后向左移动一格。`;
          dom.mainAction.textContent = "结果已显示 · 指针移动中";
          dom.mainAction.disabled = true;
        } else if (state.comparison) {
          dom.missionTitle.textContent = "点击 R 指针下的元素";
          dom.missionText.textContent = `上一步：${state.comparison.value} ${state.comparison.operator} 轴点 ${state.pivot}。请先点击 R 当前所在的柱子，再进行下一次判断。`;
          dom.mainAction.textContent = `请点击第 ${state.right + 1} 项`;
          dom.mainAction.disabled = true;
        } else {
          dom.missionTitle.textContent = "先判断 R 指针下的元素";
          dom.missionText.textContent = `轴点是 ${state.pivot}。点击 R 指针下的柱子，系统会显示大小关系，再让指针向左移动。`;
          dom.mainAction.textContent = `请点击第 ${state.right + 1} 项`;
          dom.mainAction.disabled = true;
        }
        dom.statusPill.className = "status-pill scanning";
        dom.statusPill.textContent = state.awaitingPointerMove ? "关系已判断 · 指针移动中" : "R 指针扫描中";
        break;
      case "scanLeft":
        dom.missionIcon.textContent = "L";
        dom.missionKicker.textContent = "LEFT POINTER";
        if (state.awaitingPointerMove) {
          dom.missionTitle.textContent = `${state.comparison.value} ${state.comparison.operator} ${state.pivot}，不需要移动`;
          dom.missionText.textContent = `L 正在检查第 ${state.comparison.index + 1} 项。判断已完成，指针随后向右移动一格。`;
          dom.mainAction.textContent = "结果已显示 · 指针移动中";
          dom.mainAction.disabled = true;
        } else if (state.comparison) {
          dom.missionTitle.textContent = "点击 L 指针下的元素";
          dom.missionText.textContent = `上一步：${state.comparison.value} ${state.comparison.operator} 轴点 ${state.pivot}。请先点击 L 当前所在的柱子，再进行下一次判断。`;
          dom.mainAction.textContent = `请点击第 ${state.left + 1} 项`;
          dom.mainAction.disabled = true;
        } else {
          dom.missionTitle.textContent = "先判断 L 指针下的元素";
          dom.missionText.textContent = `轴点是 ${state.pivot}。点击 L 指针下的柱子，系统会显示大小关系，再让指针向右移动。`;
          dom.mainAction.textContent = `请点击第 ${state.left + 1} 项`;
          dom.mainAction.disabled = true;
        }
        dom.statusPill.className = "status-pill scanning";
        dom.statusPill.textContent = state.awaitingPointerMove ? "关系已判断 · 指针移动中" : "L 指针扫描中";
        break;
      case "moveElement": {
        const move = state.pendingMove;
        dom.missionIcon.textContent = "↔";
        dom.missionKicker.textContent = "MOVE REQUIRED";
        dom.missionTitle.textContent = `把 ${move.value} 移入空位`;
        dom.missionText.textContent = move.direction === "right"
          ? `R 找到了 ${move.value} < 轴点 ${state.pivot}。拖动这个元素到左侧虚线空位，或直接点击空位。`
          : `L 找到了 ${move.value} > 轴点 ${state.pivot}。拖动这个元素到右侧虚线空位，或直接点击空位。`;
        dom.mainAction.textContent = `移动 ${move.value} 到空位`;
        dom.statusPill.className = "status-pill action";
        dom.statusPill.textContent = "等待移动元素";
        break;
      }
      case "placePivot":
        dom.missionIcon.textContent = "P";
        dom.missionKicker.textContent = "PLACE PIVOT";
        dom.missionTitle.textContent = `把轴点 ${state.pivot} 放入空位`;
        dom.missionText.textContent = "左右指针已经相遇，当前虚线位置就是轴点最终会去的位置。点击空位或拖动上方轴点。";
        dom.mainAction.textContent = `放入轴点 ${state.pivot}`;
        dom.statusPill.className = "status-pill action";
        dom.statusPill.textContent = "等待填入轴点";
        break;
      case "partitionDone":
        dom.missionIcon.textContent = "✓";
        dom.missionKicker.textContent = "PARTITION DONE";
        dom.missionTitle.textContent = "本轮分区完成";
        dom.missionText.textContent = state.pending.length
          ? `轴点已经就位。还有 ${state.pending.length} 个子数组需要处理；下一轮仍由你选择最左元素。`
          : "轴点已经就位，所有子数组都已完成。点击查看最终排序结果。";
        dom.mainAction.textContent = state.pending.length ? "继续下一组" : "查看排序结果";
        dom.statusPill.className = "status-pill done";
        dom.statusPill.textContent = "本轮完成";
        break;
      case "complete":
        dom.missionIcon.textContent = "✓";
        dom.missionKicker.textContent = "ALL COMPLETE";
        dom.missionTitle.textContent = "排序成功";
        dom.missionText.textContent = `共操作 ${state.operations} 步，比较 ${state.compares} 次，移动元素 ${state.moves} 次。`;
        dom.mainAction.textContent = "再练一次";
        dom.statusPill.className = "status-pill done";
        dom.statusPill.textContent = "排序完成";
        break;
      default:
        break;
    }
  }

  function render() {
    renderBars();
    renderPointerLayer();
    renderBeacon();
    renderGuide();
    renderPivotDock();
    renderPendingList();
    renderMission();

    const rangeLength = state.range.end - state.range.start + 1;
    dom.arraySummary.textContent = state.original.length <= 16
      ? state.original.join(" · ")
      : `1…${state.original.length} 的唯一值排列 · 当前显示 ${rangeLength} 项`;
    dom.stepCount.textContent = String(state.operations);
    dom.roundCount.textContent = String(state.round);
    dom.compareCount.textContent = String(state.compares);
    dom.moveCount.textContent = String(state.moves);
    dom.rangeText.textContent = `第 ${state.range.start + 1}–${state.range.end + 1} 项`;
    dom.rangeProgress.textContent = state.left == null
      ? "L — · R —"
      : `L ${state.left + 1} · R ${state.right + 1}`;
    dom.undoButton.disabled = state.history.length === 0;
    dom.successBanner.classList.toggle("visible", state.phase === "complete");
    if (state.phase === "complete") {
      dom.successSummary.textContent = `${state.operations} 步操作 · ${state.compares} 次比较 · ${state.moves} 次移动`;
    }
  }

  function choosePivot(index) {
    if (state.phase !== "selectPivot") return;
    if (index < state.range.start || index > state.range.end) {
      showFeedback("这个位置不在当前子数组中", "error");
      flashBar(index);
      return;
    }
    if (index !== state.range.start) {
      showFeedback("基准点必须是当前子数组的最左元素，请点击高亮位置", "error", 2100);
      flashBar(index);
      flashBar(state.range.start, "ok");
      return;
    }

    pushHistory();
    state.pivot = state.array[index];
    state.array[index] = null;
    state.hole = index;
    state.left = index;
    state.right = state.range.end;
    state.activePointer = "right";
    state.phase = "scanRight";
    state.lastCompared = null;
    state.comparison = null;
    state.awaitingPointerMove = null;
    state.justSettled = null;
    state.operations += 1;
    render();
    showFeedback(`已选择轴点 ${state.pivot}，现在从右向左检查`, "success");
  }

  function inspectPointerElement(pointer) {
    const expectedPhase = pointer === "right" ? "scanRight" : "scanLeft";
    if (state.phase !== expectedPhase) return;
    if (state.awaitingPointerMove) {
      showFeedback("关系已经判断，请观察指针移动", "info", 1200);
      return;
    }

    const index = pointer === "right" ? state.right : state.left;
    const value = state.array[index];
    if (value == null) {
      showFeedback("指针当前指向空位，请继续移动", "error");
      return;
    }

    pushHistory();
    const needsMove = pointer === "right" ? value < state.pivot : value > state.pivot;
    const operator = value < state.pivot ? "<" : value > state.pivot ? ">" : "=";
    state.operations += 1;
    state.compares += 1;
    state.lastCompared = index;
    state.justSettled = null;
    state.comparison = {
      pointer,
      index,
      value,
      pivot: state.pivot,
      operator,
      needsMove
    };

    if (needsMove) {
      state.pendingMove = {
        source: index,
        hole: state.hole,
        value,
        direction: pointer === "right" ? "right" : "left"
      };
      state.phase = "moveElement";
      state.activePointer = pointer;
      state.awaitingPointerMove = null;
      render();
      showFeedback(
        `${value} ${operator} ${state.pivot}，需要移动到${pointer === "right" ? "左侧" : "右侧"}空位`,
        "success",
        2500
      );
      return;
    }

    const nextIndex = pointer === "right" ? index - 1 : index + 1;
    state.awaitingPointerMove = { pointer, from: index, to: nextIndex };
    render();
    showFeedback(
      `${value} ${operator} ${state.pivot}，不需要移动；指针将${pointer === "right" ? "向左" : "向右"}移动`,
      "success",
      1700
    );

    window.clearTimeout(state.pointerTimer);
    state.pointerTimer = window.setTimeout(completePointerMove, 520);
  }

  function completePointerMove() {
    const waiting = state.awaitingPointerMove;
    if (!waiting) return false;
    window.clearTimeout(state.pointerTimer);
    state.pointerTimer = null;
    state.awaitingPointerMove = null;
    if (waiting.pointer === "right") {
      state.right = waiting.to;
    } else {
      state.left = waiting.to;
    }
    if (state.left >= state.right) {
      state.phase = "placePivot";
      state.activePointer = null;
      render();
      showFeedback("左右指针相遇，请把轴点放进空位", "success", 2200);
      return true;
    }
    render();
    return true;
  }

  function movePendingElement() {
    if (state.phase !== "moveElement" || !state.pendingMove) return;
    const move = state.pendingMove;
    pushHistory();
    state.array[move.hole] = state.array[move.source];
    state.array[move.source] = null;
    state.hole = move.source;
    state.operations += 1;
    state.moves += 1;
    state.lastCompared = null;
    state.comparison = null;
    state.justSettled = move.hole;

    if (move.direction === "right") {
      state.left += 1;
      state.activePointer = state.left < state.right ? "left" : null;
    } else {
      state.right -= 1;
      state.activePointer = state.left < state.right ? "right" : null;
    }

    const nextPointer = state.activePointer;
    state.pendingMove = null;
    if (state.left >= state.right || nextPointer == null) {
      state.phase = "placePivot";
      state.activePointer = null;
    } else {
      state.phase = nextPointer === "left" ? "scanLeft" : "scanRight";
    }

    render();
    if (state.phase === "placePivot") {
      showFeedback("元素已填入空位，左右指针相遇", "success", 1900);
    } else {
      showFeedback(`元素已移动，换成 ${nextPointer === "left" ? "L" : "R"} 指针继续`, "success", 1900);
    }
  }

  function placePivot() {
    if (state.phase !== "placePivot" || state.pivot == null) return;
    pushHistory();
    const pivotIndex = state.left;
    state.array[pivotIndex] = state.pivot;
    state.pivot = null;
    state.hole = null;
    state.operations += 1;
    state.partitions += 1;
    state.solved.push(pivotIndex);
    state.lastCompared = null;
    state.comparison = null;
    state.justSettled = pivotIndex;
    state.activePointer = null;

    const leftRange = { start: state.range.start, end: pivotIndex - 1 };
    const rightRange = { start: pivotIndex + 1, end: state.range.end };
    [leftRange, rightRange].forEach((range) => {
      if (range.end - range.start === 0) {
        if (!state.solved.includes(range.start)) state.solved.push(range.start);
      }
    });
    if (rightRange.end - rightRange.start >= 1) state.pending.push(rightRange);
    if (leftRange.end - leftRange.start >= 1) state.pending.push(leftRange);

    state.phase = "partitionDone";
    render();
    showFeedback(`轴点已就位，第 ${state.round} 轮分区完成`, "success", 2100);
  }

  function advanceToNextSegment() {
    if (state.phase !== "partitionDone") return;
    if (state.pending.length === 0) {
      finishSorting();
      return;
    }
    const nextRange = state.pending.pop();
    state.range = nextRange;
    state.round += 1;
    state.phase = "selectPivot";
    state.pivot = null;
    state.left = null;
    state.right = null;
    state.hole = null;
    state.activePointer = null;
    state.pendingMove = null;
    state.lastCompared = null;
    state.comparison = null;
    state.justSettled = null;
    render();
    showFeedback(`进入第 ${state.round} 轮，请选择最左元素作为轴点`);
  }

  function finishSorting() {
    state.phase = "complete";
    state.pending = [];
    state.solved = state.array.map((_, index) => index);
    state.activePointer = null;
    state.lastCompared = null;
    state.comparison = null;
    render();
    if (!state.celebrated) {
      state.celebrated = true;
      celebrate();
    }
    showFeedback("排序成功！所有元素都已按从小到大排列", "success", 2600);
  }

  function performMainAction() {
    switch (state.phase) {
      case "selectPivot":
        flashBar(state.range.start, "ok");
        showFeedback("点击图中带呼吸光晕的最左柱子", "info", 1800);
        break;
      case "scanRight":
        inspectPointerElement("right");
        break;
      case "scanLeft":
        inspectPointerElement("left");
        break;
      case "moveElement":
        movePendingElement();
        break;
      case "placePivot":
        placePivot();
        break;
      case "partitionDone":
        advanceToNextSegment();
        break;
      case "complete":
        resetFromOriginal();
        showFeedback("已回到本题初始顺序，可以重新练习", "success");
        break;
      default:
        break;
    }
  }

  function handleBarActivation(index) {
    if (performance.now() < state.suppressClickUntil) return;
    if (state.phase === "selectPivot") {
      choosePivot(index);
      return;
    }
    if (state.phase === "scanRight") {
      if (state.awaitingPointerMove) {
        showFeedback("关系已经判断，请观察 R 指针向左移动", "info", 1300);
        return;
      }
      if (index !== state.right) {
        showFeedback(`请先点击 R 指针下的元素（第 ${state.right + 1} 项）`, "error", 2100);
        flashBar(state.right, "ok");
        return;
      }
      inspectPointerElement("right");
      return;
    }
    if (state.phase === "scanLeft") {
      if (state.awaitingPointerMove) {
        showFeedback("关系已经判断，请观察 L 指针向右移动", "info", 1300);
        return;
      }
      if (index !== state.left) {
        showFeedback(`请先点击 L 指针下的元素（第 ${state.left + 1} 项）`, "error", 2100);
        flashBar(state.left, "ok");
        return;
      }
      inspectPointerElement("left");
      return;
    }
    if (state.phase === "moveElement") {
      if (index === state.pendingMove?.hole) {
        movePendingElement();
      } else {
        showFeedback("请点击或拖动元素到虚线空位", "error");
      }
      return;
    }
    if (state.phase === "placePivot") {
      if (index === state.hole) {
        placePivot();
      } else {
        showFeedback("请把轴点放入虚线空位", "error");
      }
      return;
    }
    if (state.phase === "partitionDone") {
      showFeedback("请点击“继续下一组”选择下一个子数组");
    }
  }

  function indexAtClientX(clientX) {
    const rect = dom.chart.getBoundingClientRect();
    const ratio = Math.min(0.9999, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.min(state.array.length - 1, Math.floor(ratio * state.array.length));
  }

  function cleanupDrag() {
    document.body.classList.remove("dragging");
    dom.dragGhost.classList.remove("visible");
    dom.dragGhost.textContent = "";
    state.drag = null;
    document.querySelectorAll(".pointer-tag.dragging, .bar-button.drag-source, .bar-button.drop-target, .bar-button.drop-ready")
      .forEach((element) => element.classList.remove("dragging", "drag-source", "drop-target", "drop-ready"));
    document.removeEventListener("pointermove", handleDragMove);
    document.removeEventListener("pointerup", handleDragEnd);
    document.removeEventListener("pointercancel", handleDragEnd);
  }

  function startPointerDrag(event, pointer, tagElement) {
    if (state.drag) return;
    state.drag = {
      kind: "pointer",
      pointer,
      startX: event.clientX,
      startY: event.clientY,
      target: null,
      moved: false
    };
    tagElement.classList.add("dragging");
    tagElement.setPointerCapture?.(event.pointerId);
    document.body.classList.add("dragging");
    document.addEventListener("pointermove", handleDragMove, { passive: false });
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointercancel", handleDragEnd);
  }

  function startElementDrag(event, index, barElement) {
    if (state.drag || state.phase !== "moveElement" || index !== state.pendingMove?.source) return;
    state.drag = {
      kind: "element",
      source: index,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    barElement.classList.add("drag-source");
    dom.chart.querySelector(`[data-index="${state.pendingMove.hole}"]`)?.classList.add("drop-ready");
    dom.dragGhost.textContent = String(state.pendingMove.value);
    dom.dragGhost.style.left = `${event.clientX}px`;
    dom.dragGhost.style.top = `${event.clientY}px`;
    dom.dragGhost.classList.add("visible");
    barElement.setPointerCapture?.(event.pointerId);
    document.body.classList.add("dragging");
    document.addEventListener("pointermove", handleDragMove, { passive: false });
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointercancel", handleDragEnd);
  }

  function startPivotDrag(event) {
    if (state.drag || state.phase !== "placePivot" || state.pivot == null) {
      if (state.pivot != null) showFeedback("等左右指针相遇后，再把轴点放入空位");
      return;
    }
    state.drag = {
      kind: "pivot",
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    dom.dragGhost.textContent = String(state.pivot);
    dom.dragGhost.style.left = `${event.clientX}px`;
    dom.dragGhost.style.top = `${event.clientY}px`;
    dom.dragGhost.classList.add("visible");
    dom.chart.querySelector(`[data-index="${state.hole}"]`)?.classList.add("drop-ready");
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.classList.add("dragging");
    document.addEventListener("pointermove", handleDragMove, { passive: false });
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointercancel", handleDragEnd);
  }

  function handleDragMove(event) {
    if (!state.drag) return;
    event.preventDefault();
    const drag = state.drag;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
    if (moved) drag.moved = true;

    if (drag.kind === "pointer") {
      if (!moved) return;
      const index = indexAtClientX(event.clientX);
      drag.target = index;
      const tag = dom.pointerLayer.querySelector(`[data-pointer="${drag.pointer}"]`);
      if (tag) {
        tag.style.left = `${((index + 0.5) / state.array.length) * 100}%`;
      }
      dom.chart.querySelectorAll(".drop-target").forEach((element) => element.classList.remove("drop-target"));
      const valid = drag.pointer === "right"
        ? index < state.right && index >= state.range.start
        : index > state.left && index <= state.range.end;
      if (valid) dom.chart.querySelector(`[data-index="${index}"]`)?.classList.add("drop-target");
      return;
    }

    if (drag.kind === "element" || drag.kind === "pivot") {
      dom.dragGhost.style.left = `${event.clientX}px`;
      dom.dragGhost.style.top = `${event.clientY}px`;
    }
  }

  function handleDragEnd(event) {
    if (!state.drag) return;
    const drag = state.drag;
    const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".bar-button");
    const targetIndex = elementAtPoint ? Number(elementAtPoint.dataset.index) : null;

    if (drag.kind === "pointer" && drag.moved) {
      state.suppressClickUntil = performance.now() + 280;
      const target = drag.target;
      cleanupDrag();
      if (target == null) return;
      if (drag.pointer === "right" && target < state.right) {
        movePointer("right", target);
      } else if (drag.pointer === "left" && target > state.left) {
        movePointer("left", target);
      } else {
        showFeedback("请沿正确方向拖动指针", "error");
      }
      return;
    }

    if (drag.kind === "element" && drag.moved) {
      state.suppressClickUntil = performance.now() + 280;
      const expectedHole = state.pendingMove?.hole;
      cleanupDrag();
      if (targetIndex === expectedHole) {
        movePendingElement();
      } else {
        showFeedback("请把元素拖到虚线空位中", "error");
      }
      return;
    }

    if (drag.kind === "pivot" && drag.moved) {
      state.suppressClickUntil = performance.now() + 280;
      const expectedHole = state.hole;
      cleanupDrag();
      if (targetIndex === expectedHole) {
        placePivot();
      } else {
        showFeedback("请把轴点拖到虚线空位中", "error");
      }
      return;
    }

    cleanupDrag();
  }

  function celebrate() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ff9991", "#b7d88c", "#f3c96f", "#85b8e8", "#f4f3ee"];
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 28; index += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      const angle = (Math.PI * 2 * index) / 28 + Math.random() * 0.4;
      const distance = 80 + Math.random() * 150;
      piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      piece.style.setProperty("--dy", `${Math.sin(angle) * distance + 45}px`);
      piece.style.setProperty("--rot", `${180 + Math.random() * 540}deg`);
      piece.style.background = colors[index % colors.length];
      piece.style.animationDelay = `${Math.random() * 110}ms`;
      fragment.appendChild(piece);
    }
    dom.confettiLayer.replaceChildren(fragment);
    window.setTimeout(() => dom.confettiLayer.replaceChildren(), 1200);
  }

  dom.chart.addEventListener("click", (event) => {
    const bar = event.target.closest(".bar-button");
    if (!bar) return;
    handleBarActivation(Number(bar.dataset.index));
  });

  dom.chart.addEventListener("pointerdown", (event) => {
    const bar = event.target.closest(".bar-button");
    if (!bar || state.phase !== "moveElement") return;
    const index = Number(bar.dataset.index);
    if (index === state.pendingMove?.source) {
      startElementDrag(event, index, bar);
    }
  });

  dom.pointerLayer.addEventListener("click", (event) => {
    const hitZone = event.target.closest(".pointer-hit-zone");
    if (!hitZone) return;
    if (hitZone.dataset.action === "pivot") {
      choosePivot(state.range.start);
      return;
    }
    if (state.awaitingPointerMove) {
      showFeedback("关系已经判断，请观察指针移动", "info", 1300);
      return;
    }
    inspectPointerElement(hitZone.dataset.pointer);
  });

  dom.pivotToken.addEventListener("pointerdown", startPivotDrag);
  dom.pivotToken.addEventListener("click", () => {
    if (performance.now() < state.suppressClickUntil) return;
    if (state.phase === "placePivot") {
      placePivot();
    } else if (state.pivot != null) {
      showFeedback("等左右指针相遇后，再把轴点放入空位");
    } else {
      showFeedback("请先点击当前子数组最左侧元素");
    }
  });

  dom.mainAction.addEventListener("click", performMainAction);
  dom.undoButton.addEventListener("click", undo);
  dom.resetButton.addEventListener("click", () => {
    resetFromOriginal();
    showFeedback("已恢复到本题初始顺序");
  });
  dom.randomButton.addEventListener("click", () => setRandomArray(dom.countInput.value));
  dom.applyCustom.addEventListener("click", applyCustomSequence);

  dom.countRange.addEventListener("input", () => {
    const count = clampInteger(dom.countRange.value, 2, MAX_ELEMENTS);
    dom.countInput.value = String(count);
    dom.countValue.textContent = String(count);
    dom.randomCount.textContent = String(count);
  });
  dom.countRange.addEventListener("change", () => setRandomArray(dom.countRange.value));
  dom.countInput.addEventListener("change", () => setRandomArray(dom.countInput.value));

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === "Enter" && !dom.mainAction.disabled) {
      event.preventDefault();
      performMainAction();
    } else if (event.key.toLowerCase() === "r" && state.phase === "scanRight") {
      event.preventDefault();
      performMainAction();
    } else if (event.key.toLowerCase() === "l" && state.phase === "scanLeft") {
      event.preventDefault();
      performMainAction();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
  });

  window.addEventListener("resize", () => {
    if (!state.drag) renderPointerLayer();
  });

  window.__manualQuicksort = {
    getState: () => ({
      array: state.array.slice(),
      original: state.original.slice(),
      phase: state.phase,
      range: { ...state.range },
      pending: state.pending.map((range) => ({ ...range })),
      solved: state.solved.slice(),
      pivot: state.pivot,
      left: state.left,
      right: state.right,
      hole: state.hole,
      pendingMove: state.pendingMove ? { ...state.pendingMove } : null,
      round: state.round,
      operations: state.operations,
      compares: state.compares,
      moves: state.moves,
      partitions: state.partitions,
      comparison: state.comparison ? { ...state.comparison } : null,
      awaitingPointerMove: state.awaitingPointerMove ? { ...state.awaitingPointerMove } : null,
      historyLength: state.history.length,
      drag: state.drag ? { ...state.drag } : null
    }),
    choosePivot,
    inspectPointerElement,
    completePointerMove,
    movePendingElement,
    placePivot,
    advanceToNextSegment,
    performMainAction,
    undo,
    resetFromOriginal,
    setRandomArray,
    applyCustomSequence
  };

  loadArray(shuffledPermutation(DEFAULT_COUNT), "");
})();

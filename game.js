(() => {
  const columns = 5;
  const rows = 4;
  const pieceTotal = columns * rows;
  const boardWidth = 700;
  const boardHeightLimit = 440;
  const boardX = 52;
  const boardY = 130;
  const trayGap = 54;
  const trayPadding = 20;
  const pieceGap = 14;

  const svg = document.querySelector("#puzzle-board");
  const defs = document.querySelector("#board-defs");
  const art = document.querySelector("#board-art");
  const pieceLayer = document.querySelector("#piece-layer");
  const status = document.querySelector("#game-status");
  const placedCount = document.querySelector("#placed-count");
  const elapsedTime = document.querySelector("#elapsed-time");
  const restartButton = document.querySelector("#restart-button");
  const soundToggle = document.querySelector("#sound-toggle");
  const soundLabel = document.querySelector("#sound-label");
  const gameCard = document.querySelector(".game-card");
  const sourceImage = new Image();

  let puzzleWidth = boardWidth;
  let puzzleHeight = boardHeightLimit;
  let cellWidth = puzzleWidth / columns;
  let cellHeight = puzzleHeight / rows;
  let trayX = 0;
  let tabDepth = 0;
  let slotPitchX = 0;
  let slotPitchY = 0;
  let trayWidth = 0;
  let trayHeight = 0;
  let pieces = [];
  let placed = 0;
  let activePiece = null;
  let pointerStart = null;
  let audioContext = null;
  let musicEnabled = true;
  let musicTimer = null;
  let musicPhrase = 0;
  let gameStartedAt = null;
  let timerInterval = null;
  const musicChords = [
    [261.63, 392, 329.63, 392, 523.25],
    [220, 329.63, 261.63, 329.63, 440],
    [174.61, 261.63, 220, 261.63, 349.23],
    [196, 293.66, 246.94, 293.66, 392],
  ];

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
    return element;
  }

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * index);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function formatElapsedTime(durationMs) {
    const totalSeconds = Math.floor(durationMs / 1000);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = String(totalMinutes % 60).padStart(2, "0");
    const hours = Math.floor(totalMinutes / 60);
    return hours > 0
      ? `${String(hours).padStart(2, "0")}:${minutes}:${seconds}`
      : `${String(totalMinutes).padStart(2, "0")}:${seconds}`;
  }

  function updateElapsedTime() {
    if (gameStartedAt !== null) {
      elapsedTime.textContent = formatElapsedTime(Date.now() - gameStartedAt);
    }
  }

  function startTimer() {
    if (gameStartedAt !== null) return;
    gameStartedAt = Date.now();
    timerInterval = window.setInterval(updateElapsedTime, 250);
  }

  function stopTimer() {
    if (timerInterval !== null) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }
    updateElapsedTime();
  }

  function getAudioContext() {
    if (!window.AudioContext) {
      soundToggle.disabled = true;
      soundToggle.title = "browser นี้ไม่รองรับเสียง Web Audio";
      soundLabel.textContent = "ไม่รองรับเสียง";
      return null;
    }
    if (!audioContext) audioContext = new window.AudioContext();
    return audioContext;
  }

  function playTone(frequency, startAt, duration, volume, waveform = "sine") {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.12);
    gain.gain.setValueAtTime(volume * 0.72, startAt + duration * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  function playMusicPhrase() {
    if (!audioContext || !musicEnabled) return;
    const now = audioContext.currentTime;
    musicChords[musicPhrase].forEach((frequency, index) => {
      playTone(frequency, now + index * 0.82, 1.15, 0.025);
    });
    musicPhrase = (musicPhrase + 1) % musicChords.length;
  }

  function startMusic() {
    if (!musicEnabled) return;
    const context = getAudioContext();
    if (!context || musicTimer !== null) return;

    context.resume().then(() => {
      if (!musicEnabled || musicTimer !== null) return;
      musicPhrase = 0;
      playMusicPhrase();
      musicTimer = window.setInterval(playMusicPhrase, 4400);
    }).catch(() => {
      musicEnabled = false;
      soundToggle.setAttribute("aria-pressed", "false");
      soundToggle.title = "ไม่สามารถเริ่มเสียงได้ใน browser นี้";
      soundLabel.textContent = "เพลงปิด";
    });
  }

  function stopMusic() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function playCompletionSound() {
    if (!musicEnabled || !audioContext || audioContext.state !== "running") return;
    const now = audioContext.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      playTone(frequency, now + index * 0.16, 0.8, 0.07, "triangle");
    });
  }

  function playClickSound(placedPiece = false) {
    if (!musicEnabled) return;
    const context = getAudioContext();
    if (!context) return;

    const play = () => {
      if (musicEnabled && context.state === "running") {
        playTone(placedPiece ? 880 : 660, context.currentTime, 0.11, 0.035, "triangle");
      }
    };

    if (context.state === "running") {
      play();
    } else {
      context.resume().then(play).catch(() => {
        status.textContent = "เปิดเสียงไม่ได้ กรุณาลองอีกครั้ง";
      });
    }
  }

  function edgePath(startX, startY, endX, endY, normal, isTab) {
    const horizontal = startY === endY;
    const start = horizontal ? startX : startY;
    const end = horizontal ? endX : endY;
    const fixed = horizontal ? startY : startX;
    const point = (amount, offset = 0) => {
      const along = start + (end - start) * amount;
      const across = fixed + offset;
      return horizontal ? `${along} ${across}` : `${across} ${along}`;
    };

    if (!isTab) {
      return `L ${point(1)}`;
    }

    const amplitude = tabDepth * normal;
    return [
      `L ${point(0.36)}`,
      `C ${point(0.4)} ${point(0.4, amplitude)} ${point(0.5, amplitude)}`,
      `C ${point(0.6, amplitude)} ${point(0.6)} ${point(0.64)}`,
      `L ${point(1)}`,
    ].join(" ");
  }

  function makePiecePath(row, column, horizontalEdges, verticalEdges) {
    const left = boardX + column * cellWidth;
    const top = boardY + row * cellHeight;
    const right = left + cellWidth;
    const bottom = top + cellHeight;
    const hasTopTab = row > 0;
    const hasRightTab = column < columns - 1;
    const hasBottomTab = row < rows - 1;
    const hasLeftTab = column > 0;
    const topNormal = hasTopTab ? horizontalEdges[row - 1][column] : 0;
    const rightNormal = hasRightTab ? verticalEdges[row][column] : 0;
    const bottomNormal = hasBottomTab ? horizontalEdges[row][column] : 0;
    const leftNormal = hasLeftTab ? verticalEdges[row][column - 1] : 0;

    return [
      `M ${left} ${top}`,
      edgePath(left, top, right, top, topNormal, hasTopTab),
      edgePath(right, top, right, bottom, rightNormal, hasRightTab),
      edgePath(right, bottom, left, bottom, bottomNormal, hasBottomTab),
      edgePath(left, bottom, left, top, leftNormal, hasLeftTab),
      "Z",
    ].join(" ");
  }

  function setupBoard() {
    const aspectRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
    puzzleWidth = Math.min(boardWidth, boardHeightLimit * aspectRatio);
    puzzleHeight = puzzleWidth / aspectRatio;
    cellWidth = puzzleWidth / columns;
    cellHeight = puzzleHeight / rows;
    tabDepth = Math.min(cellWidth, cellHeight) * 0.19;
    slotPitchX = cellWidth + tabDepth * 2 + pieceGap;
    slotPitchY = cellHeight + tabDepth * 2 + pieceGap;
    trayX = boardX + puzzleWidth + trayGap;
    trayWidth = (columns - 1) * slotPitchX + cellWidth + tabDepth * 2 + trayPadding * 2;
    trayHeight = (rows - 1) * slotPitchY + cellHeight + tabDepth * 2 + trayPadding * 2;

    const viewWidth = trayX + trayWidth + boardX;
    const viewHeight = Math.max(680, boardY + trayHeight + 54);
    svg.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);

    defs.replaceChildren();
    art.replaceChildren();
    pieceLayer.replaceChildren();
    pieces = [];
    placed = 0;
    placedCount.textContent = "0";
    elapsedTime.textContent = "00:00";
    gameStartedAt = null;
    if (timerInterval !== null) {
      window.clearInterval(timerInterval);
      timerInterval = null;
    }
    gameCard.classList.remove("is-complete");

    const boardTitle = svgElement("text", {
      x: boardX,
      y: 54,
      class: "board-label",
    });
    boardTitle.textContent = "พื้นที่ต่อภาพ";
    const boardSubtitle = svgElement("text", {
      x: boardX,
      y: 76,
      class: "board-sublabel",
    });
    boardSubtitle.textContent = "ต่อชิ้นส่วนให้ครบภาพ";

    const trayTitle = svgElement("text", {
      x: trayX,
      y: 54,
      class: "board-label",
    });
    trayTitle.textContent = "ชิ้นส่วน";
    const traySubtitle = svgElement("text", {
      x: trayX,
      y: 76,
      class: "board-sublabel",
    });
    traySubtitle.textContent = "ลากไปวางในพื้นที่ด้านซ้าย";

    const boardBackground = svgElement("rect", {
      x: boardX,
      y: boardY,
      width: puzzleWidth,
      height: puzzleHeight,
      rx: 5,
      fill: "#ffffff",
    });
    const trayBackground = svgElement("rect", {
      x: trayX,
      y: boardY,
      width: trayWidth,
      height: trayHeight,
      rx: 16,
      fill: "#f0f3f8",
      stroke: "#e5e9f0",
      "stroke-width": 1,
    });

    art.append(trayBackground, boardBackground, boardTitle, boardSubtitle, trayTitle, traySubtitle);

    const horizontalEdges = Array.from({ length: rows - 1 }, () =>
      Array.from({ length: columns }, () => (Math.random() < 0.5 ? -1 : 1)),
    );
    const verticalEdges = Array.from({ length: rows }, () =>
      Array.from({ length: columns - 1 }, () => (Math.random() < 0.5 ? -1 : 1)),
    );

    const slots = shuffle(
      Array.from({ length: pieceTotal }, (_, index) => ({
        row: Math.floor(index / columns),
        column: index % columns,
      })),
    );

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const path = makePiecePath(row, column, horizontalEdges, verticalEdges);
        const clip = svgElement("clipPath", {
          id: `piece-clip-${index}`,
          clipPathUnits: "userSpaceOnUse",
        });
        clip.append(svgElement("path", { d: path }));
        defs.append(clip);

        const slot = slots[index];
        const targetLeft = boardX + column * cellWidth;
        const targetTop = boardY + row * cellHeight;
        const slotLeft = trayX + trayPadding + tabDepth + slot.column * slotPitchX;
        const slotTop = boardY + trayPadding + tabDepth + slot.row * slotPitchY;
        const piece = svgElement("g", {
          class: "piece",
          "data-piece": index,
          transform: `translate(${slotLeft - targetLeft} ${slotTop - targetTop})`,
          role: "img",
          "aria-label": `ชิ้นส่วนที่ ${index + 1}`,
        });
        const image = svgElement("image", {
          x: boardX,
          y: boardY,
          width: puzzleWidth,
          height: puzzleHeight,
          href: "car.webp",
          "clip-path": `url(#piece-clip-${index})`,
          preserveAspectRatio: "none",
        });
        const outline = svgElement("path", {
          d: path,
          class: "piece-outline",
          "pointer-events": "none",
        });
        piece.append(image, outline);
        pieceLayer.append(piece);
        pieces.push({
          element: piece,
          x: slotLeft - targetLeft,
          y: slotTop - targetTop,
          locked: false,
        });
      }
    }

    status.textContent = "ลากชิ้นส่วนจากถาดด้านขวามาวางในพื้นที่ด้านซ้าย";
    restartButton.disabled = false;
  }

  function eventPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function handlePointerDown(event) {
    const pieceElement = event.target.closest("[data-piece]");
    if (!pieceElement || event.button !== 0) return;

    const piece = pieces[Number(pieceElement.dataset.piece)];
    if (!piece || piece.locked) return;

    event.preventDefault();
    activePiece = piece;
    pointerStart = eventPoint(event);
    startTimer();
    startMusic();
    playClickSound();
    piece.element.classList.add("is-dragging");
    pieceLayer.append(piece.element);
    svg.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!activePiece || !pointerStart) return;

    const point = eventPoint(event);
    activePiece.x += point.x - pointerStart.x;
    activePiece.y += point.y - pointerStart.y;
    pointerStart = point;
    activePiece.element.setAttribute("transform", `translate(${activePiece.x} ${activePiece.y})`);
  }

  function handlePointerUp(event) {
    if (!activePiece) return;

    const piece = activePiece;
    piece.element.classList.remove("is-dragging");
    if (Math.hypot(piece.x, piece.y) <= Math.min(cellWidth, cellHeight) * 0.3) {
      piece.x = 0;
      piece.y = 0;
      piece.locked = true;
      piece.element.classList.add("is-placed");
      piece.element.setAttribute("transform", "translate(0 0)");
      placed += 1;
      placedCount.textContent = String(placed);
      playClickSound(true);

      if (placed === pieceTotal) {
        stopTimer();
        stopMusic();
        playCompletionSound();
        status.textContent = `ยอดเยี่ยม! ต่อภาพครบแล้ว ใช้เวลา ${elapsedTime.textContent}`;
        gameCard.classList.add("is-complete");
      } else {
        status.textContent = `วางถูกต้องแล้ว เหลืออีก ${pieceTotal - placed} ชิ้น`;
      }
    }

    activePiece = null;
    pointerStart = null;
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerCancel() {
    if (!activePiece) return;
    activePiece.element.classList.remove("is-dragging");
    activePiece = null;
    pointerStart = null;
  }

  restartButton.addEventListener("click", () => {
    setupBoard();
    playClickSound();
  });
  soundToggle.addEventListener("click", () => {
    musicEnabled = !musicEnabled;
    soundToggle.setAttribute("aria-pressed", String(musicEnabled));
    soundLabel.textContent = musicEnabled ? "เพลงเปิด" : "เพลงปิด";
    soundToggle.title = musicEnabled
      ? "เพลงจะเริ่มเมื่อเริ่มลากชิ้นส่วน"
      : "เปิดเสียงเพลงและเอฟเฟกต์";
    if (musicEnabled) {
      startMusic();
      playClickSound();
    } else {
      stopMusic();
    }
  });
  svg.addEventListener("pointerdown", handlePointerDown);
  svg.addEventListener("pointermove", handlePointerMove);
  svg.addEventListener("pointerup", handlePointerUp);
  svg.addEventListener("pointercancel", handlePointerCancel);

  sourceImage.addEventListener("load", setupBoard);
  sourceImage.addEventListener("error", () => {
    status.textContent = "โหลดภาพ car.webp ไม่สำเร็จ กรุณาตรวจสอบว่าไฟล์อยู่ในโฟลเดอร์เดียวกับเกม";
    restartButton.disabled = true;
  });
  sourceImage.src = "car.webp";
})();

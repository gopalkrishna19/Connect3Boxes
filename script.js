const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const board = document.getElementById('game-board');
const resetBtn = document.getElementById('reset-btn');

// State
let lines = []; // { type: 'A', points: [{x,y}, ...], color: string, startBoxId: string, endBoxId: string }
let currentLine = null; // { type: 'A', points: [], color: string, startBoxId: string }
let isDrawing = false;
let boxes = [];

// Configuration
const LINE_WIDTH = 8;
const COLORS = {
    'A': '#f43f5e',
    'B': '#3b82f6',
    'C': '#22c55e'
};

// Initialize
const winScreen = document.getElementById('win-screen');
const playAgainBtn = document.getElementById('play-again-btn');

function init() {
    resizeCanvas();
    updateBoxPositions();
    window.addEventListener('resize', () => {
        resizeCanvas();
        updateBoxPositions();
        draw();
    });

    // Mouse Events
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', () => {
        if (isDrawing) {
            cancelDrawing();
        }
    });

    // Touch Events
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    });

    resetBtn.addEventListener('click', resetGame);
    playAgainBtn.addEventListener('click', resetGame);

    // Initial Draw
    draw();
}

function resizeCanvas() {
    const rect = board.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}

function updateBoxPositions() {
    const boxElements = document.querySelectorAll('.box');
    boxes = Array.from(boxElements).map(el => {
        const rect = el.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        return {
            id: el.id,
            type: el.dataset.type,
            x: rect.left - boardRect.left,
            y: rect.top - boardRect.top,
            width: rect.width,
            height: rect.height,
            el: el
        };
    });
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function handleStart(e) {
    const pos = getMousePos(e);
    const box = getBoxAt(pos);

    if (box) {
        // Check if this box is already connected or part of a completed line
        // Actually, we usually allow redrawing. So if we start from a box that has a line, we might remove that line.
        removeLinesConnectedTo(box.id);

        isDrawing = true;
        currentLine = {
            type: box.type,
            points: [pos],
            color: COLORS[box.type],
            startBoxId: box.id
        };
        draw();
    }
}

function handleMove(e) {
    if (!isDrawing || !currentLine) return;

    const pos = getMousePos(e);
    const lastPoint = currentLine.points[currentLine.points.length - 1];

    // Distance check to avoid too many points
    const dist = Math.hypot(pos.x - lastPoint.x, pos.y - lastPoint.y);
    if (dist < 5) return;

    // Collision Check
    if (checkCollision(pos, lastPoint)) {
        // Collision detected! Stop drawing or just don't add point?
        // Usually, we stop drawing or show invalid state.
        // Let's cancel drawing for strictness.
        cancelDrawing();
        return;
    }

    currentLine.points.push(pos);
    draw();
}

function handleEnd(e) {
    if (!isDrawing || !currentLine) return;

    const pos = getMousePos(e);
    const box = getBoxAt(pos);

    if (box) {
        // Check if it's a valid target
        if (box.type === currentLine.type && box.id !== currentLine.startBoxId) {
            // Success!
            // Remove any existing lines connected to the end box
            removeLinesConnectedTo(box.id);

            // Add final point to center of box for snap effect? 
            // Or just current pos. Let's snap to center of box if we want it to look clean.
            // But user drew freehand. Let's just keep the path.

            lines.push({
                ...currentLine,
                endBoxId: box.id
            });

            checkWinCondition();
        } else {
            // Invalid target (same box or different type)
            // Cancel
        }
    }

    isDrawing = false;
    currentLine = null;
    draw();
}

function cancelDrawing() {
    isDrawing = false;
    currentLine = null;
    draw();
}

function getBoxAt(pos) {
    return boxes.find(box =>
        pos.x >= box.x &&
        pos.x <= box.x + box.width &&
        pos.y >= box.y &&
        pos.y <= box.y + box.height
    );
}

function removeLinesConnectedTo(boxId) {
    lines = lines.filter(l => l.startBoxId !== boxId && l.endBoxId !== boxId);
}

function checkCollision(newPoint, lastPoint) {
    // 1. Check Canvas Borders
    if (newPoint.x < 0 || newPoint.x > canvas.width || newPoint.y < 0 || newPoint.y > canvas.height) {
        return true;
    }

    // 2. Check Boxes
    for (const box of boxes) {
        if (box.id === currentLine.startBoxId) continue;
        if (box.type === currentLine.type) continue;

        if (lineIntersectsRect(lastPoint, newPoint, box)) {
            return true;
        }
    }

    // 3. Check Existing Lines
    for (const line of lines) {
        for (let i = 0; i < line.points.length - 1; i++) {
            const p1 = line.points[i];
            const p2 = line.points[i + 1];
            if (getLineIntersection(lastPoint, newPoint, p1, p2)) {
                return true;
            }
        }
    }

    // 4. Check Self Intersection
    if (currentLine.points.length > 10) {
        for (let i = 0; i < currentLine.points.length - 10; i++) {
            const p1 = currentLine.points[i];
            const p2 = currentLine.points[i + 1];
            if (getLineIntersection(lastPoint, newPoint, p1, p2)) {
                return true;
            }
        }
    }

    return false;
}

// Helper: Line Segment Intersection
function getLineIntersection(p0, p1, p2, p3) {
    const det = (p1.x - p0.x) * (p3.y - p2.y) - (p3.x - p2.x) * (p1.y - p0.y);
    if (det === 0) {
        return false;
    }
    const lambda = ((p3.y - p2.y) * (p3.x - p0.x) + (p2.x - p3.x) * (p3.y - p0.y)) / det;
    const gamma = ((p0.y - p1.y) * (p3.x - p0.x) + (p1.x - p0.x) * (p3.y - p0.y)) / det;
    return (0 <= lambda && lambda <= 1) && (0 <= gamma && gamma <= 1);
}

// Helper: Line Intersects Rect
function lineIntersectsRect(p1, p2, box) {
    const left = box.x;
    const right = box.x + box.width;
    const top = box.y;
    const bottom = box.y + box.height;

    if (getLineIntersection(p1, p2, { x: left, y: top }, { x: right, y: top })) return true;
    if (getLineIntersection(p1, p2, { x: right, y: top }, { x: right, y: bottom })) return true;
    if (getLineIntersection(p1, p2, { x: right, y: bottom }, { x: left, y: bottom })) return true;
    if (getLineIntersection(p1, p2, { x: left, y: bottom }, { x: left, y: top })) return true;

    if (p1.x > left && p1.x < right && p1.y > top && p1.y < bottom) return true;

    return false;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Completed Lines
    lines.forEach(line => drawLine(line));

    // Draw Current Line
    if (currentLine) {
        drawLine(currentLine);
    }
}

function drawLine(line) {
    if (line.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(line.points[0].x, line.points[0].y);

    for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x, line.points[i].y);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = LINE_WIDTH;
    ctx.strokeStyle = line.color;

    ctx.shadowBlur = 10;
    ctx.shadowColor = line.color;

    ctx.stroke();

    ctx.shadowBlur = 0;
}

function resetGame() {
    lines = [];
    currentLine = null;
    isDrawing = false;
    winScreen.classList.add('hidden');
    draw();
}

function checkWinCondition() {
    if (lines.length === 3) {
        setTimeout(() => {
            winScreen.classList.remove('hidden');
        }, 300);
    }
}

// Start
init();

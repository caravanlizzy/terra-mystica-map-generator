/*
 * SVG map renderer. Knows no game rules: it draws whatever `cellFor(x, y)`
 * describes, returning { fill, stroke?, strokeWidth?, selected?, label?,
 * labelColor?, borderEdges?, borderColor?, borderWidth? }.
 *
 * borderEdges are edge indices (0..5) drawn thicker, to mark the water/land
 * boundary; edge i connects vertex i and i+1.
 */
(function (TM) {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';
    const { center, hexPoints, hexVertices, canvasSize } = TM.geometry;
    const { rowWidth, nextHex, outOfBounds } = TM.hexGrid;

    // Edge i (connecting vertex i and i+1) corresponds to direction in nextHex
    const EDGE_TO_DIR = [2, 1, 0, 5, 4, 3];

    function render(svg, opts) {
        const { width, height, form, cellFor, onClick, defs } = opts;
        const size = canvasSize(width, height, form);

        svg.setAttribute('width', size.width);
        svg.setAttribute('height', size.height);
        svg.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height);
        svg.innerHTML = '';

        if (defs) {
            const d = document.createElementNS(NS, 'defs');
            d.innerHTML = defs;
            svg.appendChild(d);
        }

        // Drawn last, so they sit on top of neighboring hex fills.
        const overlay = [];
        const selectedHexes = [];
        const seenEdges = new Set();
        let pathData = '';
        let strokeColor = '#333';
        let strokeWidth = 2;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < rowWidth(width, y, form); x++) {
                const { cx, cy } = center(x, y, form);
                const info = cellFor(x, y) || {};
                if (info.stroke) strokeColor = info.stroke;
                if (info.strokeWidth !== undefined) strokeWidth = info.strokeWidth;

                const g = document.createElementNS(NS, 'g');
                const p = document.createElementNS(NS, 'polygon');
                const points = hexPoints(cx, cy);
                p.setAttribute('points', points);
                p.setAttribute('fill', info.fill || '#ccc');
                p.setAttribute('class', 'hex');
                p.dataset.x = x;
                p.dataset.y = y;
                if (onClick) p.addEventListener('click', () => onClick(x, y));
                g.appendChild(p);

                if (info.selected) {
                    selectedHexes.push({ points });
                }

                const verts = hexVertices(cx, cy);
                const isWater = Boolean(info.isWater);

                for (let ei = 0; ei < 6; ei++) {
                    const dir = EDGE_TO_DIR[ei];
                    const [nx, ny] = nextHex(x, y, dir, form);
                    const isNeighborOob = outOfBounds(nx, ny, width, height, form);
                    const neighborInfo = isNeighborOob ? null : (cellFor(nx, ny) || {});
                    const neighborIsWater = neighborInfo ? Boolean(neighborInfo.isWater) : false;

                    const shouldDraw = isNeighborOob ? !isWater : (!isWater || !neighborIsWater);

                    if (shouldDraw) {
                        const a = verts[ei];
                        const b = verts[(ei + 1) % 6];
                        const k = (a[0] < b[0] || (Math.abs(a[0] - b[0]) < 0.001 && a[1] < b[1]))
                            ? `${a[0].toFixed(1)},${a[1].toFixed(1)}_${b[0].toFixed(1)},${b[1].toFixed(1)}`
                            : `${b[0].toFixed(1)},${b[1].toFixed(1)}_${a[0].toFixed(1)},${a[1].toFixed(1)}`;

                        if (!seenEdges.has(k)) {
                            seenEdges.add(k);
                            pathData += `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} L ${b[0].toFixed(2)} ${b[1].toFixed(2)} `;
                        }
                    }
                }

                if (info.borderEdges && info.borderEdges.length) {
                    info.borderEdges.forEach(ei => {
                        const a = verts[ei];
                        const b = verts[(ei + 1) % 6];
                        overlay.push({ a, b, color: info.borderColor || '#0b3c5d', width: info.borderWidth || 5 });
                    });
                }

                if (info.marker === 'water') {
                    const wave = document.createElementNS(NS, 'path');
                    const d = `M ${(cx - 6).toFixed(1)} ${(cy - 2.5).toFixed(1)} Q ${(cx - 3).toFixed(1)} ${(cy - 5).toFixed(1)} ${cx.toFixed(1)} ${(cy - 2.5).toFixed(1)} T ${(cx + 6).toFixed(1)} ${(cy - 2.5).toFixed(1)} ` +
                              `M ${(cx - 6).toFixed(1)} ${(cy + 2.5).toFixed(1)} Q ${(cx - 3).toFixed(1)} ${cy.toFixed(1)} ${cx.toFixed(1)} ${(cy + 2.5).toFixed(1)} T ${(cx + 6).toFixed(1)} ${(cy + 2.5).toFixed(1)}`;
                    wave.setAttribute('d', d);
                    wave.setAttribute('stroke', info.markerColor || '#888');
                    wave.setAttribute('stroke-width', '1.5');
                    wave.setAttribute('stroke-linecap', 'round');
                    wave.setAttribute('fill', 'none');
                    wave.setAttribute('pointer-events', 'none');
                    wave.setAttribute('class', 'water-marker');
                    g.appendChild(wave);
                }

                if (info.label) {
                    const t = document.createElementNS(NS, 'text');
                    t.setAttribute('x', cx);
                    t.setAttribute('y', cy);
                    t.setAttribute('class', 'label');
                    t.setAttribute('fill', info.labelColor || '#222');
                    t.textContent = info.label;
                    g.appendChild(t);
                }

                svg.appendChild(g);
            }
        }

        if (pathData) {
            const gridLines = document.createElementNS(NS, 'path');
            gridLines.setAttribute('d', pathData);
            gridLines.setAttribute('stroke', strokeColor);
            gridLines.setAttribute('stroke-width', String(strokeWidth));
            gridLines.setAttribute('stroke-linecap', 'round');
            gridLines.setAttribute('fill', 'none');
            gridLines.setAttribute('pointer-events', 'none');
            gridLines.setAttribute('class', 'grid-lines');
            svg.appendChild(gridLines);
        }

        selectedHexes.forEach(s => {
            const sp = document.createElementNS(NS, 'polygon');
            sp.setAttribute('points', s.points);
            sp.setAttribute('fill', 'none');
            sp.setAttribute('stroke', '#ff9800');
            sp.setAttribute('stroke-width', '4');
            sp.setAttribute('pointer-events', 'none');
            sp.setAttribute('class', 'selected-hex');
            svg.appendChild(sp);
        });

        overlay.forEach(e => {
            const line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', e.a[0].toFixed(2));
            line.setAttribute('y1', e.a[1].toFixed(2));
            line.setAttribute('x2', e.b[0].toFixed(2));
            line.setAttribute('y2', e.b[1].toFixed(2));
            line.setAttribute('stroke', e.color);
            line.setAttribute('stroke-width', e.width);
            line.setAttribute('stroke-linecap', 'round');
            line.setAttribute('class', 'water-border');
            svg.appendChild(line);
        });

        return size;
    }

    TM.renderer = { render };
})(window.TM = window.TM || {});

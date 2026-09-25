// TT600 lighting and access panel layout tool.
(function() {
  const TOOL_NAME = 'ADDEN';
  const PREFIX = 'tt_light_';

  function asPoint(point) {
    return {
      x: point.x !== undefined ? point.x : point[0],
      y: point.y !== undefined ? point.y : point[1]
    };
  }

  function getSelectedPolygon() {
    if (typeof selectedIds === 'undefined' || !selectedIds || selectedIds.size === 0) return null;
    let selectedEntities = entities.filter(entity => selectedIds.has(entity.id) &&
      entity.layer !== 'BOM_TABLE' && !(entity.id || '').startsWith('tt_'));
    if (selectedEntities.length === 0) return null;

    let selectedBounds = selectedEntities.map(getEntityBounds).filter(Boolean);
    if (selectedBounds.length > 0) {
      let selectionBox = {
        minX: Math.min(...selectedBounds.map(item => item.minX)),
        maxX: Math.max(...selectedBounds.map(item => item.maxX)),
        minY: Math.min(...selectedBounds.map(item => item.minY)),
        maxY: Math.max(...selectedBounds.map(item => item.maxY))
      };
      let result = window.tt600State && window.tt600State.lastResult;
      if (result && result.polyPts && result.polyPts.length >= 3) {
        let width = Math.max(result.xmax - result.xmin, 1);
        let height = Math.max(result.ymax - result.ymin, 1);
        let matchesResult = Math.abs(selectionBox.minX - result.xmin) < Math.max(width * 0.1, 100) &&
          Math.abs(selectionBox.maxX - result.xmax) < Math.max(width * 0.1, 100) &&
          Math.abs(selectionBox.minY - result.ymin) < Math.max(height * 0.1, 100) &&
          Math.abs(selectionBox.maxY - result.ymax) < Math.max(height * 0.1, 100);
        if (matchesResult) return result.polyPts.map(asPoint);
      }
    }

    if (typeof findEnclosingPolygonFromEntities === 'function') {
      let polygon = findEnclosingPolygonFromEntities(selectedEntities, null);
      if (polygon && polygon.length >= 3) return polygon.map(asPoint);
    }

    let areaEntity = selectedEntities.find(entity =>
      entity.type === 'RECTANGLE' || entity.type === 'POLYGON' || entity.type === 'POLYLINE');
    if (!areaEntity) return null;
    if (areaEntity.type === 'RECTANGLE') {
      return [
        { x: areaEntity.x, y: areaEntity.y },
        { x: areaEntity.x + areaEntity.w, y: areaEntity.y },
        { x: areaEntity.x + areaEntity.w, y: areaEntity.y + areaEntity.h },
        { x: areaEntity.x, y: areaEntity.y + areaEntity.h }
      ];
    }
    let points = areaEntity.points || areaEntity.pts;
    return Array.isArray(points) && points.length >= 3 ? points.map(asPoint) : null;
  }

  function getEntityBounds(entity) {
    if (typeof getEntityBoundingBox === 'function') {
      let bounds = getEntityBoundingBox(entity);
      if (bounds) return bounds;
    }
    if (entity.type === 'LINE' && entity.p1 && entity.p2) {
      return {
        minX: Math.min(entity.p1[0], entity.p2[0]),
        maxX: Math.max(entity.p1[0], entity.p2[0]),
        minY: Math.min(entity.p1[1], entity.p2[1]),
        maxY: Math.max(entity.p1[1], entity.p2[1])
      };
    }
    if (entity.type === 'RECTANGLE') {
      return { minX: entity.x, maxX: entity.x + entity.w, minY: entity.y, maxY: entity.y + entity.h };
    }
    if (entity.type === 'CIRCLE') {
      return { minX: entity.cx - entity.r, maxX: entity.cx + entity.r, minY: entity.cy - entity.r, maxY: entity.cy + entity.r };
    }
    return null;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let current = polygon[i], previous = polygon[j];
      let crosses = ((current.y > point.y) !== (previous.y > point.y)) &&
        point.x < (previous.x - current.x) * (point.y - current.y) /
        (previous.y - current.y + 1e-12) + current.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function getBounds(polygon) {
    return {
      minX: Math.min(...polygon.map(point => point.x)),
      maxX: Math.max(...polygon.map(point => point.x)),
      minY: Math.min(...polygon.map(point => point.y)),
      maxY: Math.max(...polygon.map(point => point.y))
    };
  }

  function getUnit(polygon) {
    let bounds = getBounds(polygon);
    return Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) < 60 ? 0.001 : 1;
  }

  function createAxisPositions(minimum, maximum, spacing, inset) {
    let usable = maximum - minimum - inset * 2;
    if (usable <= 0) return [];
    let count = Math.max(1, Math.ceil(usable / spacing) + 1);
    let actualSpacing = count === 1 ? 0 : usable / (count - 1);
    let positions = [];
    for (let index = 0; index < count; index++) {
      positions.push(minimum + inset + actualSpacing * index);
    }
    return positions;
  }

  function getGrid(polygon, spacingMm, insetMm) {
    let bounds = getBounds(polygon);
    let unit = getUnit(polygon);
    let spacing = spacingMm * unit;
    let inset = insetMm * unit;
    let xPositions = createAxisPositions(bounds.minX, bounds.maxX, spacing, inset);
    let yPositions = createAxisPositions(bounds.minY, bounds.maxY, spacing, inset);
    let points = [];
    xPositions.forEach(x => yPositions.forEach(y => {
      let point = { x, y };
      if (pointInPolygon(point, polygon)) points.push(point);
    }));
    return { points, unit };
  }

  function isSquareInside(point, halfSize, polygon) {
    return [
      { x: point.x - halfSize, y: point.y - halfSize },
      { x: point.x + halfSize, y: point.y - halfSize },
      { x: point.x + halfSize, y: point.y + halfSize },
      { x: point.x - halfSize, y: point.y + halfSize }
    ].every(corner => pointInPolygon(corner, polygon));
  }

  function isCircleInside(point, radius, polygon) {
    return [
      { x: point.x - radius, y: point.y },
      { x: point.x + radius, y: point.y },
      { x: point.x, y: point.y - radius },
      { x: point.x, y: point.y + radius }
    ].every(edgePoint => pointInPolygon(edgePoint, polygon));
  }

  function getTT600CellCenters(polygon) {
    let state = window.tt600State;
    let result = state && state.lastResult;
    if (!result || !Array.isArray(result.all_x) || !Array.isArray(result.all_y)) return [];
    let bounds = getBounds(polygon);
    let sameRoom = Math.abs(result.xmin - bounds.minX) < 5 && Math.abs(result.xmax - bounds.maxX) < 5 &&
      Math.abs(result.ymin - bounds.minY) < 5 && Math.abs(result.ymax - bounds.maxY) < 5;
    if (!sameRoom || result.all_x.length < 2 || result.all_y.length < 2) return [];

    let centers = [];
    for (let xIndex = 0; xIndex < result.all_x.length - 1; xIndex++) {
      for (let yIndex = 0; yIndex < result.all_y.length - 1; yIndex++) {
        let center = {
          x: (result.all_x[xIndex] + result.all_x[xIndex + 1]) / 2,
          y: (result.all_y[yIndex] + result.all_y[yIndex + 1]) / 2,
          xIndex,
          yIndex
        };
        if (pointInPolygon(center, polygon)) centers.push(center);
      }
    }
    return centers;
  }

  function pickEvenIndices(indices, count) {
    if (indices.length <= count) return indices;
    if (count <= 1) return [indices[Math.floor((indices.length - 1) / 2)]];
    let picked = [];
    for (let index = 0; index < count; index++) {
      let sourceIndex = Math.round(index * (indices.length - 1) / (count - 1));
      picked.push(indices[sourceIndex]);
    }
    return [...new Set(picked)];
  }

  function pickCenteredIndices(indices, positions, count, center) {
    if (indices.length <= count) return indices;
    if (count <= 1) {
      let nearest = indices.slice().sort((a, b) => Math.abs(positions[a] - center) - Math.abs(positions[b] - center));
      return [nearest[0]];
    }
    let selected = [];
    let step = (indices.length - 1) / (count - 1);
    for (let index = 0; index < count; index++) selected.push(indices[Math.round(index * step)]);
    let nearestCenter = indices.slice().sort((a, b) => Math.abs(positions[a] - center) - Math.abs(positions[b] - center))[0];
    selected.push(nearestCenter);
    return [...new Set(selected)].sort((a, b) => a - b).slice(0, count);
  }

  function chooseGridCounts(targetCount, aspect) {
    let maxColumns = Math.max(1, Math.ceil(Math.sqrt(targetCount * aspect) * 2));
    let best = null;
    for (let columns = 1; columns <= maxColumns; columns++) {
      let rows = Math.max(1, Math.round(targetCount / columns));
      for (let candidateRows = Math.max(1, rows - 1); candidateRows <= rows + 1; candidateRows++) {
        let count = columns * candidateRows;
        let ratio = columns / candidateRows;
        let score = Math.abs(count - targetCount) * 4 + Math.abs(Math.log(ratio / aspect));
        if (!best || score < best.score) best = { columns, rows: candidateRows, score };
      }
    }
    return { columns: best.columns, rows: best.rows };
  }

  function getAdaptiveLightingPlan(polygon, mode) {
    let bounds = getBounds(polygon);
    let unit = getUnit(polygon);
    let widthMm = (bounds.maxX - bounds.minX) / unit;
    let heightMm = (bounds.maxY - bounds.minY) / unit;
    let rawArea = Math.abs(typeof polyArea === 'function' ? polyArea(polygon) :
      (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY));
    let areaM2 = unit === 1 ? rawArea / 1e6 : rawArea;
    let targetAreaPerLight = mode === 'recessed' ? 5.5 : 4.5;
    let targetCount = Math.max(1, Math.ceil(areaM2 / targetAreaPerLight));
    let aspect = Math.max(widthMm, 1) / Math.max(heightMm, 1);
    let gridCounts = chooseGridCounts(targetCount, aspect);
    return { unit, widthMm, heightMm, areaM2, targetCount, ...gridCounts };
  }

  function selectCoveragePoints(points, targetCount, polygon) {
    if (points.length <= targetCount) return points;
    let bounds = getBounds(polygon);
    let center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    let remaining = points.slice();
    let selected = [remaining.sort((a, b) =>
      Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y))[0]];
    remaining = remaining.filter(point => point !== selected[0]);

    while (selected.length < targetCount && remaining.length > 0) {
      let next = remaining.sort((first, second) => {
        let firstGap = Math.min(...selected.map(point => Math.hypot(first.x - point.x, first.y - point.y)));
        let secondGap = Math.min(...selected.map(point => Math.hypot(second.x - point.x, second.y - point.y)));
        if (Math.abs(firstGap - secondGap) > 1e-6) return secondGap - firstGap;
        return Math.hypot(first.x - center.x, first.y - center.y) - Math.hypot(second.x - center.x, second.y - center.y);
      })[0];
      selected.push(next);
      remaining = remaining.filter(point => point !== next);
    }
    return selected.sort((a, b) => a.y - b.y || a.x - b.x);
  }

  function chooseSteppedIndices(indices, step, fromLow) {
    let ordered = indices.slice().sort((a, b) => a - b);
    if (!fromLow) ordered.reverse();
    let selected = [];
    let current = ordered[0];
    while (current !== undefined) {
      selected.push(current);
      let next = ordered.find(index => fromLow ? index >= current + step : index <= current - step);
      if (next === undefined) break;
      current = next;
    }
    return selected.sort((a, b) => a - b);
  }

  function getRuleBasedLightLayout(polygon, plan, alignedCells) {
    let bounds = getBounds(polygon);
    let result = window.tt600State && window.tt600State.lastResult;
    let anchor = result && result.lightingAnchor ? result.lightingAnchor : {
      isMainHorizontal: true,
      fromBottom: true,
      fromLeft: true
    };
    let margin = 900 * plan.unit;
    let cellSize = 600 * plan.unit;
    let validCells = alignedCells.filter(cell =>
      cell.x >= bounds.minX + margin && cell.x <= bounds.maxX - margin &&
      cell.y >= bounds.minY + margin && cell.y <= bounds.maxY - margin &&
      isSquareInside(cell, cellSize / 2, polygon));
    let rulePoints = validCells.map(cell => ({ x: cell.x, y: cell.y }));
    let points = selectCoveragePoints(rulePoints, plan.targetCount, polygon);
    return {
      unit: plan.unit,
      plan: { ...plan, columns: 0, rows: 0 },
      aligned: true,
      center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
      marginMm: margin / plan.unit,
      alongRowMm: 1800,
      betweenRowsMm: 1200,
      anchor,
      points,
      candidateCount: rulePoints.length,
      spacingRule: 'coverage_from_valid_600_cells'
    };
  }

  function getLightLayout(polygon, mode) {
    let plan = getAdaptiveLightingPlan(polygon, mode);
    let alignedCells = getTT600CellCenters(polygon);
    if (alignedCells.length > 0) {
      return getRuleBasedLightLayout(polygon, plan, alignedCells);
    }
    let spacingX = plan.columns > 1 ? (plan.widthMm - 1200) / (plan.columns - 1) : plan.widthMm;
    let spacingY = plan.rows > 1 ? (plan.heightMm - 1200) / (plan.rows - 1) : plan.heightMm;
    let spacing = Math.max(1200, Math.min(spacingX, spacingY));
    let fallbackGrid = getGrid(polygon, spacing, 600);
    return { ...fallbackGrid, plan };
  }

  function removePreviousLayout(mode) {
    let modePrefix = `${PREFIX}${mode}_`;
    entities = entities.filter(entity => !(entity.id || '').startsWith(modePrefix));
  }

  function removePreviousLightLayouts() {
    entities = entities.filter(entity => entity.layer !== 'LIGHT_RECESSED' && entity.layer !== 'LIGHT_SQUARE_600');
  }

  function getLightingRoomId() {
    return window.tt600State && window.tt600State.lastResult ? window.tt600State.lastResult.roomId : null;
  }

  function getSwitchCount(lightCount) {
    return lightCount >= 3 ? 3 : Math.max(1, lightCount);
  }

  function refreshLightingBOM() {
    let result = window.tt600State && window.tt600State.lastResult;
    if (!result || typeof generateBOMEntities !== 'function') return;
    let roomLights = getPrimaryLights(result.roomId);
    let lightingSummary = {
      total: roomLights.length,
      recessed: roomLights.filter(entity => entity.layer === 'LIGHT_RECESSED').length,
      square: roomLights.filter(entity => entity.layer === 'LIGHT_SQUARE_600' && entity.type === 'RECTANGLE').length,
      switchCount: result.lightingPlan ? result.lightingPlan.switchCount : getSwitchCount(roomLights.length)
    };
    entities = entities.filter(entity => !(entity.roomId === result.roomId && entity.layer === 'BOM_TABLE'));
    let bom = generateBOMEntities(result.realAreaM2, result.realPeri, result.n_full_tiles, result.n_cut_tiles,
      result.mainTeeCount || 0, result.cross1220Count || 0, result.cross610Count || 0, result.hangerCount || 0,
      result.cutTilesList || [], result.pairedCuts || 0, result.xmax, result.ymax, result.isMeter, lightingSummary);
    bom.bomEntities.forEach(entity => {
      entity.roomId = result.roomId;
      entities.push(entity);
    });
    result.lightingSummary = lightingSummary;
    result.tabX = bom.tabX;
    result.tabY = bom.tabY;
    result.tabW = bom.tabW;
  }

  function addRecessedLights(polygon) {
    removePreviousLightLayouts();
    let grid = getLightLayout(polygon, 'recessed');
    let radius = 75 * grid.unit;
    let lightPoints = grid.points.filter(point => isCircleInside(point, radius, polygon));
    let bounds = getBounds(polygon);
    let switchCount = getSwitchCount(lightPoints.length);
    window.ttLightingState.lastPlan = { ...grid.plan, placedCount: lightPoints.length,
      alignedTo600: Boolean(grid.aligned), center: grid.center || { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, bounds,
      layoutMode: 'wall_based_coverage', candidateCount: grid.candidateCount || lightPoints.length,
      marginMm: grid.marginMm || 900, alongRowMm: grid.alongRowMm || 1800,
      betweenRowsMm: grid.betweenRowsMm || 1200, anchor: grid.anchor || null, switchCount };
    lightPoints.forEach((point, index) => {
      entities.push({
        id: `${PREFIX}recessed_${index}`,
        type: 'CIRCLE',
        cx: point.x,
        cy: point.y,
        r: radius,
        color: '#facc15',
        fillColor: 'rgba(250, 204, 21, 0.30)',
        layer: 'LIGHT_RECESSED',
        roomId: getLightingRoomId(),
        lightGroup: `recessed_${index}`,
        circuit: (index % switchCount) + 1,
        width: 1.5
      });
    });
    return lightPoints.length;
  }

  function addSquareLights(polygon) {
    removePreviousLightLayouts();
    let grid = getLightLayout(polygon, 'square600');
    let halfSize = 300 * grid.unit;
    let lightPoints = grid.points.filter(point => isSquareInside(point, halfSize, polygon));
    let bounds = getBounds(polygon);
    let switchCount = getSwitchCount(lightPoints.length);
    window.ttLightingState.lastPlan = { ...grid.plan, placedCount: lightPoints.length,
      alignedTo600: Boolean(grid.aligned), center: grid.center || { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, bounds,
      layoutMode: 'wall_based_coverage', candidateCount: grid.candidateCount || lightPoints.length,
      marginMm: grid.marginMm || 900, alongRowMm: grid.alongRowMm || 1800,
      betweenRowsMm: grid.betweenRowsMm || 1200, anchor: grid.anchor || null, switchCount };
    lightPoints.forEach((point, index) => {
      entities.push({
        id: `${PREFIX}square600_${index}`,
        type: 'RECTANGLE',
        x: point.x - halfSize,
        y: point.y - halfSize,
        w: halfSize * 2,
        h: halfSize * 2,
        color: '#38bdf8',
        fillColor: 'rgba(56, 189, 248, 0.24)',
        layer: 'LIGHT_SQUARE_600',
        roomId: getLightingRoomId(),
        lightGroup: `square600_${index}`,
        circuit: (index % switchCount) + 1,
        width: 1.5
      });
      entities.push({
        id: `${PREFIX}square600_cross_x_${index}`,
        type: 'LINE',
        p1: [point.x - halfSize * 0.55, point.y],
        p2: [point.x + halfSize * 0.55, point.y],
        color: '#38bdf8',
        layer: 'LIGHT_SQUARE_600',
        roomId: getLightingRoomId(),
        lightGroup: `square600_${index}`,
        width: 1
      });
      entities.push({
        id: `${PREFIX}square600_cross_y_${index}`,
        type: 'LINE',
        p1: [point.x, point.y - halfSize * 0.55],
        p2: [point.x, point.y + halfSize * 0.55],
        color: '#38bdf8',
        layer: 'LIGHT_SQUARE_600',
        roomId: getLightingRoomId(),
        lightGroup: `square600_${index}`,
        width: 1
      });
    });
    return lightPoints.length;
  }

  function addAccessPanel(polygon) {
    removePreviousLayout('access');
    let grid = getGrid(polygon, 1200, 300);
    let alignedPoints = getTT600CellCenters(polygon);
    let candidatePoints = alignedPoints.length > 0 ? alignedPoints : grid.points;
    let halfSize = 300 * grid.unit;
    candidatePoints = candidatePoints.filter(point => isSquareInside(point, halfSize, polygon));
    if (candidatePoints.length === 0) return false;
    let bounds = getBounds(polygon);
    let point = candidatePoints.slice().sort((first, second) => {
      let firstDistance = Math.hypot(first.x - bounds.minX, first.y - bounds.minY);
      let secondDistance = Math.hypot(second.x - bounds.minX, second.y - bounds.minY);
      return firstDistance - secondDistance;
    })[0];
    entities.push({
      id: `${PREFIX}access_frame`,
      type: 'RECTANGLE',
      x: point.x - halfSize,
      y: point.y - halfSize,
      w: halfSize * 2,
      h: halfSize * 2,
      color: '#f97316',
      fillColor: 'rgba(249, 115, 22, 0.22)',
      layer: 'CEILING_ACCESS_PANEL',
      width: 2
    });
    entities.push({
      id: `${PREFIX}access_cross_x`,
      type: 'LINE',
      p1: [point.x - halfSize, point.y - halfSize],
      p2: [point.x + halfSize, point.y + halfSize],
      color: '#f97316',
      layer: 'CEILING_ACCESS_PANEL',
      width: 1.5
    });
    entities.push({
      id: `${PREFIX}access_cross_y`,
      type: 'LINE',
      p1: [point.x - halfSize, point.y + halfSize],
      p2: [point.x + halfSize, point.y - halfSize],
      color: '#f97316',
      layer: 'CEILING_ACCESS_PANEL',
      width: 1.5
    });
    entities.push({
      id: `${PREFIX}access_label`,
      type: 'TEXT',
      x: point.x,
      y: point.y,
      text: 'CUA THAM 600x600',
      size: 150 * grid.unit,
      color: '#f97316',
      align: 'center',
      layer: 'CEILING_ACCESS_PANEL'
    });
    return true;
  }

  function getLightingResult() {
    return window.tt600State && window.tt600State.lastResult ? window.tt600State.lastResult : null;
  }

  function getCellAtPoint(point) {
    let result = getLightingResult();
    if (!result || !Array.isArray(result.all_x) || !Array.isArray(result.all_y)) return null;
    let candidates = [];
    for (let xIndex = 0; xIndex < result.all_x.length - 1; xIndex++) {
      for (let yIndex = 0; yIndex < result.all_y.length - 1; yIndex++) {
        let cell = {
          x: (result.all_x[xIndex] + result.all_x[xIndex + 1]) / 2,
          y: (result.all_y[yIndex] + result.all_y[yIndex + 1]) / 2,
          xIndex,
          yIndex
        };
        if (point.x >= result.all_x[xIndex] && point.x <= result.all_x[xIndex + 1] &&
          point.y >= result.all_y[yIndex] && point.y <= result.all_y[yIndex + 1] &&
          isSquareInside(cell, 300 * (result.isMeter ? 0.001 : 1), result.polyPts)) candidates.push(cell);
      }
    }
    return candidates.sort((first, second) =>
      Math.hypot(first.x - point.x, first.y - point.y) - Math.hypot(second.x - point.x, second.y - point.y))[0] || null;
  }

  function getPrimaryLights(roomId) {
    let result = getLightingResult();
    if (!result || !result.polyPts) return entities.filter(entity =>
      ((entity.layer === 'LIGHT_SQUARE_600' && entity.type === 'RECTANGLE') || entity.layer === 'LIGHT_RECESSED'));
    return entities.filter(entity => {
      if ((entity.layer !== 'LIGHT_SQUARE_600' || entity.type !== 'RECTANGLE') && entity.layer !== 'LIGHT_RECESSED') return false;
      let center = entity.type === 'RECTANGLE'
        ? { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 }
        : { x: entity.cx, y: entity.cy };
      return entity.roomId === roomId || !entity.roomId || pointInPolygon(center, result.polyPts);
    });
  }

  function findLightAtCell(cell, roomId) {
    let unit = getLightingResult()?.isMeter ? 0.001 : 1;
    let tolerance = 180 * unit;
    return getPrimaryLights(roomId).find(light => {
      let center = light.type === 'RECTANGLE'
        ? { x: light.x + light.w / 2, y: light.y + light.h / 2 }
        : { x: light.cx, y: light.cy };
      return Math.hypot(center.x - cell.x, center.y - cell.y) <= tolerance;
    }) || null;
  }

  function findLightAtPoint(point, roomId) {
    let result = getLightingResult();
    let unit = result && result.isMeter ? 0.001 : 1;
    let hitRadius = 540 * unit;
    return getPrimaryLights(roomId).find(light => {
      let center = light.type === 'RECTANGLE'
        ? { x: light.x + light.w / 2, y: light.y + light.h / 2 }
        : { x: light.cx, y: light.cy };
      return Math.hypot(center.x - point.x, center.y - point.y) <= hitRadius;
    }) || null;
  }

  function refreshInteractiveLighting() {
    let result = getLightingResult();
    if (!result) return;
    let lights = getPrimaryLights(result.roomId);
    let existingPlan = result.lightingPlan || {};
    result.lightingPlan = { ...existingPlan, placedCount: lights.length, areaM2: result.realAreaM2,
      widthMm: (result.xmax - result.xmin) / (result.isMeter ? 0.001 : 1),
      heightMm: (result.ymax - result.ymin) / (result.isMeter ? 0.001 : 1),
      layoutMode: 'manual_cell_snap', switchCount: getSwitchCount(lights.length) };
    refreshLightingBOM();
    if (typeof render === 'function') render();
  }

  function addInteractiveLight(cell, lightType, toggleExisting = true) {
    let result = getLightingResult();
    if (!result || !cell) return false;
    let unit = result.isMeter ? 0.001 : 1;
    let roomId = result.roomId;
    let cellId = `${cell.xIndex}_${cell.yIndex}`;
    let existing = findLightAtCell(cell, roomId);
    if (existing) {
      if (!toggleExisting) return false;
      let center = existing.type === 'RECTANGLE' ? { x: existing.x + existing.w / 2, y: existing.y + existing.h / 2 } : { x: existing.cx, y: existing.cy };
      entities = entities.filter(entity => {
        if (entity.layer !== 'LIGHT_SQUARE_600' && entity.layer !== 'LIGHT_RECESSED') return true;
        if (entity === existing || (existing.lightGroup && entity.lightGroup === existing.lightGroup) || entity.lightCell === cellId) return false;
        let entityCenter = entity.type === 'RECTANGLE' ? { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 } : { x: entity.cx, y: entity.cy };
        return Math.hypot(entityCenter.x - center.x, entityCenter.y - center.y) > 2 * unit;
      });
      refreshInteractiveLighting();
      return false;
    }
    let halfSize = 300 * unit;
    if (lightType === 'recessed') {
      entities.push({ id: `${PREFIX}recessed_cell_${cellId}`, type: 'CIRCLE', cx: cell.x, cy: cell.y, r: 75 * unit,
        color: '#facc15', fillColor: 'rgba(250, 204, 21, 0.30)', layer: 'LIGHT_RECESSED', roomId, lightCell: cellId, width: 1.5 });
    } else {
      let lightGroup = `square600_${cellId}`;
      entities.push({ id: `${PREFIX}square600_cell_${cellId}`, type: 'RECTANGLE', x: cell.x - halfSize, y: cell.y - halfSize,
        w: halfSize * 2, h: halfSize * 2, color: '#38bdf8', fillColor: 'rgba(56, 189, 248, 0.24)',
        layer: 'LIGHT_SQUARE_600', roomId, lightCell: cellId, lightGroup, width: 1.5 });
      entities.push({ id: `${PREFIX}square600_cross_x_${cellId}`, type: 'LINE',
        p1: [cell.x - halfSize * 0.55, cell.y], p2: [cell.x + halfSize * 0.55, cell.y],
        color: '#38bdf8', layer: 'LIGHT_SQUARE_600', roomId, lightGroup, width: 1 });
      entities.push({ id: `${PREFIX}square600_cross_y_${cellId}`, type: 'LINE',
        p1: [cell.x, cell.y - halfSize * 0.55], p2: [cell.x, cell.y + halfSize * 0.55],
        color: '#38bdf8', layer: 'LIGHT_SQUARE_600', roomId, lightGroup, width: 1 });
    }
    refreshInteractiveLighting();
    return true;
  }

  function deleteInteractiveLightAt(point) {
    let result = getLightingResult();
    if (!result) return false;
    let light = findLightAtPoint(point, result.roomId);
    let cell = getCellAtPoint(point);
    if (!light && cell) light = findLightAtCell(cell, result.roomId);
    if (!light) return false;
    let center = light.type === 'RECTANGLE' ? { x: light.x + light.w / 2, y: light.y + light.h / 2 } : { x: light.cx, y: light.cy };
    entities = entities.filter(entity => {
      if ((entity.layer !== 'LIGHT_SQUARE_600' && entity.layer !== 'LIGHT_RECESSED')) return true;
      if (light.lightGroup && entity.lightGroup === light.lightGroup) return false;
      if (entity === light) return false;
      if (entity.type === 'LINE') {
        let lineCenter = { x: (entity.p1[0] + entity.p2[0]) / 2, y: (entity.p1[1] + entity.p2[1]) / 2 };
        return Math.hypot(lineCenter.x - center.x, lineCenter.y - center.y) > 500 * (result.isMeter ? 0.001 : 1);
      }
      let entityCenter = entity.type === 'RECTANGLE' ? { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 } : { x: entity.cx, y: entity.cy };
      return Math.hypot(entityCenter.x - center.x, entityCenter.y - center.y) > 2 * (result.isMeter ? 0.001 : 1);
    });
    refreshInteractiveLighting();
    return true;
  }

  function moveInteractiveLight(source, target) {
    let result = getLightingResult();
    let sourceCell = getCellAtPoint(source), targetCell = getCellAtPoint(target);
    if (!result || !targetCell) return false;
    let light = findLightAtPoint(source, result.roomId);
    if (!light && sourceCell) light = findLightAtCell(sourceCell, result.roomId);
    if (!light || findLightAtCell(targetCell, result.roomId)) return false;
    let actualSource = light.type === 'RECTANGLE'
      ? { x: light.x + light.w / 2, y: light.y + light.h / 2 }
      : { x: light.cx, y: light.cy };
    if (Math.hypot(actualSource.x - targetCell.x, actualSource.y - targetCell.y) < 1) return false;
    let unit = result.isMeter ? 0.001 : 1;
    let dx = targetCell.x - actualSource.x, dy = targetCell.y - actualSource.y;
    entities.forEach(entity => {
      if (entity.layer !== light.layer ||
        (entity !== light && entity.lightGroup !== light.lightGroup)) return;
      if (entity.type === 'RECTANGLE') { entity.x += dx; entity.y += dy; }
      if (entity.type === 'CIRCLE') { entity.cx += dx; entity.cy += dy; }
      if (entity.type === 'LINE') {
        entity.p1[0] += dx; entity.p1[1] += dy;
        entity.p2[0] += dx; entity.p2[1] += dy;
      }
      if (entity === light) entity.lightCell = `${targetCell.xIndex}_${targetCell.yIndex}`;
    });
    refreshInteractiveLighting();
    return true;
  }

  window.deleteAllTTLights = function() {
    let result = getLightingResult();
    if (!result) return;
    entities = entities.filter(entity => entity.roomId !== result.roomId ||
      (entity.layer !== 'LIGHT_SQUARE_600' && entity.layer !== 'LIGHT_RECESSED'));
    refreshInteractiveLighting();
  };

  window.startTTAddLighting = function() {
    window.ttLightingState.interactive = true;
    window.ttLightingState.interactiveAction = 'add';
    window.ttLightingState.mode = 'square600';
    window.ttLightingState.lightType = 'square600';
    if (typeof selectTool === 'function') selectTool(TOOL_NAME);
  };

  window.startTTMoveLighting = function() {
    window.ttLightingState.interactive = true;
    window.ttLightingState.moveSource = null;
    if (typeof selectTool === 'function') selectTool('MDEN');
  };

  window.startTTDeleteLighting = function() {
    window.ttLightingState.interactive = true;
    if (typeof selectTool === 'function') selectTool('XDEN');
  };

  function executeLightingCommand() {
    let polygon = getSelectedPolygon();
    if (!polygon || polygon.length < 3) {
      if (typeof setInfo === 'function') setInfo('Hay quet chon vung phong truoc khi rải den.');
      return;
    }
    let mode = window.ttLightingState.mode;
    let result = mode === 'recessed' ? addRecessedLights(polygon) :
      mode === 'square600' ? addSquareLights(polygon) : addAccessPanel(polygon);
    if (typeof selectedIds !== 'undefined') selectedIds.clear();
    if (window.tt600State && window.tt600State.lastResult && window.ttLightingState.lastPlan) {
      window.tt600State.lastResult.lightingPlan = window.ttLightingState.lastPlan;
      refreshLightingBOM();
    }
    if (typeof selectTool === 'function') selectTool('SELECT');
    if (typeof renderPropertiesPanel === 'function') renderPropertiesPanel();
    if (typeof render === 'function') render();
    if (typeof setInfo === 'function') {
      setInfo(mode === 'access' ?
        (result ? 'Da can thang cua tham tran 600x600 vao o luoi.' : 'Khong tim duoc o luoi hop le de dat cua tham.') :
        `Da kiem tra phong ${window.ttLightingState.lastPlan ? window.ttLightingState.lastPlan.widthMm.toFixed(0) : '?'}x${window.ttLightingState.lastPlan ? window.ttLightingState.lastPlan.heightMm.toFixed(0) : '?'}mm (${window.ttLightingState.lastPlan ? window.ttLightingState.lastPlan.areaM2.toFixed(1) : '?'}m2), co ${window.ttLightingState.lastPlan ? window.ttLightingState.lastPlan.candidateCount : result} o ung vien, toi uu con ${result} den theo do phu.`);
    }
    window.ttLightingState.phase = 'DONE';
  }

  window.ttLightingState = window.ttLightingState || { mode: 'recessed', phase: 'READY', scanStartWorld: null, interactive: false, lightType: 'square600' };
  window.startTTLighting = function(mode) {
    window.ttLightingState.interactive = false;
    window.ttLightingState.mode = mode;
    if (typeof selectTool === 'function') selectTool(TOOL_NAME);
  };
  window.executeTTLighting = executeLightingCommand;

  function handleInteractiveLightingClick(point) {
    let now = Date.now();
    let clickedCell = getCellAtPoint(point);
    let previous = window.ttLightingState.lastInteractiveClick;
    if (previous && clickedCell && now - previous.time < 350 &&
      clickedCell.xIndex === previous.xIndex && clickedCell.yIndex === previous.yIndex) return true;
    window.ttLightingState.lastInteractiveClick = { x: point.x, y: point.y, time: now,
      xIndex: clickedCell ? clickedCell.xIndex : null, yIndex: clickedCell ? clickedCell.yIndex : null };
    if (window.ttLightingState.phase !== 'INTERACTIVE') return false;
    let changed = addInteractiveLight(clickedCell, window.ttLightingState.lightType, false);
    if (typeof setInfo === 'function') {
      let total = getLightingResult()?.lightingPlan?.placedCount || 0;
      setInfo(changed ? `Da them den tai tam o 600x600. Tong den: ${total}. BOM da cap nhat.` :
        'O nay da co den hoac khong hop le.');
    }
    return true;
  }

  if (typeof registerPluginTool === 'function') {
    registerPluginTool(TOOL_NAME, {
      allowSelection: function() { return !window.ttLightingState.interactive; },
      hidePropertiesPanel: true,
      multiSelect: true,
      onActivate: function() {
        window.ttLightingState.phase = window.ttLightingState.interactive ? 'INTERACTIVE' : 'SCANNING';
        window.ttLightingState.scanStartWorld = null;
        window.ttLightingState.scanPolygon = null;
        if (typeof selectedIds !== 'undefined') selectedIds.clear();
        if (typeof setInfo === 'function') setInfo(window.ttLightingState.phase === 'INTERACTIVE' ?
          'ADDEN: cham/click vao o trong 600x600 de them den.' :
          'AUTODEN: quet vung can rai den, sau do nhan ENTER.');
      },
      onDeactivate: function() {
        window.ttLightingState.phase = 'DONE';
        window.ttLightingState.scanStartWorld = null;
        window.ttLightingState.scanPolygon = null;
      },
      onSelectionChange: function(currentSelection) {
        if (window.ttLightingState.phase !== 'SCANNING') return;
        if (typeof setInfo === 'function') {
          setInfo(currentSelection && currentSelection.size > 0 ?
            'Da quet vung mat bang. Nhan ENTER de tu kiem tra va rai den.' :
            'ADDEN: quet chon vung can them den, sau do nhan Enter.');
        }
      },
      onClick: function(point) {
        return handleInteractiveLightingClick(point);
      },
      onMouseDown: function(point) {
        return handleInteractiveLightingClick(point);
      },
      onEnter: function() {
        if (window.ttLightingState.phase === 'SCANNING') executeLightingCommand();
      }
    });

    registerPluginTool('MDEN', {
      allowSelection: function() { return false; },
      hidePropertiesPanel: true,
      onActivate: function() { window.ttLightingState.moveSource = null; if (typeof setInfo === 'function') setInfo('MDEN: click vao den can doi, sau do click vao o dich.'); },
      onClick: function(point) {
        if (!window.ttLightingState.moveSource) {
          let cell = getCellAtPoint(point);
          let result = getLightingResult();
          if (cell && result && findLightAtCell(cell, result.roomId)) {
            window.ttLightingState.moveSource = point;
            if (typeof setInfo === 'function') setInfo('MDEN: da chon den, click vao o 600x600 dich.');
          }
          return true;
        }
        let moved = moveInteractiveLight(window.ttLightingState.moveSource, point);
        window.ttLightingState.moveSource = null;
        if (typeof setInfo === 'function') setInfo(moved ? 'Da doi den vao tam o moi.' : 'O dich khong hop le hoac da co den.');
        return true;
      }
    });

    registerPluginTool('XDEN', {
      allowSelection: function() { return false; },
      hidePropertiesPanel: true,
      onActivate: function() { if (typeof setInfo === 'function') setInfo('XDEN: click vao den de xoa, hoac dung lenh XDENALL.'); },
      onClick: function(point) {
        let deleted = deleteInteractiveLightAt(point);
        if (typeof setInfo === 'function') {
          let total = getLightingResult()?.lightingPlan?.placedCount || 0;
          setInfo(deleted ? `Da xoa den. Con lai: ${total}. BOM da cap nhat.` : 'Khong tim thay den trong o nay.');
        }
        return true;
      }
    });
  }

  function register(name, mode, description) {
    let command = function() { window.startTTLighting(mode); };
    window[`c_${name}`] = command;
    if (typeof registerPluginCommand === 'function') registerPluginCommand(name, command, description);
    else if (typeof registerCommand === 'function') registerCommand(name, command, description);
  }

  register('TTVUONG600', 'square600', 'Tool VNCAD: tu kiem tra mat bang va rai den vuong 600x600');
  register('TTTHAM', 'access', 'Tool VNCAD: can cua tham 600x600 theo luoi TT600');
  window.c_ADDEN = window.startTTAddLighting;
  window.c_AUTODEN = function() { window.startTTLighting('square600'); };
  window.c_MDEN = window.startTTMoveLighting;
  window.c_XDEN = window.startTTDeleteLighting;
  window.c_XDENALL = window.deleteAllTTLights;

  function ensureLightingCommandGuide() {
    if (typeof document === 'undefined' || !document.body) return;
    let oldGuide = document.getElementById('tt-light-command-guide');
    if (oldGuide) oldGuide.remove();
    let oldTab = document.getElementById('tt-light-command-guide-tab');
    if (oldTab) oldTab.remove();
    let guide = document.createElement('div');
    guide.id = 'tt-light-command-guide';
    guide.style.cssText = 'position:fixed;left:12px;top:110px;z-index:3000;width:270px;max-width:calc(100vw - 24px);font-family:Arial,sans-serif;color:#e2e8f0;background:rgba(15,23,42,.98);border:1px solid #38bdf8;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45);font-size:12px;overflow:hidden;';
    guide.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 9px;background:rgba(14,116,144,.32);">
        <strong style="color:#facc15;white-space:nowrap;">💡 LỆNH ĐÈN 600×600</strong>
        <button id="tt-light-guide-hide" style="margin-left:auto;background:#334155;border:1px solid #64748b;color:#e2e8f0;border-radius:3px;cursor:pointer;font-size:11px;padding:2px 5px;" title="Ẩn bảng hướng dẫn">Ẩn</button>
        <button id="tt-light-guide-toggle" style="margin-left:auto;background:none;border:0;color:#cbd5e1;cursor:pointer;font-size:14px;" title="Thu gọn">−</button>
      </div>
      <div id="tt-light-guide-help" style="padding:7px 9px;color:#cbd5e1;line-height:1.4;border-bottom:1px solid #334155;">Gõ lệnh tại COMMAND để xem hướng dẫn thao tác tương ứng.</div>
      <div id="tt-light-guide-body" style="display:grid;grid-template-columns:minmax(96px,1fr) minmax(120px,1.35fr);align-items:center;gap:5px 7px;padding:7px 8px;">
        <button data-light-command="ADDEN" title="Click ô để thêm đèn tại tâm ô" style="background:#0369a1;color:white;border:1px solid #38bdf8;border-radius:4px;padding:5px;cursor:pointer;font-weight:bold;">ADDEN</button>
        <span style="color:#cbd5e1;">Thêm đèn vào ô</span>
        <button data-light-command="AUTODEN" title="Rải đèn tự động theo diện tích" style="background:#166534;color:white;border:1px solid #4ade80;border-radius:4px;padding:5px;cursor:pointer;font-weight:bold;">AUTODEN</button>
        <span style="color:#cbd5e1;">Rải đèn tự động</span>
        <button data-light-command="MDEN" title="Click đèn, sau đó click ô đích" style="background:#92400e;color:white;border:1px solid #fb923c;border-radius:4px;padding:5px;cursor:pointer;font-weight:bold;">MDEN</button>
        <span style="color:#cbd5e1;">Dời đèn sang ô mới</span>
        <button data-light-command="XDEN" title="Click đèn để xóa" style="background:#991b1b;color:white;border:1px solid #f87171;border-radius:4px;padding:5px;cursor:pointer;font-weight:bold;">XDEN</button>
        <span style="color:#cbd5e1;">Xóa một đèn</span>
        <button data-light-command="XDENALL" title="Xóa toàn bộ đèn phòng hiện tại" style="background:#7f1d1d;color:white;border:1px solid #f87171;border-radius:4px;padding:5px;cursor:pointer;font-weight:bold;">XDEN ALL</button>
        <span style="color:#cbd5e1;">Xóa toàn bộ đèn</span>
      </div>`;
    document.body.appendChild(guide);
    let tab = document.createElement('button');
    tab.id = 'tt-light-command-guide-tab';
    tab.textContent = '💡 Lệnh đèn';
    tab.title = 'Hiện bảng hướng dẫn lệnh đèn';
    tab.style.cssText = 'display:none;position:fixed;left:8px;top:110px;z-index:3000;background:#0e7490;color:white;border:1px solid #38bdf8;border-radius:0 6px 6px 0;padding:7px 9px;cursor:pointer;font-weight:bold;box-shadow:0 6px 16px rgba(0,0,0,.35);';
    document.body.appendChild(tab);
    guide.querySelectorAll('[data-light-command]').forEach(button => {
      button.addEventListener('click', () => {
        let command = button.dataset.lightCommand;
        if (command === 'ADDEN') window.c_ADDEN();
        else if (command === 'AUTODEN') window.c_AUTODEN();
        else if (command === 'MDEN') window.c_MDEN();
        else if (command === 'XDEN') window.c_XDEN();
        else if (command === 'XDENALL') window.c_XDENALL();
      });
    });
    let showGuide = visible => {
      guide.style.display = visible ? 'block' : 'none';
      tab.style.display = visible ? 'none' : 'block';
    };
    guide.querySelector('#tt-light-guide-hide').addEventListener('click', () => showGuide(false));
    tab.addEventListener('click', () => showGuide(true));
    guide.querySelector('#tt-light-guide-toggle').addEventListener('click', event => {
      let body = guide.querySelector('#tt-light-guide-body');
      body.style.display = body.style.display === 'none' ? 'flex' : 'none';
      event.currentTarget.textContent = body.style.display === 'none' ? '+' : '−';
    });

    let commandHelp = {
      ADDEN: '<b>ADDEN</b>: click/chạm ô trống để thêm đèn tại tâm ô 600×600.',
      AUTODEN: '<b>AUTODEN</b>: chọn vùng phòng, nhấn Enter để rải tự động theo diện tích và ô hợp lệ.',
      MDEN: '<b>MDEN</b>: click đèn cần dời, sau đó click ô 600×600 đích.',
      MOVEDEN: '<b>MOVEDEN</b>: thao tác giống MDEN, dời đèn sang ô mới.',
      XDEN: '<b>XDEN</b>: click vào đèn để xóa một vị trí.',
      XDENALL: '<b>XDEN ALL</b>: xóa toàn bộ đèn của phòng hiện tại.',
    };
    let updateCommandHelp = command => {
      let help = guide.querySelector('#tt-light-guide-help');
      let normalized = command.trim().toUpperCase().replace(/\s+/g, '');
      let key = Object.keys(commandHelp).find(name => name.replace(/\s+/g, '') === normalized || name.startsWith(normalized));
      help.innerHTML = key ? commandHelp[key] : 'Gõ <b>ADDEN</b>, <b>AUTODEN</b>, <b>MDEN</b> hoặc <b>XDEN</b> để xem cách thao tác.';
    };
    let readCommandValue = target => target && (target.value || target.textContent || target.innerText || '');
    let updateFromCommandInput = event => updateCommandHelp(readCommandValue(event.target));
    let attachCommandInputs = () => {
      document.querySelectorAll('input, textarea, [contenteditable="true"]').forEach(input => {
        if (input.dataset.ttLightingHelpAttached === '1') return;
        input.addEventListener('input', updateFromCommandInput);
        input.addEventListener('keyup', updateFromCommandInput);
        input.dataset.ttLightingHelpAttached = '1';
      });
    };
    let lastDetectedCommand = '';
    let detectCommandFromDom = () => {
      let text = document.body ? document.body.innerText || '' : '';
      let matches = [...text.matchAll(/(?:^|\n)\s*command\s*:\s*([^\n]+)/ig)];
      if (matches.length === 0) return;
      let command = matches[matches.length - 1][1].trim();
      if (/^(nhập lệnh|enter command|l|pl|rec|c|arc|pr|appload|dxf|del)/i.test(command)) return;
      if (command === lastDetectedCommand) return;
      lastDetectedCommand = command;
      updateCommandHelp(command);
    };
    attachCommandInputs();
    if (window.ttLightingCommandObserver) window.ttLightingCommandObserver.disconnect();
    window.ttLightingCommandObserver = new MutationObserver(() => {
      attachCommandInputs();
      detectCommandFromDom();
    });
    window.ttLightingCommandObserver.observe(document.body, { childList: true, subtree: true });
    detectCommandFromDom();
    if (window.ttLightingCommandKeyHandler) document.removeEventListener('keydown', window.ttLightingCommandKeyHandler);
    window.ttLightingCommandBuffer = '';
    window.ttLightingCommandKeyHandler = event => {
      if (event.key === 'Backspace') window.ttLightingCommandBuffer = window.ttLightingCommandBuffer.slice(0, -1);
      else if (event.key === 'Escape' || event.key === 'Enter') window.ttLightingCommandBuffer = '';
      else if (event.key.length === 1 && /[a-z0-9 ]/i.test(event.key)) window.ttLightingCommandBuffer += event.key;
      updateCommandHelp(window.ttLightingCommandBuffer || readCommandValue(document.activeElement));
    };
    document.addEventListener('keydown', window.ttLightingCommandKeyHandler);
  }

  window.ensureLightingCommandGuide = ensureLightingCommandGuide;
  if (typeof registerPluginCommand === 'function') {
    registerPluginCommand('ADDEN', window.c_ADDEN, 'Them den vao tam o 600x600');
    registerPluginCommand('AUTODEN', window.c_AUTODEN, 'Rai den tu dong theo dien tich va o 600x600');
    registerPluginCommand('MDEN', window.c_MDEN, 'Doi den sang o 600x600 moi');
    registerPluginCommand('MOVEDEN', window.c_MDEN, 'Doi den sang o 600x600 moi');
    registerPluginCommand('XDEN', window.c_XDEN, 'Xoa den tai o dang click');
    registerPluginCommand('XDENALL', window.c_XDENALL, 'Xoa toan bo den cua phong');
  } else if (typeof registerCommand === 'function') {
    registerCommand('ADDEN', window.c_ADDEN, 'Them den vao tam o 600x600');
    registerCommand('AUTODEN', window.c_AUTODEN, 'Rai den tu dong theo dien tich va o 600x600');
    registerCommand('MDEN', window.c_MDEN, 'Doi den sang o 600x600 moi');
    registerCommand('MOVEDEN', window.c_MDEN, 'Doi den sang o 600x600 moi');
    registerCommand('XDEN', window.c_XDEN, 'Xoa den tai o dang click');
    registerCommand('XDENALL', window.c_XDENALL, 'Xoa toan bo den cua phong');
  }
  ensureLightingCommandGuide();
})();

// AUTOCAD DXF EXPORT & IMPORT ENGINE
function exportDXF() {
  if (entities.length === 0) {
    setInfo("⚠️ Bản vẽ trống, không có đối tượng để xuất DXF.");
    return;
  }
  let dxf = [];
  dxf.push("0\nSECTION\n2\nHEADER\n0\nENDSEC");
  dxf.push("0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC");
  dxf.push("0\nSECTION\n2\nENTITIES");

  for (let e of entities) {
    let lay = e.layer || "0";
    if (e.type === 'LINE' && e.p1 && e.p2) {
      dxf.push(`0\nLINE\n8\n${lay}\n10\n${e.p1[0]}\n20\n${e.p1[1]}\n30\n0.0\n11\n${e.p2[0]}\n21\n${e.p2[1]}\n31\n0.0`);
    } else if (e.type === 'RECTANGLE') {
      let x1 = e.x, y1 = e.y, x2 = e.x + e.w, y2 = e.y + e.h;
      dxf.push(`0\nLWPOLYLINE\n100\nAcDbEntity\n8\n${lay}\n100\nAcDbPolyline\n90\n4\n70\n1\n10\n${x1}\n20\n${y1}\n10\n${x2}\n20\n${y1}\n10\n${x2}\n20\n${y2}\n10\n${x1}\n20\n${y2}`);
    } else if ((e.type === 'POLYGON' || e.type === 'POLYLINE') && (e.points || e.pts)) {
      let pts = (e.points || e.pts).map(p => ({ x: p[0] !== undefined ? p[0] : p.x, y: p[1] !== undefined ? p[1] : p.y }));
      let ptsStr = pts.map(p => `10\n${p.x}\n20\n${p.y}`).join('\n');
      dxf.push(`0\nLWPOLYLINE\n100\nAcDbEntity\n8\n${lay}\n100\nAcDbPolyline\n90\n${pts.length}\n70\n1\n${ptsStr}`);
    } else if (e.type === 'CIRCLE') {
      dxf.push(`0\nCIRCLE\n8\n${lay}\n10\n${e.cx}\n20\n${e.cy}\n30\n0.0\n40\n${e.r}`);
    } else if (e.type === 'ARC') {
      let a1 = (e.startAngle * 180 / Math.PI + 360) % 360;
      let a2 = (e.endAngle * 180 / Math.PI + 360) % 360;
      dxf.push(`0\nARC\n8\n${lay}\n10\n${e.cx}\n20\n${e.cy}\n30\n0.0\n40\n${e.r}\n50\n${a1.toFixed(1)}\n51\n${a2.toFixed(1)}`);
    } else if (e.type === 'TEXT') {
      dxf.push(`0\nTEXT\n8\n${lay}\n10\n${e.x}\n20\n${e.y}\n30\n0.0\n40\n${e.size * 10 || 150}\n1\n${e.text}`);
    } else if (e.type === 'DIMENSION' && e.p1 && e.p2) {
      dxf.push(`0\nLINE\n8\n${lay}\n10\n${e.p1[0]}\n20\n${e.p1[1]}\n30\n0.0\n11\n${e.p2[0]}\n21\n${e.p2[1]}\n31\n0.0`);
    }
  }

  dxf.push("0\nENDSEC\n0\nEOF");
  let blob = new Blob([dxf.join('\n')], { type: 'application/dxf' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = "ban_ve_cad.dxf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setInfo("📥 Đã xuất file DXF chuẩn AutoCAD (ban_ve_cad.dxf).");
}

function parseDXF(text) {
  let lines = text.split(/\r?\n/).map(l => l.trim());
  let newEntities = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i] === '0' && lines[i + 1] === 'SECTION' && lines[i + 2] === '2' && lines[i + 3] === 'ENTITIES') {
      i += 4;
      while (i < lines.length && !(lines[i] === '0' && lines[i + 1] === 'ENDSEC')) {
        if (lines[i] === '0') {
          let entType = lines[i + 1];
          i += 2;
          let props = {};
          let polyPts = [];
          while (i < lines.length && lines[i] !== '0') {
            let code = lines[i];
            let val = lines[i + 1];
            if (code === '8') props.layer = val;
            else if (code === '62') props.color = val;
            else if (code === '10') {
              if (entType === 'LWPOLYLINE') polyPts.push({ x: parseFloat(val), y: 0 });
              else props.x1 = parseFloat(val);
            } else if (code === '20') {
              if (entType === 'LWPOLYLINE' && polyPts.length > 0) polyPts[polyPts.length - 1].y = parseFloat(val);
              else props.y1 = parseFloat(val);
            } else if (code === '11') props.x2 = parseFloat(val);
            else if (code === '21') props.y2 = parseFloat(val);
            else if (code === '40') props.r = parseFloat(val);
            else if (code === '1') props.text = val;
            i += 2;
          }
          let id = 'dxf_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
          if (entType === 'LINE' && isFinite(props.x1) && isFinite(props.x2)) {
            newEntities.push({ id, type: 'LINE', p1: [props.x1, props.y1], p2: [props.x2, props.y2], color: '#38bdf8', layer: props.layer || '0' });
          } else if (entType === 'CIRCLE' && isFinite(props.x1) && isFinite(props.r)) {
            newEntities.push({ id, type: 'CIRCLE', cx: props.x1, cy: props.y1, r: props.r, color: '#38bdf8', layer: props.layer || '0' });
          } else if (entType === 'LWPOLYLINE' && polyPts.length >= 2) {
            newEntities.push({ id, type: 'POLYLINE', points: polyPts.map(p => [p.x, p.y]), closed: true, color: '#38bdf8', layer: props.layer || '0' });
          } else if (entType === 'TEXT' && isFinite(props.x1) && props.text) {
            newEntities.push({ id, type: 'TEXT', x: props.x1, y: props.y1, text: props.text, size: 12, color: '#f8fafc', align: 'left', layer: props.layer || '0' });
          }
        } else {
          i++;
        }
      }
      break;
    }
    i++;
  }
  return newEntities;
}

/**
 * After Effects AEP & FFX Universal Downgrader - Web Engine
 * Supports .aep (After Effects Project), .ffx (Preset), .aet (Template), and .aepx (XML)
 */

// Version definitions and mapping
const VERSION_INFO = {
  2026: { major: 26, byte: 0x61, label: 'AE 2026 (v26.x)' },
  2025: { major: 25, byte: 0x60, label: 'AE 2025 (v25.x)' },
  2024: { major: 24, byte: 0x5F, label: 'AE 2024 (v24.x) - Recommended' },
  2023: { major: 23, byte: 0x5E, label: 'AE 2023 (v23.x)' },
  2022: { major: 22, byte: 0x5D, label: 'AE 2022 (v22.x)' },
  2021: { major: 18, byte: 0x5C, label: 'AE 2021 (v18.x)' },
  2020: { major: 17, byte: 0x5B, label: 'AE 2020 (v17.x)' },
  2019: { major: 16, byte: 0x5A, label: 'AE CC 2019 (v16.x)' },
  2018: { major: 15, byte: 0x59, label: 'AE CC 2018 (v15.x)' }
};

// Queue state
const fileQueue = [];
let isProcessingAll = false;
let soundEnabled = true;

// Sound generator using Web Audio API
const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playAudio(type = 'click') {
  if (!soundEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (e) {
    console.debug('Audio playback skipped:', e);
  }
}

// Bitfield decoder for After Effects AEP Build bytes (bytes 36..40)
function decodeAEBuildBytes(currBuffer4Bytes) {
  if (!currBuffer4Bytes || currBuffer4Bytes.length < 4) return null;
  const hex = Array.from(currBuffer4Bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const val = parseInt(hex, 16);
  const bin = val.toString(2).padStart(32, '0');

  const majorPartA = bin.substring(1, 6);
  const majorPartB = bin.substring(10, 13);
  const major = parseInt(majorPartA + majorPartB, 2);

  const minor = parseInt(bin.substring(13, 17), 2);
  const patch = parseInt(bin.substring(17, 21), 2);
  const isBeta = bin[22] === '0';
  const build = parseInt(bin.substring(24), 2);

  const osCode = bin.substring(6, 10);
  let osName = 'Unknown';
  if (osCode === '1110') osName = 'Mac ARM64';
  else if (osCode === '1100') osName = 'Win';
  else if (osCode === '1101') osName = 'Mac Intel';

  return {
    versionStr: `v${major}.${minor}.${patch}`,
    major,
    minor,
    patch,
    osName,
    build,
    isBeta,
    rawHex: hex
  };
}

// Convert major byte to AE year
function byteToYear(byte) {
  // 0x5b is AE 2020 (v17 or base)
  // 0x5d = 2022 (v22), 0x5e = 2023 (v23), 0x5f = 2024 (v24), 0x60 = 2025 (v25), 0x61 = 2026 (v26)
  if (byte >= 0x50 && byte <= 0x75) {
    const ver = byte - 0x5b + 20;
    return 2000 + ver;
  }
  return null;
}

// Parse and inspect file
async function inspectFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const u8 = new Uint8Array(arrayBuffer);
  const ext = file.name.split('.').pop().toLowerCase();

  const inspection = {
    file,
    u8,
    ext,
    size: file.size,
    type: ext, // 'aep', 'ffx', 'aet', 'aepx'
    isValid: false,
    format: 'unknown',
    detectedVersion: 'Unknown',
    detectedYear: 2024,
    headOffset: -1,
    originalHeadBytes: null,
    buildInfo: null,
    xmpStrings: []
  };

  if (ext === 'aepx') {
    // XML format
    const text = new TextDecoder('utf-8', { fatal: false }).decode(u8.slice(0, 4000));
    if (text.includes('<?xml') || text.includes('<AfterEffectsProject')) {
      inspection.isValid = true;
      inspection.format = 'AEPX (XML)';
      const m = text.match(/bva="([0-9\.]+)"/i) || text.match(/app_version="([0-9\.]+)"/i) || text.match(/Adobe After Effects ([0-9]{4})/i);
      if (m) {
        inspection.detectedVersion = m[1];
        const yr = parseInt(m[1].split('.')[0]);
        inspection.detectedYear = yr > 2000 ? yr : (2000 + yr);
      }
    }
    return inspection;
  }

  // Binary RIFX formats (.aep, .ffx, .aet)
  const magic = String.fromCharCode(...u8.slice(0, 4));
  if (magic !== 'RIFX') {
    inspection.error = 'Invalid signature: File does not start with RIFX magic bytes';
    return inspection;
  }

  const formType = String.fromCharCode(...u8.slice(8, 12));
  inspection.format = `RIFX (${formType})`;

  if (formType === 'FaFX') {
    // Preset file (.ffx)
    inspection.type = 'ffx';
    inspection.isValid = true;

    // Scan chunks for 'head'
    let pos = 12;
    const view = new DataView(arrayBuffer);
    while (pos + 8 <= u8.length) {
      const cid = String.fromCharCode(...u8.slice(pos, pos + 4));
      const csize = view.getUint32(pos + 4, false);
      if (cid === 'head') {
        inspection.headOffset = pos;
        inspection.originalHeadBytes = Array.from(u8.slice(pos + 8, pos + 8 + csize));
        // Byte 15 (pos + 8 + 7) is the version byte
        const verByte = u8[pos + 15];
        const year = byteToYear(verByte);
        if (year) {
          inspection.detectedYear = year;
          inspection.detectedVersion = `AE ${year} (0x${verByte.toString(16).toUpperCase()})`;
        }
        break;
      }
      pos += 8 + csize;
      if (pos % 2 === 1) pos++;
    }
  } else if (formType === 'Egg!') {
    // Project file (.aep / .aet)
    inspection.type = ext === 'aet' ? 'aet' : 'aep';
    inspection.isValid = true;

    // Scan chunks for 'head'
    let pos = 12;
    const view = new DataView(arrayBuffer);
    let headFound = false;
    while (pos + 8 <= Math.min(u8.length, 2048)) {
      const cid = String.fromCharCode(...u8.slice(pos, pos + 4));
      const csize = view.getUint32(pos + 4, false);
      if (cid === 'head') {
        headFound = true;
        inspection.headOffset = pos;
        const headData = u8.slice(pos + 8, pos + 8 + csize);
        inspection.originalHeadBytes = Array.from(headData);

        // headData[1] is major version byte
        const majorByte = headData[1];
        const year = byteToYear(majorByte);
        if (year) {
          inspection.detectedYear = year;
          inspection.detectedVersion = `AE ${year} (0x${majorByte.toString(16).toUpperCase()})`;
        }

        // Check build bytes at headData[4..8]
        if (headData.length >= 8) {
          inspection.buildInfo = decodeAEBuildBytes(headData.slice(4, 8));
          if (inspection.buildInfo && inspection.buildInfo.versionStr) {
            inspection.detectedVersion += ` - ${inspection.buildInfo.versionStr} (${inspection.buildInfo.osName})`;
          }
        }
        break;
      }
      pos += 8 + csize;
      if (pos % 2 === 1) pos++;
    }

    if (!headFound) {
      // Fallback search
      for (let i = 0; i < Math.min(u8.length - 8, 1024); i++) {
        if (u8[i] === 0x68 && u8[i+1] === 0x65 && u8[i+2] === 0x61 && u8[i+3] === 0x64) {
          inspection.headOffset = i;
          inspection.originalHeadBytes = Array.from(u8.slice(i + 8, i + 28));
          const majorByte = u8[i + 8 + 1];
          const year = byteToYear(majorByte);
          if (year) {
            inspection.detectedYear = year;
            inspection.detectedVersion = `AE ${year}`;
          }
          break;
        }
      }
    }
  }

  // Scan for XMP metadata strings
  try {
    const endSlice = u8.slice(Math.max(0, u8.length - 20000));
    const latin = new TextDecoder('latin1').decode(endSlice);
    const m = latin.match(/Adobe After Effects (20[0-9]{2})/g);
    if (m) {
      inspection.xmpStrings = Array.from(new Set(m));
      if (!inspection.detectedYear && m[0]) {
        const yr = parseInt(m[0].replace('Adobe After Effects ', ''));
        inspection.detectedYear = yr;
        inspection.detectedVersion = `AE ${yr} (from XMP)`;
      }
    }
  } catch (e) {
    console.debug('XMP scan error:', e);
  }

  return inspection;
}

// Core Downgrader
function processDowngrade(item, targetYear, options = {}) {
  const { deepPatch = true, targetBuildHex = null } = options;
  const u8 = new Uint8Array(item.u8.slice(0)); // clone
  const diffs = [];

  const targetMajor = targetYear - 2000;
  // Formula: version byte = 0x5b + (targetMajor - 20)
  const targetByte = 0x5b + (targetMajor - 20);

  if (item.type === 'ffx') {
    // 1. Patch RIFX head chunk
    if (item.headOffset !== -1) {
      const verOffset = item.headOffset + 15; // pos + 8 (header) + 7 (index in 16-byte head data)
      const oldVal = u8[verOffset];
      u8[verOffset] = targetByte;

      diffs.push({
        offset: verOffset,
        chunk: 'head (FFX version byte)',
        oldByte: oldVal,
        newByte: targetByte
      });
    }

    // 2. Patch XMP metadata strings
    if (deepPatch) {
      let text = new TextDecoder('latin1').decode(u8);
      let xmpPatched = 0;
      for (let y = 2028; y >= 2018; y--) {
        if (y > targetYear) {
          const s1 = `Adobe After Effects ${y}`;
          const r1 = `Adobe After Effects ${targetYear}`;
          if (text.includes(s1)) {
            text = text.replaceAll(s1, r1);
            xmpPatched++;
          }
          const s2 = `After Effects ${y}`;
          const r2 = `After Effects ${targetYear}`;
          if (text.includes(s2)) {
            text = text.replaceAll(s2, r2);
            xmpPatched++;
          }
        }
      }
      if (xmpPatched > 0) {
        const patchedU8 = new TextEncoder('latin1').encode(text);
        // Ensure head byte stays intact
        if (item.headOffset !== -1) {
          patchedU8[item.headOffset + 15] = targetByte;
        }
        diffs.push({
          chunk: 'XMP Metadata XML',
          description: `Updated ${xmpPatched} XMP version strings to AE ${targetYear}`
        });
        return { data: patchedU8, diffs };
      }
    }

    return { data: u8, diffs };
  } else if (item.type === 'aep' || item.type === 'aet') {
    // Project file (.aep)
    if (item.headOffset !== -1) {
      const headDataOffset = item.headOffset + 8;
      const majorOffset = headDataOffset + 1;
      const oldVal = u8[majorOffset];
      u8[majorOffset] = targetByte;

      diffs.push({
        offset: majorOffset,
        chunk: 'head (AEP major version byte)',
        oldByte: oldVal,
        newByte: targetByte
      });

      // Apply specific build hex if chosen
      if (targetBuildHex) {
        const cleanHex = targetBuildHex.replace(/[^0-9a-fA-F]/g, '');
        for (let i = 0; i < Math.min(cleanHex.length / 2, 8); i++) {
          const b = parseInt(cleanHex.substr(i * 2, 2), 16);
          const off = headDataOffset + i;
          const oldB = u8[off];
          if (oldB !== b) {
            u8[off] = b;
            diffs.push({
              offset: off,
              chunk: `head byte [${i}] (Build signature)`,
              oldByte: oldB,
              newByte: b
            });
          }
        }
      }
    }

    // Deep patch XMP metadata
    if (deepPatch) {
      let text = new TextDecoder('latin1').decode(u8);
      let xmpPatched = 0;
      for (let y = 2028; y >= 2018; y--) {
        if (y > targetYear) {
          const s1 = `Adobe After Effects ${y}`;
          const r1 = `Adobe After Effects ${targetYear}`;
          if (text.includes(s1)) {
            text = text.replaceAll(s1, r1);
            xmpPatched++;
          }
        }
      }
      if (xmpPatched > 0) {
        const patchedU8 = new TextEncoder('latin1').encode(text);
        if (item.headOffset !== -1) {
          patchedU8[item.headOffset + 8 + 1] = targetByte;
        }
        diffs.push({
          chunk: 'XMP Metadata XML',
          description: `Synchronized ${xmpPatched} XMP version markers to AE ${targetYear}`
        });
        return { data: patchedU8, diffs };
      }
    }

    return { data: u8, diffs };
  } else if (item.type === 'aepx') {
    // XML format (.aepx)
    let text = new TextDecoder('utf-8').decode(u8);
    let count = 0;
    const targetVerStr = `${targetMajor}.0`;

    // Replace bva="..."
    text = text.replace(/bva="[0-9\.]+"/g, () => { count++; return `bva="${targetVerStr}"`; });
    text = text.replace(/app_version="[0-9\.]+"/g, () => { count++; return `app_version="${targetVerStr}"`; });
    for (let y = 2028; y >= 2018; y--) {
      if (y > targetYear) {
        text = text.replaceAll(`Adobe After Effects ${y}`, `Adobe After Effects ${targetYear}`);
      }
    }

    diffs.push({
      chunk: 'AEPX XML Attributes',
      description: `Updated ${count} XML project version attributes to ${targetVerStr}`
    });

    return { data: new TextEncoder().encode(text), diffs };
  }

  throw new Error('Unsupported file format');
}

// Generate output file name
function getOutputFilename(originalName, targetYear, namingPattern = 'suffix_year') {
  const parts = originalName.split('.');
  const ext = parts.pop();
  const base = parts.join('.');

  if (namingPattern === 'suffix_year') {
    return `${base}_AE${targetYear}.${ext}`;
  } else if (namingPattern === 'suffix_downgraded') {
    return `${base}_downgraded.${ext}`;
  } else if (namingPattern === 'prefix') {
    return `AE${targetYear}_${base}.${ext}`;
  }
  return `${base}.${ext}`;
}

// DOM Setup and Events
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const folderInput = document.getElementById('folderInput');
  const fileList = document.getElementById('fileList');
  const emptyQueue = document.getElementById('emptyQueue');
  const queueCount = document.getElementById('queueCount');
  const btnProcessAll = document.getElementById('btnProcessAll');
  const btnDownloadZip = document.getElementById('btnDownloadZip');
  const btnClearQueue = document.getElementById('btnClearQueue');
  const targetYearSelect = document.getElementById('targetYearSelect');
  const buildSelect = document.getElementById('buildSelect');
  const osFilter = document.getElementById('osFilter');
  const deepPatchSwitch = document.getElementById('deepPatchSwitch');
  const namingSelect = document.getElementById('namingSelect');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');

  // Modal elements
  const inspectorModal = document.getElementById('inspectorModal');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  // Populate Build Presets from builds-data.js
  function populateBuilds() {
    if (typeof AE_BUILDS === 'undefined') return;
    const year = parseInt(targetYearSelect.value);
    const os = osFilter.value;

    buildSelect.innerHTML = '<option value="">Auto (Clean Major Signature - Recommended)</option>';
    const filtered = AE_BUILDS.filter(b => {
      const matchYear = b.version.startsWith(year.toString()) || b.version.includes(`v${year - 2000}.`);
      const matchOS = os === 'all' || b.version.toLowerCase().includes(os.toLowerCase());
      return matchYear && matchOS;
    });

    filtered.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.hex;
      opt.textContent = `${b.version} [Hex: ${b.hex.substring(0, 10)}...]`;
      buildSelect.appendChild(opt);
    });
  }

  populateBuilds();
  targetYearSelect.addEventListener('change', populateBuilds);
  osFilter.addEventListener('change', populateBuilds);

  // Sound toggle
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggleBtn.title = soundEnabled ? 'Sound FX: Enabled' : 'Sound FX: Muted';
    soundToggleBtn.style.opacity = soundEnabled ? '1' : '0.5';
    playAudio('click');
  });

  // Drag and drop handlers
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files);
    handleAddedFiles(files);
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleAddedFiles(Array.from(fileInput.files));
      fileInput.value = '';
    }
  });

  folderInput.addEventListener('change', () => {
    if (folderInput.files.length) {
      handleAddedFiles(Array.from(folderInput.files));
      folderInput.value = '';
    }
  });

  // Handle incoming files
  async function handleAddedFiles(files) {
    playAudio('click');
    const validExtensions = ['aep', 'ffx', 'aet', 'aepx'];
    const filtered = files.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return validExtensions.includes(ext);
    });

    if (filtered.length === 0) {
      alert('Please upload valid After Effects project (.aep, .aet, .aepx) or preset (.ffx) files.');
      return;
    }

    for (const f of filtered) {
      const inspection = await inspectFile(f);
      inspection.id = 'item_' + Math.random().toString(36).substr(2, 9);
      inspection.status = 'ready'; // ready, processing, success, error
      inspection.targetYear = parseInt(targetYearSelect.value);
      inspection.resultData = null;
      inspection.diffs = [];
      fileQueue.push(inspection);
    }

    updateQueueUI();
  }

  // Update UI queue
  function updateQueueUI() {
    queueCount.textContent = fileQueue.length;
    if (fileQueue.length === 0) {
      emptyQueue.style.display = 'block';
      fileList.innerHTML = '';
      btnProcessAll.disabled = true;
      btnDownloadZip.disabled = true;
      btnClearQueue.disabled = true;
      return;
    }

    emptyQueue.style.display = 'none';
    btnProcessAll.disabled = false;
    btnClearQueue.disabled = false;

    // Check if any processed for ZIP download
    const anyDone = fileQueue.some(i => i.status === 'success');
    btnDownloadZip.disabled = !anyDone;

    fileList.innerHTML = '';
    fileQueue.forEach(item => {
      const el = document.createElement('div');
      el.className = `file-item ${item.status}`;
      el.id = item.id;

      const sizeStr = formatBytes(item.size);
      const isDone = item.status === 'success';

      el.innerHTML = `
        <div class="file-badge ${item.type}">${item.type.toUpperCase()}</div>
        <div class="file-details">
          <div class="file-name" title="${item.file.name}">${item.file.name}</div>
          <div class="file-meta">
            <span>${sizeStr}</span>
            <span class="version-pill source">Source: ${item.detectedVersion}</span>
            <span class="version-pill target">Target: AE ${item.targetYear}</span>
          </div>
          <div class="item-progress-bar" style="display: ${item.status === 'processing' ? 'block' : 'none'};">
            <div class="item-progress-fill" style="width: ${item.status === 'processing' ? '70%' : '100%'}"></div>
          </div>
        </div>
        <div class="file-status">
          <span class="status-pill status-${item.status}">
            ${item.status === 'ready' ? 'Ready' : ''}
            ${item.status === 'processing' ? 'Downgrading...' : ''}
            ${item.status === 'success' ? '✓ Downgraded' : ''}
            ${item.status === 'error' ? '⚠ Failed' : ''}
          </span>
        </div>
        <div class="file-actions">
          ${isDone ? `
            <button class="btn btn-sm btn-outline btn-inspect" data-id="${item.id}" title="Inspect Hex & Structure">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Inspect
            </button>
            <button class="btn btn-sm btn-success btn-download" data-id="${item.id}" title="Download File">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          ` : `
            <button class="btn btn-sm btn-primary btn-single-process" data-id="${item.id}">
              Downgrade
            </button>
          `}
          <button class="btn-icon btn-remove" data-id="${item.id}" title="Remove file" style="width: 32px; height: 32px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `;
      fileList.appendChild(el);
    });

    attachItemEventListeners();
  }

  function attachItemEventListeners() {
    // Single process
    document.querySelectorAll('.btn-single-process').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const item = fileQueue.find(i => i.id === id);
        if (item) processSingleItem(item);
      };
    });

    // Single download
    document.querySelectorAll('.btn-download').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const item = fileQueue.find(i => i.id === id);
        if (item && item.resultData) {
          playAudio('click');
          downloadItem(item);
        }
      };
    });

    // Inspect
    document.querySelectorAll('.btn-inspect').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const item = fileQueue.find(i => i.id === id);
        if (item) openInspectorModal(item);
      };
    });

    // Remove
    document.querySelectorAll('.btn-remove').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const idx = fileQueue.findIndex(i => i.id === id);
        if (idx !== -1) {
          playAudio('click');
          fileQueue.splice(idx, 1);
          updateQueueUI();
        }
      };
    });
  }

  // Downgrade single file
  async function processSingleItem(item) {
    item.status = 'processing';
    item.targetYear = parseInt(targetYearSelect.value);
    updateQueueUI();

    try {
      await new Promise(r => setTimeout(r, 150)); // UI smoothness
      const options = {
        deepPatch: deepPatchSwitch.checked,
        targetBuildHex: buildSelect.value || null
      };

      const res = processDowngrade(item, item.targetYear, options);
      item.resultData = res.data;
      item.diffs = res.diffs;
      item.status = 'success';
      playAudio('success');
    } catch (err) {
      console.error(err);
      item.status = 'error';
      item.errorMsg = err.message;
    }

    updateQueueUI();
  }

  // Download single item
  function downloadItem(item) {
    const outName = getOutputFilename(item.file.name, item.targetYear, namingSelect.value);
    const blob = new Blob([item.resultData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  // Downgrade All button
  btnProcessAll.addEventListener('click', async () => {
    if (isProcessingAll) return;
    isProcessingAll = true;
    btnProcessAll.disabled = true;

    for (const item of fileQueue) {
      if (item.status !== 'success') {
        await processSingleItem(item);
      }
    }

    isProcessingAll = false;
    btnProcessAll.disabled = false;
    updateQueueUI();
  });

  // Download All as ZIP
  btnDownloadZip.addEventListener('click', async () => {
    const successItems = fileQueue.filter(i => i.status === 'success' && i.resultData);
    if (successItems.length === 0) return;

    if (typeof JSZip === 'undefined') {
      alert('JSZip library is loading. Please try again.');
      return;
    }

    playAudio('click');
    btnDownloadZip.disabled = true;
    btnDownloadZip.textContent = 'Compressing ZIP...';

    const zip = new JSZip();
    successItems.forEach(item => {
      const outName = getOutputFilename(item.file.name, item.targetYear, namingSelect.value);
      zip.file(outName, item.resultData);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AfterEffects_Downgraded_AE${targetYearSelect.value}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    btnDownloadZip.textContent = 'Download All (ZIP)';
    btnDownloadZip.disabled = false;
    playAudio('success');
  });

  // Clear queue
  btnClearQueue.addEventListener('click', () => {
    if (confirm('Clear all files from queue?')) {
      playAudio('click');
      fileQueue.length = 0;
      updateQueueUI();
    }
  });

  // Inspector Modal
  function openInspectorModal(item) {
    playAudio('click');
    modalTitle.textContent = `Hex & Structure Inspector: ${item.file.name}`;

    let diffsHtml = '';
    if (item.diffs && item.diffs.length > 0) {
      diffsHtml = `
        <div style="font-weight: 600; color: #a78bfa; margin-bottom: 8px;">Applied Binary Patches:</div>
        <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.8rem; margin-bottom: 16px;">
          <thead>
            <tr style="text-align: left; border-bottom: 1px solid var(--border-subtle); color: var(--text-muted);">
              <th style="padding: 6px;">Target Element</th>
              <th style="padding: 6px;">Offset (dec / hex)</th>
              <th style="padding: 6px;">Original Value</th>
              <th style="padding: 6px;">Downgraded Value</th>
            </tr>
          </thead>
          <tbody>
            ${item.diffs.map(d => {
              if (d.offset !== undefined) {
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 8px 6px; color: #e2e8f0;">${d.chunk}</td>
                    <td style="padding: 8px 6px; color: #94a3b8;">${d.offset} (0x${d.offset.toString(16).toUpperCase()})</td>
                    <td style="padding: 8px 6px;"><span class="hex-highlight-old">0x${d.oldByte.toString(16).padStart(2, '0').toUpperCase()}</span></td>
                    <td style="padding: 8px 6px;"><span class="hex-highlight-new">0x${d.newByte.toString(16).padStart(2, '0').toUpperCase()}</span></td>
                  </tr>
                `;
              } else {
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 8px 6px; color: #e2e8f0;">${d.chunk}</td>
                    <td colspan="3" style="padding: 8px 6px; color: #34d399;">${d.description}</td>
                  </tr>
                `;
              }
            }).join('')}
          </tbody>
        </table>
      `;
    }

    // Build raw hex preview around head offset
    let hexViewHtml = '';
    if (item.headOffset !== -1 && item.resultData) {
      const start = Math.max(0, item.headOffset - 8);
      const end = Math.min(item.resultData.length, item.headOffset + 36);
      const origSlice = item.u8.slice(start, end);
      const newSlice = item.resultData.slice(start, end);

      hexViewHtml = `
        <div style="font-weight: 600; color: #38bdf8; margin-bottom: 8px;">Binary Chunk Preview (Offset 0x${start.toString(16).toUpperCase()} .. 0x${end.toString(16).toUpperCase()}):</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 0.75rem; color: #fca5a5; margin-bottom: 4px;">Original Binary:</div>
            <div class="hex-box">${formatHexDump(origSlice, start, item.diffs.map(d => d.offset))}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #86efac; margin-bottom: 4px;">Patched Binary (AE ${item.targetYear}):</div>
            <div class="hex-box">${formatHexDump(newSlice, start, item.diffs.map(d => d.offset), true)}</div>
          </div>
        </div>
      `;
    }

    modalBody.innerHTML = `
      <div style="display: flex; gap: 16px; margin-bottom: 12px; font-size: 0.85rem;">
        <div><strong>Container Format:</strong> ${item.format}</div>
        <div><strong>Original Version:</strong> <span style="color: #fca5a5;">${item.detectedVersion}</span></div>
        <div><strong>Target Version:</strong> <span style="color: #86efac;">AE ${item.targetYear}</span></div>
      </div>
      ${diffsHtml}
      ${hexViewHtml}
    `;

    inspectorModal.classList.add('open');
  }

  function formatHexDump(bytes, startOffset, modifiedOffsets = [], isNew = false) {
    let lines = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const slice = bytes.slice(i, i + 16);
      const lineOffset = (startOffset + i).toString(16).padStart(6, '0').toUpperCase();
      const hexParts = Array.from(slice).map((b, idx) => {
        const curOff = startOffset + i + idx;
        const isMod = modifiedOffsets.includes(curOff);
        const hex = b.toString(16).padStart(2, '0').toUpperCase();
        if (isMod) {
          return isNew ? `<span class="hex-highlight-new">${hex}</span>` : `<span class="hex-highlight-old">${hex}</span>`;
        }
        return hex;
      }).join(' ');

      const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
      lines.push(`${lineOffset}:  ${hexParts.padEnd(55, ' ')} | ${ascii}`);
    }
    return lines.join('\n');
  }

  modalClose.addEventListener('click', () => {
    inspectorModal.classList.remove('open');
  });

  inspectorModal.addEventListener('click', (e) => {
    if (e.target === inspectorModal) inspectorModal.classList.remove('open');
  });
});

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


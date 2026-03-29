// ══════════════════════════════════════════════
// GUI PANEL — Environment & Post-Processing
// ══════════════════════════════════════════════
//
// Provides a floating panel to tweak lighting,
// shadow, HDR environment, and SSGI/AO settings.
// ══════════════════════════════════════════════



// ── Helpers ──
function hexFromColor(threeColor) {
  return "#" + threeColor.getHexString();
}
function colorFromHex(hex) {
  return parseInt(hex.replace("#", ""), 16);
}

// ══════════════════════════════════════════════
// ── BUILD GUI ──
// ══════════════════════════════════════════════

export function createGUI({ scene, renderer, lights, aoPass, updateOutputPipeline, groundUniforms }) {
  const { ambientLight, sunLight, fillLight } = lights;

  // ── Inject CSS ──
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    #gui-toggle-btn {
      position: fixed; top: 12px; right: 12px;
      width: 34px; height: 34px;
      background: rgba(18, 18, 22, 0.88);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; color: rgba(255,255,255,0.55);
      font-size: 16px; display: flex; align-items: center;
      justify-content: center; cursor: pointer;
      z-index: 10000; backdrop-filter: blur(12px);
      transition: background 0.15s, color 0.15s;
      font-family: 'Inter', sans-serif;
      user-select: none;
    }
    #gui-toggle-btn:hover {
      background: rgba(255,255,255,0.08); color: #fff;
    }
    #gui-toggle-btn.active {
      background: rgba(80,180,255,0.18); color: rgba(255,255,255,0.85);
      border-color: rgba(80,180,255,0.25);
    }

    #gui-panel {
      position: fixed; top: 54px; right: 10px;
      width: 280px; max-height: calc(100vh - 66px);
      overflow-y: auto; overflow-x: hidden;
      background: rgba(18, 18, 22, 0.92);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      font-family: 'Inter', sans-serif;
      font-size: 11px; color: #ccc;
      padding: 0; z-index: 9999;
      backdrop-filter: blur(12px);
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.12) transparent;
      display: none;
    }
    #gui-panel.visible { display: block; }
    #gui-panel::-webkit-scrollbar { width: 4px; }
    #gui-panel::-webkit-scrollbar-track { background: transparent; }
    #gui-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

    .gui-header {
      padding: 10px 14px 8px;
      font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.8px;
      color: rgba(255,255,255,0.45);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      cursor: pointer; user-select: none;
      display: flex; justify-content: space-between; align-items: center;
    }
    .gui-header:hover { color: rgba(255,255,255,0.65); }
    .gui-header .arrow { font-size: 9px; transition: transform 0.2s; }
    .gui-header .arrow.collapsed { transform: rotate(-90deg); }

    .gui-section { padding: 6px 14px 10px; }
    .gui-section.collapsed { display: none; }

    .gui-row {
      display: flex; align-items: center;
      justify-content: space-between;
      margin-bottom: 6px; gap: 8px;
    }
    .gui-row label {
      flex: 0 0 auto; min-width: 70px;
      font-size: 10.5px; color: rgba(255,255,255,0.55);
      white-space: nowrap;
    }
    .gui-row input[type="range"] {
      flex: 1; height: 3px;
      -webkit-appearance: none; appearance: none;
      background: rgba(255,255,255,0.12); border-radius: 2px;
      outline: none; cursor: pointer;
    }
    .gui-row input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 10px; height: 10px; border-radius: 50%;
      background: #fff; cursor: pointer;
    }
    .gui-row input[type="range"]::-moz-range-thumb {
      width: 10px; height: 10px; border-radius: 50%;
      background: #fff; border: none; cursor: pointer;
    }
    .gui-row .gui-value {
      flex: 0 0 36px; text-align: right;
      font-size: 10px; color: rgba(255,255,255,0.4);
      font-variant-numeric: tabular-nums;
    }
    .gui-row input[type="color"] {
      width: 24px; height: 18px; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 3px; background: none; cursor: pointer;
      padding: 0; -webkit-appearance: none;
    }
    .gui-row input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
    .gui-row input[type="color"]::-webkit-color-swatch { border: none; border-radius: 2px; }

    .gui-row select {
      flex: 1; height: 22px; font-size: 10.5px;
      font-family: 'Inter', sans-serif;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 4px; color: #ccc;
      padding: 0 6px; outline: none; cursor: pointer;
    }
    .gui-row select option { background: #1a1a1e; }

    .gui-toggle {
      position: relative; width: 32px; height: 16px;
      background: rgba(255,255,255,0.1); border-radius: 8px;
      cursor: pointer; transition: background 0.2s; flex-shrink: 0;
    }
    .gui-toggle.active { background: rgba(80,180,255,0.5); }
    .gui-toggle::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 12px; height: 12px; border-radius: 50%;
      background: #fff; transition: transform 0.2s;
    }
    .gui-toggle.active::after { transform: translateX(16px); }

    .gui-divider {
      height: 1px; background: rgba(255,255,255,0.06);
      margin: 0;
    }
  `;
  document.head.appendChild(style);

  // ── Panel container ──
  // ── Toggle button ──
  const toggleBtn = document.createElement("div");
  toggleBtn.id = "gui-toggle-btn";
  toggleBtn.innerHTML = "⚙";
  document.body.appendChild(toggleBtn);

  const panel = document.createElement("div");
  panel.id = "gui-panel";
  document.body.appendChild(panel);

  toggleBtn.addEventListener("click", () => {
    const open = panel.classList.toggle("visible");
    toggleBtn.classList.toggle("active", open);
  });

  // ── Section builder ──
  function addSection(title, buildFn, startOpen = true) {
    const header = document.createElement("div");
    header.className = "gui-header";
    const titleSpan = document.createElement("span");
    titleSpan.textContent = title;
    const arrow = document.createElement("span");
    arrow.className = "arrow" + (startOpen ? "" : " collapsed");
    arrow.textContent = "▼";
    header.appendChild(titleSpan);
    header.appendChild(arrow);
    panel.appendChild(header);

    const section = document.createElement("div");
    section.className = "gui-section" + (startOpen ? "" : " collapsed");
    panel.appendChild(section);

    header.addEventListener("click", () => {
      section.classList.toggle("collapsed");
      arrow.classList.toggle("collapsed");
    });

    buildFn(section);

    const divider = document.createElement("div");
    divider.className = "gui-divider";
    panel.appendChild(divider);
  }

  // ── Row builders ──
  function addSlider(parent, label, min, max, step, value, onChange) {
    const row = document.createElement("div");
    row.className = "gui-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const input = document.createElement("input");
    input.type = "range"; input.min = min; input.max = max;
    input.step = step; input.value = value;

    const val = document.createElement("span");
    val.className = "gui-value";
    val.textContent = parseFloat(value).toFixed(step < 0.1 ? 2 : 1);

    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      val.textContent = v.toFixed(step < 0.1 ? 2 : 1);
      onChange(v);
    });

    row.appendChild(lbl); row.appendChild(input); row.appendChild(val);
    parent.appendChild(row);
    return input;
  }

  function addColor(parent, label, hexValue, onChange) {
    const row = document.createElement("div");
    row.className = "gui-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const input = document.createElement("input");
    input.type = "color"; input.value = hexValue;

    input.addEventListener("input", () => onChange(input.value));

    row.appendChild(lbl); row.appendChild(input);
    parent.appendChild(row);
  }

  function addToggle(parent, label, active, onChange) {
    const row = document.createElement("div");
    row.className = "gui-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const toggle = document.createElement("div");
    toggle.className = "gui-toggle" + (active ? " active" : "");
    toggle.addEventListener("click", () => {
      const next = !toggle.classList.contains("active");
      toggle.classList.toggle("active");
      onChange(next);
    });

    row.appendChild(lbl); row.appendChild(toggle);
    parent.appendChild(row);
  }

  function addSelect(parent, label, options, selectedIndex, onChange) {
    const row = document.createElement("div");
    row.className = "gui-row";

    const lbl = document.createElement("label");
    lbl.textContent = label;

    const select = document.createElement("select");
    options.forEach((opt, i) => {
      const o = document.createElement("option");
      o.value = i; o.textContent = opt; if (i === selectedIndex) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener("change", () => onChange(parseInt(select.value)));

    row.appendChild(lbl); row.appendChild(select);
    parent.appendChild(row);
  }

  // ════════════════════════════════════════════
  // ── SECTIONS ──
  // ════════════════════════════════════════════

  // ── Environment ──
  addSection("Environment", (sec) => {
    addSlider(sec, "Env Intensity", 0, 2, 0.01, scene.environmentIntensity, (v) => {
      scene.environmentIntensity = v;
    });
  });

  // ── Ambient Light ──
  addSection("Ambient Light", (sec) => {
    addColor(sec, "Color", hexFromColor(ambientLight.color), (hex) => {
      ambientLight.color.set(colorFromHex(hex));
    });
    addSlider(sec, "Intensity", 0, 5, 0.05, ambientLight.intensity, (v) => {
      ambientLight.intensity = v;
    });
  });

  // ── Sun Light ──
  addSection("Sun Light", (sec) => {
    addColor(sec, "Color", hexFromColor(sunLight.color), (hex) => {
      sunLight.color.set(colorFromHex(hex));
    });
    addSlider(sec, "Intensity", 0, 8, 0.05, sunLight.intensity, (v) => {
      sunLight.intensity = v;
    });
    addSlider(sec, "Pos X", -30, 30, 0.1, sunLight.position.x, (v) => { sunLight.position.x = v; });
    addSlider(sec, "Pos Y", 0, 30, 0.1, sunLight.position.y, (v) => { sunLight.position.y = v; });
    addSlider(sec, "Pos Z", -30, 30, 0.1, sunLight.position.z, (v) => { sunLight.position.z = v; });
  });

  // ── Shadows ──
  addSection("Shadows", (sec) => {
    addSlider(sec, "Radius", 0, 8, 0.1, sunLight.shadow.radius, (v) => {
      sunLight.shadow.radius = v;
    });
    addSlider(sec, "Blur Samples", 0, 16, 0.1, sunLight.shadow.blurSamples, (v) => {
      sunLight.shadow.blurSamples = v;
    });
    addSlider(sec, "Bias", -0.05, 0.05, 0.01, sunLight.shadow.bias, (v) => {
      sunLight.shadow.bias = v;
    });
    addSlider(sec, "Normal Bias", 0, 0.1, 0.01, sunLight.shadow.normalBias, (v) => {
      sunLight.shadow.normalBias = v;
    });
  });

  // ── Fill Light ──
  addSection("Fill Light", (sec) => {
    addColor(sec, "Color", hexFromColor(fillLight.color), (hex) => {
      fillLight.color.set(colorFromHex(hex));
    });
    addSlider(sec, "Intensity", 0, 5, 0.05, fillLight.intensity, (v) => {
      fillLight.intensity = v;
    });
    addSlider(sec, "Pos X", -20, 20, 0.1, fillLight.position.x, (v) => { fillLight.position.x = v; });
    addSlider(sec, "Pos Y", 0, 20, 0.1, fillLight.position.y, (v) => { fillLight.position.y = v; });
    addSlider(sec, "Pos Z", -20, 20, 0.1, fillLight.position.z, (v) => { fillLight.position.z = v; });
  }, false);

  // ── Tone Mapping ──
  addSection("Tone Mapping", (sec) => {
    addSlider(sec, "Exposure", 0.1, 3, 0.01, renderer.toneMappingExposure, (v) => {
      renderer.toneMappingExposure = v;
    });
  }, false);

  // ── Ground ──
  if (groundUniforms) {
    // helper: read hex from TSL uniform color
    function hexFromUniformColor(u) {
      const c = u.value;
      if (c && c.getHexString) return "#" + c.getHexString();
      return "#228b22";
    }
    function setUniformColor(u, hex) {
      const v = parseInt(hex.replace("#", ""), 16);
      if (u.value && u.value.set) u.value.set(v);
    }

    addSection("Ground", (sec) => {
      addColor(sec, "Base Color", hexFromUniformColor(groundUniforms.baseColor), (hex) => {
        setUniformColor(groundUniforms.baseColor, hex);
      });
      addColor(sec, "Tri Color 1", hexFromUniformColor(groundUniforms.triColor1), (hex) => {
        setUniformColor(groundUniforms.triColor1, hex);
      });
      addColor(sec, "Tri Color 2", hexFromUniformColor(groundUniforms.triColor2), (hex) => {
        setUniformColor(groundUniforms.triColor2, hex);
      });
      addColor(sec, "Tri Color 3", hexFromUniformColor(groundUniforms.triColor3), (hex) => {
        setUniformColor(groundUniforms.triColor3, hex);
      });
      addColor(sec, "Tri Color 4", hexFromUniformColor(groundUniforms.triColor4), (hex) => {
        setUniformColor(groundUniforms.triColor4, hex);
      });
      addSlider(sec, "Tile Scale", 20, 700, 1, groundUniforms.tileScale.value, (v) => {
        groundUniforms.tileScale.value = v;
      });
      addSlider(sec, "Tri Size Min", 0.05, 0.5, 0.01, groundUniforms.triSizeMin.value, (v) => {
        groundUniforms.triSizeMin.value = v;
      });
      addSlider(sec, "Tri Size Max", 0.1, 1.0, 0.01, groundUniforms.triSizeMax.value, (v) => {
        groundUniforms.triSizeMax.value = v;
      });
      addSlider(sec, "Density", 0, 1, 0.01, groundUniforms.triDensity.value, (v) => {
        groundUniforms.triDensity.value = v;
      });
      addSlider(sec, "Bright Var", 0, 0.5, 0.01, groundUniforms.triBrightVar.value, (v) => {
        groundUniforms.triBrightVar.value = v;
      });
    });
  }

  // ── Ambient Occlusion ──
  addSection("Ambient Occlusion", (sec) => {
    addToggle(sec, "AO Enabled", aoPass.aoEnabled, (v) => {
      aoPass.aoEnabled = v;
      updateOutputPipeline();
    });
    addSlider(sec, "AO Intensity", 0, 5, 0.05, aoPass.aoIntensity.value, (v) => {
      aoPass.aoIntensity.value = v;
    });
    addSlider(sec, "Radius", 0, 20, 0.1, aoPass.radius.value, (v) => {
      aoPass.radius.value = v;
    });
    addSlider(sec, "Thickness", 0, 2, 0.01, aoPass.thickness.value, (v) => {
      aoPass.thickness.value = v;
    });
    addSlider(sec, "Exp Factor", 0, 5, 0.1, aoPass.expFactor.value, (v) => {
      aoPass.expFactor.value = v;
    });
    addSlider(sec, "Slice Count", 1, 8, 1, aoPass.sliceCount.value, (v) => {
      aoPass.sliceCount.value = v;
    });
    addSlider(sec, "Step Count", 1, 16, 1, aoPass.stepCount.value, (v) => {
      aoPass.stepCount.value = v;
    });
    addSlider(sec, "Backface Light", 0, 1, 0.01, aoPass.backfaceLighting.value, (v) => {
      aoPass.backfaceLighting.value = v;
    });
  });

  return panel;
}
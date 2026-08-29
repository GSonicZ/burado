function load_image(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

async function load_json(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

const canvas = document.getElementById("thumbnail");
const ctx = canvas.getContext("2d");

async function load_assets() {
  try {
    const result = {};
    result.abyss_12 = await load_image("static/abyss.png");
    result.four_star = await load_image("static/4star.png");
    result.question = await load_image("static/question.png");
    result.epic_fail = await load_image("static/epic_fail.png");
    result.chars = await load_json("static/chars.json");
    return result;
  } catch (error) {
    console.error("Failed to load assets:", error);
    throw error;
  }
}

const assets = await load_assets();

const chars_map = new Map();
for (const item of assets.chars.chars) {
  chars_map.set(item.toLowerCase(), `${assets.chars.directory}/${item}.png`);
}

// Abyss stacks one team down each edge; Stygian lines three teams up along the bottom.
const ABYSS_SIZE = 200;
const ABYSS_YS = [50, 260, 470];

const STYGIAN_SIZE = 128;
const STYGIAN_Y = 576;
const STYGIAN_MARGIN = 16;
const STYGIAN_TEAM_GAP = 48;

function abyss_team(prefix, title, x) {
  return {
    title,
    slots: ABYSS_YS.map((y, i) => ({
      key: `${prefix}${i + 1}`,
      placeholder: `${title} ${i + 1}`,
      x, y, size: ABYSS_SIZE,
    })),
  };
}

function stygian_team(team) {
  const origin = STYGIAN_MARGIN + team * (3 * STYGIAN_SIZE + STYGIAN_TEAM_GAP);
  const title = `Team ${team + 1}`;
  return {
    title,
    slots: [0, 1, 2].map((i) => ({
      key: `sty${team + 1}_${i + 1}`,
      placeholder: `${title} ${i + 1}`,
      x: origin + i * STYGIAN_SIZE,
      y: STYGIAN_Y,
      size: STYGIAN_SIZE,
    })),
  };
}

const MODES = {
  abyss: {
    name: "Abyss",
    overlay: "abyss_12",
    extras: true,
    backgrounds: [
      { key: "bg_left", title: "Left" },
      { key: "bg_right", title: "Right" },
    ],
    blend_max: 400,
    label_shift: false,
    groups: [
      abyss_team("left", "First Team", 0),
      abyss_team("right", "Second Team", 1280 - ABYSS_SIZE),
    ],
  },
  stygian: {
    name: "Stygian",
    overlay: null,
    extras: false,
    backgrounds: [
      { key: "bg_sty1", title: "Team 1" },
      { key: "bg_sty2", title: "Team 2" },
      { key: "bg_sty3", title: "Team 3" },
    ],
    blend_max: 200,
    label_shift: true,
    groups: [stygian_team(0), stygian_team(1), stygian_team(2)],
  },
};

// Stygian team count — 1 or 3
let sty_teams = 3;

function active_stygian_slots() {
  if (sty_teams === 1) return [stygian_team(0)].flatMap(g => g.slots);
  return MODES.stygian.groups.flatMap(g => g.slots);
}

function mode_slots(name) {
  if (name === "stygian") return active_stygian_slots();
  return MODES[name].groups.flatMap((group) => group.slots);
}

let mode = "abyss";

// --- Label inputs (original) ---
const abyss_label_first = document.getElementById("abyss_label_first");
const abyss_label_second = document.getElementById("abyss_label_second");
const abyss_label_distance = document.getElementById("abyss_label_distance");
const abyss_label_distance_value = document.getElementById("abyss_label_distance_value");
abyss_label_distance_value.textContent = abyss_label_distance.value;

const label_shift = document.getElementById("label_shift");
const label_shift_value = document.getElementById("label_shift_value");
label_shift_value.textContent = label_shift.value;

const label_state = {
  abyss:   { first: "Abyss", second: "X.X", distance: "60", shift: "0" },
  stygian: { first: "Stygian", second: "X.X", distance: "60", shift: "0" },
};

// --- Helper: bind controls ---
function bind_range(id, redraw_fn) {
  const el = document.getElementById(id);
  const out = document.getElementById(id + "_value");
  if (out) out.textContent = el.value;
  el.addEventListener("input", () => { if (out) out.textContent = el.value; redraw_fn(); });
  return el;
}
function bind_color(id, redraw_fn) {
  const el = document.getElementById(id);
  el.addEventListener("input", () => redraw_fn());
  return el;
}
function bind_text(id, redraw_fn) {
  const el = document.getElementById(id);
  el.addEventListener("input", () => redraw_fn());
  return el;
}

// --- Custom controls ---
const abyss_fill_color       = bind_color("abyss_fill_color",       () => draw_thumbnail());
const abyss_border_color     = bind_color("abyss_border_color",     () => draw_thumbnail());
const abyss_border_width     = bind_range("abyss_border_width",     () => draw_thumbnail());

const abyss_first_font_size  = bind_range("abyss_first_font_size",  () => draw_thumbnail());
const abyss_first_x          = bind_range("abyss_first_x",          () => draw_thumbnail());
const abyss_first_y          = bind_range("abyss_first_y",          () => draw_thumbnail());

const abyss_second_font_size = bind_range("abyss_second_font_size", () => draw_thumbnail());
const abyss_second_x         = bind_range("abyss_second_x",         () => draw_thumbnail());
const abyss_second_y         = bind_range("abyss_second_y",         () => draw_thumbnail());

const abyss_label_left       = bind_text("abyss_label_left",        () => draw_thumbnail());
const abyss_label_right      = bind_text("abyss_label_right",       () => draw_thumbnail());
const bottom_font_size       = bind_range("bottom_font_size",       () => draw_thumbnail());

const sty_fill_color         = bind_color("sty_fill_color",        () => draw_thumbnail());
const sty_border_color       = bind_color("sty_border_color",      () => draw_thumbnail());
const sty_border_width       = bind_range("sty_border_width",      () => draw_thumbnail());

const abyss_icon_x           = bind_range("abyss_icon_x",           () => draw_thumbnail());
const abyss_icon_y           = bind_range("abyss_icon_y",           () => draw_thumbnail());
const abyss_icon_scale       = bind_range("abyss_icon_scale",       () => draw_thumbnail());

// --- Background ---
const background_panels = document.getElementById("background_panels");
const background_shifts = document.getElementById("background_shifts");

const background_blend = document.getElementById("background_blend");
const background_blend_value = document.getElementById("background_blend_value");
background_blend_value.textContent = background_blend.value;

const backgrounds = {};
const shift_inputs = {};
const characters = {};

function build_background_inputs(name) {
  const tiles = document.createElement("div");
  tiles.className = "row g-2";
  tiles.dataset.mode = name;

  const shifts = document.createElement("div");
  shifts.dataset.mode = name;

  for (const panel of MODES[name].backgrounds) {
    const column = document.createElement("div");
    column.className = "col";

    const area = document.createElement("div");
    area.className = "paste-area";
    area.tabIndex = 0;

    const title = document.createElement("div");
    title.className = "fw-semibold";
    title.textContent = panel.title;

    const hint = document.createElement("div");
    hint.className = "text-muted";
    hint.textContent = "Ctrl+V";

    const browse = document.createElement("label");
    browse.className = "link-primary text-decoration-underline";
    browse.textContent = "browse";

    const file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    file.hidden = true;
    browse.append(file);

    area.append(title, hint, browse);
    column.append(area);
    tiles.append(column);

    area.addEventListener("paste", (event) => {
      const image = handle_paste(event);
      if (image) backgrounds[panel.key] = image;
    });
    file.addEventListener("change", (event) => {
      const image = handle_file_select(event);
      if (image) backgrounds[panel.key] = image;
    });

    const range = document.createElement("input");
    range.type = "range";
    range.className = "form-range";
    range.id = `shift_${panel.key}`;
    range.min = -100; range.max = 100; range.step = 1; range.value = 0;

    const head = document.createElement("div");
    head.className = "d-flex justify-content-between";

    const label = document.createElement("label");
    label.className = "form-label small mb-1";
    label.htmlFor = range.id;
    label.textContent = `${panel.title} shift`;

    const value = document.createElement("output");
    value.className = "small text-muted";
    value.setAttribute("for", range.id);
    value.textContent = range.value;

    head.append(label, value);
    range.addEventListener("input", () => { value.textContent = range.value; draw_thumbnail(); });

    shifts.append(head, range);
    shift_inputs[panel.key] = range;
  }

  background_panels.append(tiles);
  background_shifts.append(shifts);
}

function handle_paste(event) {
  const clipboardData = event.clipboardData || window.clipboardData;
  if (!clipboardData) { alert('Clipboard API not supported in this browser'); return; }
  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      if (clipboardData.items[i].type.indexOf('image') !== -1) {
        const blob = clipboardData.items[i].getAsFile();
        let result = process_image_blob(blob);
        event.preventDefault();
        return result;
      }
    }
  }
  alert('No image found in clipboard');
}

function handle_file_select(event) {
  const file = event.target.files[0];
  if (file && file.type.indexOf('image') !== -1) return process_image_blob(file);
  alert('Please select a valid image file');
}

function process_image_blob(blob) {
  const imageUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = function () { URL.revokeObjectURL(imageUrl); draw_thumbnail(); };
  image.onerror = function () { alert('Error loading image'); URL.revokeObjectURL(imageUrl); };
  image.src = imageUrl;
  return image;
}

const REF_W = 1920;
const REF_H = 1080;
const CROP_X_FROM_CENTER = 633 - REF_W / 2;
const CROP_Y = 98;
const CROP_REF_BAND = 640;
const w = 1280;
const h = 720;

function is_ready(img) { return img && img.complete && img.naturalHeight > 0; }

function panel_edges(count) {
  return Array.from({ length: count + 1 }, (_, i) => Math.round((w * i) / count));
}

function background_source(img, shift) {
  const s = img.naturalHeight / REF_H;
  return { s, x: img.naturalWidth / 2 + (CROP_X_FROM_CENTER + shift) * s, y: CROP_Y * s };
}

function draw_bg_slice(target, img, shift, side_origin, dest_x, dest_w, out_x, out_y) {
  const src = background_source(img, shift);
  target.drawImage(img,
    src.x + (dest_x - side_origin) * src.s, src.y, dest_w * src.s, h * src.s,
    out_x, out_y, dest_w, h);
}

function draw_backgrounds(layout, blend) {
  const panels = layout.backgrounds;
  const edges = panel_edges(panels.length);
  const image_of = (panel) => backgrounds[panel.key];

  const panel_shifts = panels.map((panel, i) => {
    const band = edges[i + 1] - edges[i];
    return (CROP_REF_BAND - band) / 2 - parseInt(shift_inputs[panel.key].value, 10);
  });

  const ready = panels.map((panel) => is_ready(image_of(panel)));
  const faded = edges.map((_, i) => i > 0 && i < panels.length && blend > 0 && ready[i - 1] && ready[i]);

  for (let i = 0; i < panels.length; i++) {
    if (!ready[i]) continue;
    const start = faded[i] ? edges[i] + blend : edges[i];
    const end = faded[i + 1] ? edges[i + 1] + blend : edges[i + 1];
    draw_bg_slice(ctx, image_of(panels[i]), panel_shifts[i], edges[i], start, end - start, start, 0);
  }

  for (let i = 1; i < panels.length; i++) {
    if (!faded[i]) continue;
    const seam = edges[i];
    const off = document.createElement('canvas');
    off.width = blend * 2; off.height = h;
    const octx = off.getContext('2d');
    draw_bg_slice(octx, image_of(panels[i]), panel_shifts[i], seam, seam - blend, blend * 2, 0, 0);
    const grad = octx.createLinearGradient(0, 0, blend * 2, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    octx.globalCompositeOperation = 'destination-in';
    octx.fillStyle = grad;
    octx.fillRect(0, 0, blend * 2, h);
    ctx.drawImage(off, seam - blend, 0);
  }
}

const four_star_checkbox = document.querySelector('#four_star');
const question_checkbox  = document.querySelector('#question');
const epic_fail_checkbox = document.querySelector('#epic_fail');

// --- Draw text helper ---
function draw_text_line(text, x, y, fontSize, fillColor, borderColor, borderWidth) {
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.lineJoin = "round";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (borderWidth > 0) ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

function draw_thumbnail() {
  const layout = MODES[mode];

  ctx.fillStyle = "#888888";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  draw_backgrounds(layout, parseInt(background_blend.value, 10));

  // Abyss icon (only in abyss mode) — center-anchored
  if (layout.overlay) {
    const iconX     = parseInt(abyss_icon_x.value, 10);
    const iconY     = parseInt(abyss_icon_y.value, 10);
    const iconScale = parseInt(abyss_icon_scale.value, 10) / 100;
    const iconW     = assets[layout.overlay].width * iconScale;
    const iconH     = assets[layout.overlay].height * iconScale;
    ctx.drawImage(assets[layout.overlay], iconX - iconW / 2, iconY - iconH / 2, iconW, iconH);
  }

  // Text
  const fillColor   = abyss_fill_color.value;
  const borderColor = abyss_border_color.value;
  const borderWidth = parseInt(abyss_border_width.value, 10);

  const text_middle = 360 + (layout.label_shift ? parseInt(label_shift.value, 10) : 0);

  if (mode === "abyss") {
    // Abyss: each line has independent X/Y/font size
    draw_text_line(
      abyss_label_first.value,
      parseInt(abyss_first_x.value, 10),
      parseInt(abyss_first_y.value, 10),
      parseInt(abyss_first_font_size.value, 10),
      fillColor, borderColor, borderWidth
    );
    draw_text_line(
      abyss_label_second.value,
      parseInt(abyss_second_x.value, 10),
      parseInt(abyss_second_y.value, 10),
      parseInt(abyss_second_font_size.value, 10),
      fillColor, borderColor, borderWidth
    );

    // Bottom left/right labels
    const left_line  = abyss_label_left.value;
    const right_line = abyss_label_right.value;
    const bottomY = canvas.height - 80;
    const bfs = parseInt(bottom_font_size.value, 10);
    if (left_line)  draw_text_line(left_line,  canvas.width / 4,       bottomY, bfs, fillColor, borderColor, borderWidth);
    if (right_line) draw_text_line(right_line, (canvas.width / 4) * 3, bottomY, bfs, fillColor, borderColor, borderWidth);

  } else {
    // Stygian: uses distance/shift, independent colors
    const sty_fill   = sty_fill_color.value;
    const sty_border = sty_border_color.value;
    const sty_bw     = parseInt(sty_border_width.value, 10);
    const text_distance = parseInt(abyss_label_distance.value, 10);
    draw_text_line(abyss_label_first.value,  640, text_middle - text_distance, parseInt(abyss_first_font_size.value, 10), sty_fill, sty_border, sty_bw);
    draw_text_line(abyss_label_second.value, 640, text_middle + text_distance, parseInt(abyss_second_font_size.value, 10), sty_fill, sty_border, sty_bw);
  }

  // Characters
  for (const slot of mode_slots(mode)) {
    const image = characters[slot.key];
    if (image) {
      ctx.drawImage(image, 0, 0, image.width, image.height, slot.x, slot.y, slot.size, slot.size);
    }
  }

  // Extras (abyss only)
  if (layout.extras) {
    if (four_star_checkbox.checked) ctx.drawImage(assets.four_star, 0, 0);
    if (question_checkbox.checked)  ctx.drawImage(assets.question,  0, 0);
    if (epic_fail_checkbox.checked) ctx.drawImage(assets.epic_fail, 0, 0);
  }
}

// --- Event listeners ---
abyss_label_first.addEventListener("input",  () => draw_thumbnail());
abyss_label_second.addEventListener("input", () => draw_thumbnail());

abyss_label_distance.addEventListener("input", () => {
  abyss_label_distance_value.textContent = abyss_label_distance.value;
  draw_thumbnail();
});
label_shift.addEventListener("input", () => {
  label_shift_value.textContent = label_shift.value;
  draw_thumbnail();
});
background_blend.addEventListener("input", () => {
  background_blend_value.textContent = background_blend.value;
  draw_thumbnail();
});

four_star_checkbox.addEventListener("input", () => draw_thumbnail());
question_checkbox.addEventListener("input",  () => draw_thumbnail());
epic_fail_checkbox.addEventListener("input", () => draw_thumbnail());

// --- Character inputs ---
const character_inputs = {};
const character_slots = document.getElementById("character_slots");

function build_character_inputs(name) {
  const row = document.createElement("div");
  row.className = "row g-2";
  row.dataset.mode = name;

  let group_index = 0;
  for (const group of MODES[name].groups) {
    const column = document.createElement("div");
    column.className = "col";
    if (name === "stygian") {
      column.dataset.styTeam = group_index + 1;
    }
    group_index++;

    const title = document.createElement("div");
    title.className = "small text-muted mb-1";
    title.textContent = group.title;
    column.append(title);

    for (const slot of group.slots) {
      const input = document.createElement("input");
      input.className = "form-control form-control-sm mb-1";
      input.placeholder = slot.placeholder;
      column.append(input);
      character_inputs[slot.key] = input;
    }

    row.append(column);
  }

  character_slots.append(row);
}

for (const name in MODES) {
  build_background_inputs(name);
  build_character_inputs(name);
}

for (const key in character_inputs) {
  new Awesomplete(character_inputs[key], { autoFirst: true, list: assets.chars.chars });
}

function handle_char(name) {
  const actual_value = character_inputs[name].value.toLowerCase();
  if (chars_map.has(actual_value)) {
    characters[name] = new Image;
    characters[name].onload = function () { draw_thumbnail(); };
    characters[name].src = chars_map.get(actual_value);
  } else {
    characters[name] = undefined;
    draw_thumbnail();
  }
}

function setup_input(name) {
  character_inputs[name].addEventListener("input", () => handle_char(name));
  character_inputs[name].addEventListener('awesomplete-selectcomplete', () => handle_char(name));
}

for (const key in character_inputs) { setup_input(key); }

// --- Mode switching ---
function set_mode(next) {
  const current = label_state[mode];
  current.first = abyss_label_first.value;
  current.second = abyss_label_second.value;
  current.distance = abyss_label_distance.value;
  current.shift = label_shift.value;

  mode = next;

  const restored = label_state[mode];
  abyss_label_first.value = restored.first;
  abyss_label_second.value = restored.second;
  abyss_label_distance.value = restored.distance;
  abyss_label_distance_value.textContent = restored.distance;
  label_shift.value = restored.shift;
  label_shift_value.textContent = restored.shift;

  background_blend.max = MODES[mode].blend_max;
  if (parseInt(background_blend.value, 10) > MODES[mode].blend_max) {
    background_blend.value = MODES[mode].blend_max;
  }
  background_blend_value.textContent = background_blend.value;

  // Show/hide mode-specific elements
  for (const element of document.querySelectorAll("[data-mode]")) {
    element.classList.toggle("d-none", element.dataset.mode !== mode);
  }

  // Show/hide custom abyss panels
  const abyssOnly = document.getElementById("abyss_custom_controls");
  if (abyssOnly) abyssOnly.classList.toggle("d-none", mode !== "abyss");

  draw_thumbnail();
}

for (const radio of document.querySelectorAll('input[name="mode"]')) {
  radio.addEventListener("change", (event) => {
    if (event.target.checked) set_mode(event.target.value);
  });
}

for (const radio of document.querySelectorAll('input[name="sty_teams"]')) {
  radio.addEventListener("change", (event) => {
    if (event.target.checked) {
      sty_teams = parseInt(event.target.value, 10);
      // Show/hide team 2 and 3 character columns
      for (const el of document.querySelectorAll("[data-sty-team]")) {
        const team = parseInt(el.dataset.styTeam, 10);
        el.classList.toggle("d-none", team > sty_teams);
      }
      draw_thumbnail();
    }
  });
}

set_mode(mode);
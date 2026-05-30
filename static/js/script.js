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
    return await res.json();
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

// Declare characters early so draw_thumbnail() can reference it
const characters = {};

// Helper: bind a range slider to its output label
function bind_range(id, redraw_fn) {
  const el = document.getElementById(id);
  const out = document.getElementById(id + "_value");
  out.textContent = el.value;
  el.addEventListener("input", () => { out.textContent = el.value; redraw_fn(); });
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

// --- Abyss label inputs ---
const abyss_label_first      = bind_text("abyss_label_first",       () => draw_thumbnail());
const abyss_label_second     = bind_text("abyss_label_second",      () => draw_thumbnail());
const abyss_label_left       = bind_text("abyss_label_left",         () => draw_thumbnail());
const abyss_label_right      = bind_text("abyss_label_right",        () => draw_thumbnail());
const bottom_font_size       = bind_range("bottom_font_size",        () => draw_thumbnail());

const abyss_fill_color       = bind_color("abyss_fill_color",       () => draw_thumbnail());
const abyss_border_color     = bind_color("abyss_border_color",     () => draw_thumbnail());
const abyss_border_width     = bind_range("abyss_border_width",     () => draw_thumbnail());

const abyss_first_font_size  = bind_range("abyss_first_font_size",  () => draw_thumbnail());
const abyss_first_x          = bind_range("abyss_first_x",          () => draw_thumbnail());
const abyss_first_y          = bind_range("abyss_first_y",          () => draw_thumbnail());

const abyss_second_font_size = bind_range("abyss_second_font_size", () => draw_thumbnail());
const abyss_second_x         = bind_range("abyss_second_x",         () => draw_thumbnail());
const abyss_second_y         = bind_range("abyss_second_y",         () => draw_thumbnail());

// --- Icon inputs ---
const abyss_icon_x           = bind_range("abyss_icon_x",           () => draw_thumbnail());
const abyss_icon_y           = bind_range("abyss_icon_y",           () => draw_thumbnail());
const abyss_icon_scale       = bind_range("abyss_icon_scale",       () => draw_thumbnail());

// --- Background inputs ---
const background_left_shift  = bind_range("background_left_shift",  () => draw_thumbnail());
const background_right_shift = bind_range("background_right_shift", () => draw_thumbnail());
const background_blend       = bind_range("background_blend",       () => draw_thumbnail());
const background_blend_value = document.getElementById("background_blend_value");

// --- Paste / file areas ---
const paste_area_left  = document.getElementById('paste_area_left');
const file_input_left  = document.getElementById('file_input_left');
const paste_area_right = document.getElementById('paste_area_right');
const file_input_right = document.getElementById('file_input_right');

let background_left;
let background_right;

paste_area_left.addEventListener('paste',   (e) => { background_left  = handle_paste(e); });
file_input_left.addEventListener('change',  (e) => { background_left  = handle_file_select(e); });
paste_area_right.addEventListener('paste',  (e) => { background_right = handle_paste(e); });
file_input_right.addEventListener('change', (e) => { background_right = handle_file_select(e); });

function handle_paste(event) {
  const clipboardData = event.clipboardData || window.clipboardData;
  if (!clipboardData) { alert('Clipboard API not supported'); return; }
  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      if (clipboardData.items[i].type.indexOf('image') !== -1) {
        const blob = clipboardData.items[i].getAsFile();
        event.preventDefault();
        return process_image_blob(blob);
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
  image.onload  = () => { URL.revokeObjectURL(imageUrl); draw_thumbnail(); };
  image.onerror = () => { alert('Error loading image'); URL.revokeObjectURL(imageUrl); };
  image.src = imageUrl;
  return image;
}

// --- Extra checkboxes ---
const four_star_checkbox = document.querySelector('#four_star');
const question_checkbox  = document.querySelector('#question');
const epic_fail_checkbox = document.querySelector('#epic_fail');
four_star_checkbox.addEventListener("input", () => draw_thumbnail());
question_checkbox.addEventListener("input",  () => draw_thumbnail());
epic_fail_checkbox.addEventListener("input", () => draw_thumbnail());

// --- Draw helpers ---
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
  ctx.fillStyle = "#888888";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const px = 633;
  const py = 98;
  const shift_left  = -parseInt(background_left_shift.value, 10);
  const shift_right = -parseInt(background_right_shift.value, 10);
  const blend = parseInt(background_blend.value, 10);
  const mid = 640;
  const h   = 720;

  if (background_left && background_right && blend > 0) {
    ctx.drawImage(background_left, px + shift_left, py, mid + blend, h, 0, 0, mid + blend, h);

    const off = document.createElement('canvas');
    off.width = blend * 2; off.height = h;
    const octx = off.getContext('2d');
    octx.drawImage(background_right, px + shift_right - blend, py, blend * 2, h, 0, 0, blend * 2, h);
    const grad = octx.createLinearGradient(0, 0, blend * 2, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    octx.globalCompositeOperation = 'destination-in';
    octx.fillStyle = grad;
    octx.fillRect(0, 0, blend * 2, h);
    ctx.drawImage(off, mid - blend, 0);

    if (background_right) {
      ctx.drawImage(background_right, px + shift_right + blend, py, mid - blend, h, mid + blend, 0, mid - blend, h);
    }
  } else {
    if (background_left)  ctx.drawImage(background_left,  px + shift_left,  py, mid, h, 0,   0, mid, h);
    if (background_right) ctx.drawImage(background_right, px + shift_right, py, mid, h, mid, 0, mid, h);
  }

  // Abyss icon
  const iconX     = parseInt(abyss_icon_x.value, 10);
  const iconY     = parseInt(abyss_icon_y.value, 10);
  const iconScale = parseInt(abyss_icon_scale.value, 10) / 100;
  ctx.drawImage(assets.abyss_12, iconX, iconY, assets.abyss_12.width * iconScale, assets.abyss_12.height * iconScale);

  // Text lines
  const fillColor   = abyss_fill_color.value;
  const borderColor = abyss_border_color.value;
  const borderWidth = parseInt(abyss_border_width.value, 10);

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
  if (left_line)  draw_text_line(left_line,  canvas.width / 4,       bottomY, parseInt(bottom_font_size.value, 10), fillColor, borderColor, borderWidth);
  if (right_line) draw_text_line(right_line, (canvas.width / 4) * 3, bottomY, parseInt(bottom_font_size.value, 10), fillColor, borderColor, borderWidth);

  // Characters
  if (characters.left1)  ctx.drawImage(characters.left1,  0, 0, characters.left1.width,  characters.left1.height,  0,    50,  200, 200);
  if (characters.left2)  ctx.drawImage(characters.left2,  0, 0, characters.left2.width,  characters.left2.height,  0,    260, 200, 200);
  if (characters.left3)  ctx.drawImage(characters.left3,  0, 0, characters.left3.width,  characters.left3.height,  0,    470, 200, 200);
  if (characters.right1) ctx.drawImage(characters.right1, 0, 0, characters.right1.width, characters.right1.height, 1080, 50,  200, 200);
  if (characters.right2) ctx.drawImage(characters.right2, 0, 0, characters.right2.width, characters.right2.height, 1080, 260, 200, 200);
  if (characters.right3) ctx.drawImage(characters.right3, 0, 0, characters.right3.width, characters.right3.height, 1080, 470, 200, 200);

  if (four_star_checkbox.checked) ctx.drawImage(assets.four_star, 0, 0);
  if (question_checkbox.checked)  ctx.drawImage(assets.question,  0, 0);
  if (epic_fail_checkbox.checked) ctx.drawImage(assets.epic_fail, 0, 0);
}

draw_thumbnail();

// --- Character inputs ---
const character_inputs = {};
character_inputs.left1  = document.getElementById('first_team1');
character_inputs.left2  = document.getElementById('first_team2');
character_inputs.left3  = document.getElementById('first_team3');
character_inputs.right1 = document.getElementById('second_team1');
character_inputs.right2 = document.getElementById('second_team2');
character_inputs.right3 = document.getElementById('second_team3');

for (const key in character_inputs) {
  new Awesomplete(character_inputs[key], { autoFirst: true, list: assets.chars.chars });
}

function handle_char(name) {
  const val = character_inputs[name].value.toLowerCase();
  if (chars_map.has(val)) {
    characters[name] = new Image();
    characters[name].onload = () => draw_thumbnail();
    characters[name].src = chars_map.get(val);
  } else {
    characters[name] = undefined;
    draw_thumbnail();
  }
}

function setup_input(name) {
  character_inputs[name].addEventListener("input", () => handle_char(name));
  character_inputs[name].addEventListener('awesomplete-selectcomplete', () => handle_char(name));
}

setup_input("left1"); setup_input("left2"); setup_input("left3");
setup_input("right1"); setup_input("right2"); setup_input("right3");

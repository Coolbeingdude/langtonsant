use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq, Debug)]
#[repr(u8)]
pub enum Direction {
    Up = 0,
    Right = 1,
    Down = 2,
    Left = 3,
}

impl Direction {
    fn from_u8(val: u8) -> Direction {
        match val % 4 {
            0 => Direction::Up,
            1 => Direction::Right,
            2 => Direction::Down,
            _ => Direction::Left,
        }
    }

    fn turn_right(self) -> Direction {
        match self {
            Direction::Up => Direction::Right,
            Direction::Right => Direction::Down,
            Direction::Down => Direction::Left,
            Direction::Left => Direction::Up,
        }
    }

    fn turn_left(self) -> Direction {
        match self {
            Direction::Up => Direction::Left,
            Direction::Left => Direction::Down,
            Direction::Down => Direction::Right,
            Direction::Right => Direction::Up,
        }
    }

    fn turn_around(self) -> Direction {
        match self {
            Direction::Up => Direction::Down,
            Direction::Down => Direction::Up,
            Direction::Left => Direction::Right,
            Direction::Right => Direction::Left,
        }
    }
}

#[derive(Clone, Copy)]
struct Ant {
    x: i32,
    y: i32,
    direction: Direction,
    init_x: i32,
    init_y: i32,
    init_dir: Direction,
}

#[derive(Clone)]
struct Snapshot {
    step: usize,
    ants: Vec<Ant>,
    cells: HashMap<(i32, i32), u8>,
}

#[wasm_bindgen]
pub struct LangtonsAnt {
    ants: Vec<Ant>,
    cells: HashMap<(i32, i32), u8>,
    rules: Vec<u8>,
    current_step: usize,
    snapshots: Vec<Snapshot>,
}

const SNAPSHOT_INTERVAL: usize = 25_000;
const MAX_SNAPSHOTS: usize = 150;
const MAX_TARGET_STEP: usize = 5_000_000;

#[wasm_bindgen]
impl LangtonsAnt {
    #[wasm_bindgen(constructor)]
    pub fn new(rule_str: &str, ant_count: usize) -> Self {
        let mut sim = Self {
            ants: Vec::new(),
            cells: HashMap::new(),
            rules: Vec::new(),
            current_step: 0,
            snapshots: Vec::new(),
        };
        sim.set_rules_internal(rule_str);
        sim.spawn_default_ants(ant_count);
        sim.reset_to_initial();
        sim
    }

    fn set_rules_internal(&mut self, rule_str: &str) {
        let valid_rules: Vec<u8> = rule_str
            .to_uppercase()
            .bytes()
            .filter(|&b| matches!(b, b'R' | b'L' | b'S' | b'U'))
            .collect();

        self.rules = if valid_rules.is_empty() {
            vec![b'R', b'L']
        } else {
            valid_rules
        };
    }

    fn spawn_default_ants(&mut self, ant_count: usize) {
        self.ants.clear();
        let count = ant_count.max(1);
        let dirs = [
            Direction::Up,
            Direction::Right,
            Direction::Down,
            Direction::Left,
        ];

        for i in 0..count {
            let offset = if i == 0 { 0 } else { ((i as i32 + 1) / 2) * 6 };
            let dir = dirs[i % 4];
            let (ox, oy) = match i % 4 {
                0 => (0, -offset),
                1 => (offset, 0),
                2 => (0, offset),
                _ => (-offset, 0),
            };

            self.ants.push(Ant {
                x: ox,
                y: oy,
                direction: dir,
                init_x: ox,
                init_y: oy,
                init_dir: dir,
            });
        }
    }

    pub fn set_rules(&mut self, rule_str: &str) {
        self.set_rules_internal(rule_str);
        self.reset_to_initial();
    }

    pub fn reset_to_initial(&mut self) {
        self.cells.clear();
        self.snapshots.clear();
        self.current_step = 0;

        for ant in &mut self.ants {
            ant.x = ant.init_x;
            ant.y = ant.init_y;
            ant.direction = ant.init_dir;
        }

        self.save_snapshot();
    }

    pub fn add_ant(&mut self, x: i32, y: i32, dir: u8) {
        let d = Direction::from_u8(dir);
        self.ants.push(Ant {
            x,
            y,
            direction: d,
            init_x: x,
            init_y: y,
            init_dir: d,
        });
        self.reset_snapshots_from_here();
    }

    pub fn update_ant(
        &mut self,
        index: usize,
        x: i32,
        y: i32,
        dir: u8,
        init_x: i32,
        init_y: i32,
        init_dir: u8,
    ) {
        if let Some(ant) = self.ants.get_mut(index) {
            ant.x = x;
            ant.y = y;
            ant.direction = Direction::from_u8(dir);
            ant.init_x = init_x;
            ant.init_y = init_y;
            ant.init_dir = Direction::from_u8(init_dir);
            self.reset_snapshots_from_here();
        }
    }

    pub fn remove_ant(&mut self, index: usize) {
        if index < self.ants.len() {
            self.ants.remove(index);
            self.reset_snapshots_from_here();
        }
    }

    pub fn clear_ants(&mut self) {
        self.ants.clear();
        self.reset_snapshots_from_here();
    }

    fn reset_snapshots_from_here(&mut self) {
        self.snapshots.retain(|s| s.step < self.current_step);
        self.save_snapshot();
    }

    fn save_snapshot(&mut self) {
        if self.snapshots.len() >= MAX_SNAPSHOTS {
            let mut thinned = Vec::with_capacity(MAX_SNAPSHOTS / 2 + 1);
            if let Some(first) = self.snapshots.first() {
                thinned.push(first.clone());
            }
            for (i, snap) in self.snapshots.iter().enumerate().skip(1) {
                if i % 2 == 0 {
                    thinned.push(snap.clone());
                }
            }
            self.snapshots = thinned;
        }

        self.snapshots.push(Snapshot {
            step: self.current_step,
            ants: self.ants.clone(),
            cells: self.cells.clone(),
        });
    }

    pub fn step(&mut self) {
        if self.ants.is_empty() {
            return;
        }
        let num_colors = self.rules.len() as u8;

        for ant in &mut self.ants {
            let pos = (ant.x, ant.y);
            let current_color = self.cells.get(&pos).copied().unwrap_or(0) % num_colors;

            match self.rules[current_color as usize] {
                b'R' => ant.direction = ant.direction.turn_right(),
                b'L' => ant.direction = ant.direction.turn_left(),
                b'U' => ant.direction = ant.direction.turn_around(),
                _ => {}
            }

            let next_color = (current_color + 1) % num_colors;
            if next_color == 0 {
                self.cells.remove(&pos);
            } else {
                self.cells.insert(pos, next_color);
            }

            match ant.direction {
                Direction::Up => ant.y -= 1,
                Direction::Down => ant.y += 1,
                Direction::Left => ant.x -= 1,
                Direction::Right => ant.x += 1,
            }
        }

        self.current_step += 1;

        if self.current_step % SNAPSHOT_INTERVAL == 0 {
            let needs_save = match self.snapshots.last() {
                Some(last) => self.current_step > last.step,
                None => true,
            };
            if needs_save {
                self.save_snapshot();
            }
        }
    }

    pub fn step_many(&mut self, steps: usize) {
        for _ in 0..steps {
            self.step();
        }
    }

    pub fn seek_to_step(&mut self, target_step: usize) {
        let safe_target = target_step.min(MAX_TARGET_STEP);
        if safe_target == self.current_step {
            return;
        }

        if let Some(snap) = self
            .snapshots
            .iter()
            .rev()
            .find(|s| s.step <= safe_target)
            .cloned()
        {
            if safe_target < self.current_step || snap.step > self.current_step {
                self.current_step = snap.step;
                self.ants = snap.ants;
                self.cells = snap.cells;
            }
        }

        while self.current_step < safe_target {
            self.step();
        }
    }
    pub fn current_step(&self) -> usize {
        self.current_step
    }

    pub fn active_cell_count(&self) -> usize {
        self.cells.len()
    }

    pub fn render_viewport(
        &self,
        canvas_w: usize,
        canvas_h: usize,
        cam_x: f64,
        cam_y: f64,
        cell_size: f64,
        palette_rgba: &[u8],
    ) -> Vec<u8> {
        let mut buf = vec![255u8; canvas_w * canvas_h * 4];
        let half_w = canvas_w as f64 / 2.0;
        let half_h = canvas_h as f64 / 2.0;

        if cell_size >= 1.0 {
            let min_x = (cam_x - half_w / cell_size).floor() as i32;
            let max_x = (cam_x + half_w / cell_size).ceil() as i32;
            let min_y = (cam_y - half_h / cell_size).floor() as i32;
            let max_y = (cam_y + half_h / cell_size).ceil() as i32;
            let draw_size = cell_size.ceil() as i32;

            for cy in min_y..=max_y {
                let sy = ((cy as f64 - cam_y) * cell_size + half_h).floor() as i32;
                let y_start = sy.max(0);
                let y_end = (sy + draw_size).min(canvas_h as i32);
                if y_start >= y_end {
                    continue;
                }

                for cx in min_x..=max_x {
                    let Some(&color_idx) = self.cells.get(&(cx, cy)) else {
                        continue;
                    };
                    let p_idx = (color_idx as usize) * 4;
                    if p_idx + 3 >= palette_rgba.len() {
                        continue;
                    }

                    let sx = ((cx as f64 - cam_x) * cell_size + half_w).floor() as i32;
                    let x_start = sx.max(0);
                    let x_end = (sx + draw_size).min(canvas_w as i32);
                    if x_start >= x_end {
                        continue;
                    }

                    let r = palette_rgba[p_idx];
                    let g = palette_rgba[p_idx + 1];
                    let b = palette_rgba[p_idx + 2];

                    for py in y_start..y_end {
                        let row_offset = (py as usize) * canvas_w;
                        for px in x_start..x_end {
                            let idx = (row_offset + (px as usize)) * 4;
                            buf[idx] = r;
                            buf[idx + 1] = g;
                            buf[idx + 2] = b;
                        }
                    }
                }
            }
        } else {
            let inv_cell = 1.0 / cell_size;
            for py in 0..canvas_h {
                let wy = (cam_y + (py as f64 - half_h) * inv_cell).floor() as i32;
                let row_offset = py * canvas_w;

                for px in 0..canvas_w {
                    let wx = (cam_x + (px as f64 - half_w) * inv_cell).floor() as i32;
                    if let Some(&color_idx) = self.cells.get(&(wx, wy)) {
                        let p_idx = (color_idx as usize) * 4;
                        if p_idx + 3 < palette_rgba.len() {
                            let idx = (row_offset + px) * 4;
                            buf[idx] = palette_rgba[p_idx];
                            buf[idx + 1] = palette_rgba[p_idx + 1];
                            buf[idx + 2] = palette_rgba[p_idx + 2];
                        }
                    }
                }
            }
        }

        buf
    }

    pub fn ant_details(&self) -> Vec<i32> {
        let mut out = Vec::with_capacity(self.ants.len() * 6);
        for ant in &self.ants {
            out.push(ant.x);
            out.push(ant.y);
            out.push(ant.direction as i32);
            out.push(ant.init_x);
            out.push(ant.init_y);
            out.push(ant.init_dir as i32);
        }
        out
    }
}

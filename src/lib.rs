use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Direction {
    Up,
    Right,
    Down,
    Left,
}

impl Direction {
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
}

#[derive(Clone)]
struct Snapshot {
    step: usize,
    ants: Vec<Ant>,
    grid: Vec<u8>,
}

#[wasm_bindgen]
pub struct LangtonsAnt {
    ants: Vec<Ant>,
    width: usize,
    height: usize,
    grid: Vec<u8>,
    rules: Vec<u8>,
    current_step: usize,
    snapshots: Vec<Snapshot>,
}

const SNAPSHOT_INTERVAL: usize = 2000;

#[wasm_bindgen]
impl LangtonsAnt {
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize, rule_str: &str, ant_count: usize) -> Self {
        let mut sim = Self {
            ants: Vec::new(),
            width,
            height,
            grid: vec![0; width * height],
            rules: Vec::new(),
            current_step: 0,
            snapshots: Vec::new(),
        };
        sim.set_config(rule_str, ant_count);
        sim
    }

    pub fn set_config(&mut self, rule_str: &str, ant_count: usize) {
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

        self.reset(ant_count);
    }

    pub fn reset(&mut self, ant_count: usize) {
        self.grid.fill(0);
        self.ants.clear();
        self.snapshots.clear();
        self.current_step = 0;

        let count = ant_count.max(1);
        let cx = (self.width / 2) as i32;
        let cy = (self.height / 2) as i32;
        let dirs = [
            Direction::Up,
            Direction::Right,
            Direction::Down,
            Direction::Left,
        ];

        for i in 0..count {
            let offset = if i == 0 { 0 } else { ((i as i32 + 1) / 2) * 6 };
            let angle_dir = dirs[i % 4];
            let (ox, oy) = match i % 4 {
                0 => (0, -offset),
                1 => (offset, 0),
                2 => (0, offset),
                _ => (-offset, 0),
            };

            self.ants.push(Ant {
                x: (cx + ox).rem_euclid(self.width as i32),
                y: (cy + oy).rem_euclid(self.height as i32),
                direction: angle_dir,
            });
        }

        self.save_snapshot();
    }

    fn save_snapshot(&mut self) {
        self.snapshots.push(Snapshot {
            step: self.current_step,
            ants: self.ants.clone(),
            grid: self.grid.clone(),
        });
    }

    pub fn step(&mut self) {
        let num_colors = self.rules.len() as u8;

        for ant in &mut self.ants {
            let idx = (ant.y as usize) * self.width + (ant.x as usize);
            let current_color = self.grid[idx] % num_colors;

            match self.rules[current_color as usize] {
                b'R' => ant.direction = ant.direction.turn_right(),
                b'L' => ant.direction = ant.direction.turn_left(),
                b'U' => ant.direction = ant.direction.turn_around(),
                _ => {}
            }

            self.grid[idx] = (current_color + 1) % num_colors;

            match ant.direction {
                Direction::Up => ant.y -= 1,
                Direction::Down => ant.y += 1,
                Direction::Left => ant.x -= 1,
                Direction::Right => ant.x += 1,
            }

            ant.x = ant.x.rem_euclid(self.width as i32);
            ant.y = ant.y.rem_euclid(self.height as i32);
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
        if target_step == self.current_step {
            return;
        }

        if let Some(snap) = self
            .snapshots
            .iter()
            .rev()
            .find(|s| s.step <= target_step)
            .cloned()
        {
            if target_step < self.current_step || snap.step > self.current_step {
                self.current_step = snap.step;
                self.ants = snap.ants;
                self.grid = snap.grid;
            }
        }

        while self.current_step < target_step {
            self.step();
        }
    }

    pub fn current_step(&self) -> usize {
        self.current_step
    }

    pub fn grid_bytes(&self) -> Vec<u8> {
        self.grid.clone()
    }

    pub fn ant_positions(&self) -> Vec<i32> {
        let mut coords = Vec::with_capacity(self.ants.len() * 2);
        for ant in &self.ants {
            coords.push(ant.x);
            coords.push(ant.y);
        }
        coords
    }
}

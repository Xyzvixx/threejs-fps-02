function mulberry32(seed) {
  let value = seed >>> 0;

  return function rng() {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createPlant() {
  return {
    status: 'none',
    site: null,
    progress: 0,
    fuse: 0,
    planter: null,
    defuser: null,
  };
}

function createStats() {
  return {
    shots: 0,
    hits: 0,
    headshots: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    roundsWon: 0,
  };
}

export function createMatch(seed) {
  const S = {
    seed,
    rng: mulberry32(seed),
    time: 0,
    phase: 'menu',
    round: 1,
    score: { emb: 0, ash: 0 },
    timer: 100,
    buyTimer: 15,
    money: 800,
    lossStreak: 0,
    buyOpen: false,
    entities: [],
    player: null,
    plant: createPlant(),
    feed: [],
    stats: createStats(),
    events: [],
    logEvent(type, data = {}) {
      S.events.push({ ...data, type, t: S.time });
      if (S.events.length > 200) {
        S.events.splice(0, S.events.length - 200);
      }
    },
    addFeed(text, kind = 'kill') {
      S.pruneFeed();
      S.feed.push({ text, t: S.time, kind });
      if (S.feed.length > 5) {
        S.feed.splice(0, S.feed.length - 5);
      }
    },
    pruneFeed() {
      let writeIndex = 0;
      for (let readIndex = 0; readIndex < S.feed.length; readIndex += 1) {
        const entry = S.feed[readIndex];
        if (S.time - entry.t < 5) {
          S.feed[writeIndex] = entry;
          writeIndex += 1;
        }
      }
      S.feed.length = writeIndex;
    },
    resetRound() {
      S.timer = 100;
      S.plant = createPlant();
    },
    resetMatch() {
      S.time = 0;
      S.phase = 'menu';
      S.round = 1;
      S.score = { emb: 0, ash: 0 };
      S.timer = 100;
      S.buyTimer = 15;
      S.money = 800;
      S.lossStreak = 0;
      S.buyOpen = false;
      S.entities = [];
      S.player = null;
      S.plant = createPlant();
      S.feed = [];
      S.stats = createStats();
      S.events = [];
      S.rng = mulberry32(S.seed);
    },
  };

  return S;
}

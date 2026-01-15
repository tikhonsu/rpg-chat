"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type WearMode = "ON" | "OFF";
type Universe = "CLASSIC_FANTASY" | "DARK_FANTASY" | "ANIME_ISEKAI" | "CANON" | "CUSTOM";
type CanonMode = "A_STORYLIKE" | "B_WORLDONLY";

type Rarity = "⚪" | "🟢" | "🔵" | "🟣" | "🟠" | "🔴";
type DamageIcon = "🗡️" | "🪓" | "🪛" | "🏹" | "🔫" | "💥" | "🧲" | "🔥" | "❄️" | "⚡" | "🌪️" | "🌍" | "💧" | "☀️" | "🌑" | "🧪";
type EffectIcon = "🩸" | "☠️" | "🔥" | "❄️" | "⚡" | "🌪️" | "🧿" | "💚" | "🛡️" | "✨" | "👁️" | "🕳️" | "🧯";

type ItemType = "weapon" | "armor" | "accessory" | "consumable" | "material" | "quest";

type Stats = { str: number; dex: number; end: number; int: number; cha: number; luck: number };

type Item = {
  id: string;
  rarity: Rarity;
  name: string;
  type: ItemType;
  weight: number;
  slots: 1 | 2 | 3;
  qty?: number;
  tags?: string[];
  notes?: string;
};

type Equipped = {
  weapon1?: (Item & { dmgMin?: number; dmgMax?: number; dmgIcons?: DamageIcon[]; reqStr?: number; reqDex?: number });
  armor?: (Item & { defense?: number; bonuses?: Partial<Stats>; penalties?: Partial<Stats> });
  accessories: Array<Item & { bonuses?: Partial<Stats> }>;
  durability?: Record<string, { cur: number; max: number }>;
};

type Effect = { icon: EffectIcon; name: string; turnsLeft: number };

type Enemy = {
  name: string;
  hpCur: number;
  hpMax: number;
  evasion: number;
  defense: number;
  weak?: DamageIcon;
  resist?: DamageIcon;
  attackIcons: DamageIcon[];
  dmgMin: number;
  dmgMax: number;
};

type GamePhase =
  | "SETTINGS"
  | "CANON_MODE"
  | "CUSTOM_RULES"
  | "CHAR_SEX"
  | "CHAR_NAME"
  | "CHAR_RACE"
  | "CHAR_CLASS"
  | "CHAR_BG"
  | "PLAY";

type GameState = {
  version: number;
  phase: GamePhase;
  wear: WearMode;
  universe: Universe | null;
  canonTitle?: string;
  canonMode?: CanonMode;
  customRules?: string;

  day: number;
  hour: number;
  weather: string;
  location: string;
  journalPath: string;

  node: "HUB" | "BOARD" | "WHISPER" | "CHECK" | "ROAD";

  sex?: string;
  name?: string;
  race?: { id: string; name: string; desc: string; bonuses: Partial<Stats>; weakness: string; worldImpact: string };
  cls?: { id: string; name: string; desc: string; bonuses: Partial<Stats>; weakness: string; worldImpact: string };
  bg?: { id: string; name: string; desc: string; bonus: Partial<Stats>; perk: string };

  level: number;
  xp: number;
  xpToNext: number;

  hpCur: number;
  hpMax: number;
  mpCur: number;
  mpMax: number;

  stats: Stats;
  equipped: Equipped;
  backpack: Item[];
  money: number;

  effects: Effect[];
  lootJournal: string[];
  log: Array<{ role: "system" | "player"; text: string }>;

  enemy?: Enemy;
};

const LS_KEY = "rpg_chat_mvp_v1";
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const chanceCheck = () => Math.floor(Math.random() * 100) + 1;

function sumWeight(items: Item[]) { return items.reduce((acc, it) => acc + it.weight * (it.qty ?? 1), 0); }
function sumSlots(items: Item[]) { return items.reduce((acc, it) => acc + it.slots * (it.qty ?? 1), 0); }

function computeXpToNext(level: number) {
  if (level <= 1) return 300;
  let t = 300;
  for (let lv = 1; lv < level; lv++) t = t * 1.2;
  return Math.round(t / 10) * 10;
}

function applyBonuses(stats: Stats, bonuses?: Partial<Stats>, penalties?: Partial<Stats>): Stats {
  const s = { ...stats };
  for (const [k,v] of Object.entries(bonuses ?? {})) (s as any)[k] += v as number;
  for (const [k,v] of Object.entries(penalties ?? {})) (s as any)[k] -= v as number;
  return {
    str: Math.max(1, s.str),
    dex: Math.max(1, s.dex),
    end: Math.max(1, s.end),
    int: Math.max(1, s.int),
    cha: Math.max(1, s.cha),
    luck: Math.max(1, s.luck),
  };
}

function baseUniverseTitle(u: Universe | null, canonTitle?: string) {
  if (!u) return "—";
  if (u === "CLASSIC_FANTASY") return "Классическое фэнтези";
  if (u === "DARK_FANTASY") return "Тёмное фэнтези";
  if (u === "ANIME_ISEKAI") return "Аниме-исэкай";
  if (u === "CANON") return `Канон: ${canonTitle ?? "без названия"}`;
  return "Своя вселенная";
}

function baseCurrency(u: Universe | null) {
  if (!u) return "¤";
  if (u === "CLASSIC_FANTASY") return "⛁ золото";
  if (u === "DARK_FANTASY") return "⛁ кроны";
  if (u === "ANIME_ISEKAI") return "✦ кредиты гильдий";
  return "¤ валюта";
}

function safeHub(u: Universe | null) {
  if (!u) return "—";
  if (u === "CLASSIC_FANTASY") return "Трактир «Три Факела»";
  if (u === "DARK_FANTASY") return "Постоялый двор «Глухой Колокол»";
  if (u === "ANIME_ISEKAI") return "Гильдия «Седьмой Клинок»";
  return "Безопасная точка";
}

const RACES = [
  { id: "r1", name: "Человек", desc: "Гибкий старт и связи", bonuses: { cha: 1, luck: 1 }, weakness: "-1 к Инт при маг. проверках", worldImpact: "легче договариваться" },
  { id: "r2", name: "Эльф", desc: "Точность и слух", bonuses: { dex: 2, int: 1 }, weakness: "+10% штраф от тяжёлой брони", worldImpact: "уважение магов" },
  { id: "r3", name: "Дворф", desc: "Стойкость и ремесло", bonuses: { end: 2, str: 1 }, weakness: "-5% к уклонению", worldImpact: "лучше ремонт" },
  { id: "r4", name: "Полуорк", desc: "Сила и нажим", bonuses: { str: 3 }, weakness: "-1 к Харизме", worldImpact: "часть NPC насторожены" },
  { id: "r5", name: "Тифлинг", desc: "Тьма и сделки", bonuses: { int: 2, cha: 1 }, weakness: "☀️ свет больнее (+20%)", worldImpact: "культы узнают" },
  { id: "r6", name: "Гном", desc: "Инженерия и ловушки", bonuses: { int: 2, dex: 1 }, weakness: "-1 к Силе", worldImpact: "механизмы проще" },
  { id: "r7", name: "Халфлинг", desc: "Удача и скрытность", bonuses: { luck: 2, dex: 1 }, weakness: "-1 к Выносливости", worldImpact: "легче уйти от засад" },
  { id: "r8", name: "Зверолюд", desc: "Инстинкт и рывок", bonuses: { dex: 2, end: 1 }, weakness: "-1 к Харизме", worldImpact: "охота/следы" },
  { id: "r9", name: "Астральный странник", desc: "Мана и видение", bonuses: { int: 3 }, weakness: "-1 к Выносливости", worldImpact: "видите следы магии" },
  { id: "r10", name: "Синтетик", desc: "Броня и стабильность", bonuses: { end: 2, str: 1 }, weakness: "реген MP -20%", worldImpact: "тех-торг" },
  { id: "r11", name: "Нежить", desc: "Проклятая стойкость", bonuses: { end: 2, int: 1 }, weakness: "лечение -20%", worldImpact: "охотники рядом" },
  { id: "r12", name: "Драконорожденный", desc: "Стихии и сила", bonuses: { str: 2, end: 1 }, weakness: "🧪 яд/кислота больнее", worldImpact: "уважение воинов" },
  { id: "r13", name: "Фейри", desc: "Чары и лёгкость", bonuses: { dex: 2, cha: 1 }, weakness: "🧲 подавление чар", worldImpact: "фейские сделки" },
  { id: "r14", name: "Пустотник", desc: "Тьма и метка", bonuses: { luck: 1, int: 2 }, weakness: "☀️ свет больнее", worldImpact: "аномалии реагируют" },
  { id: "r15", name: "Кибер-адапт", desc: "Импланты и скорость", bonuses: { dex: 2, int: 1 }, weakness: "🧲 EMP больнее", worldImpact: "тех-зоны свои" },
] as const;

const CLASSES = [
  { id: "c1", name: "Воин", desc: "Надёжный ближний бой", bonuses: { str: 2, end: 1 }, weakness: "-1 к Интеллекту", worldImpact: "уважение наёмников" },
  { id: "c2", name: "Разбойник", desc: "Скрытность и крит", bonuses: { dex: 2, luck: 1 }, weakness: "-1 к Выносливости", worldImpact: "чёрный рынок" },
  { id: "c3", name: "Маг", desc: "Контроль и урон", bonuses: { int: 3 }, weakness: "-1 к Выносливости", worldImpact: "маг-фракции" },
  { id: "c4", name: "Паладин", desc: "Щиты и свет", bonuses: { end: 2, cha: 1 }, weakness: "-1 к Удаче", worldImpact: "доверие" },
  { id: "c5", name: "Охотник", desc: "Дальний бой", bonuses: { dex: 2, end: 1 }, weakness: "-1 к Харизме", worldImpact: "тропы" },
  { id: "c6", name: "Берсерк", desc: "Взрывной урон", bonuses: { str: 3 }, weakness: "-1 к Харизме", worldImpact: "страх" },
  { id: "c7", name: "Алхимик", desc: "Зелья и баффы", bonuses: { int: 2, luck: 1 }, weakness: "-1 к Силе", worldImpact: "рецепты" },
  { id: "c8", name: "Инквизитор", desc: "Метки и контр-магия", bonuses: { cha: 2, int: 1 }, weakness: "-1 к Ловкости", worldImpact: "культы злятся" },
  { id: "c9", name: "Техник", desc: "Гаджеты и модули", bonuses: { int: 2, dex: 1 }, weakness: "-1 к Харизме", worldImpact: "тех-лут" },
  { id: "c10", name: "Дуелянт", desc: "Контратаки", bonuses: { dex: 2, cha: 1 }, weakness: "-1 к Выносливости", worldImpact: "дуэли" },
  { id: "c11", name: "Шаман", desc: "Духи и стихии", bonuses: { int: 2, end: 1 }, weakness: "-1 к Харизме", worldImpact: "подсказки духов" },
  { id: "c12", name: "Некромант", desc: "Тьма и контроль", bonuses: { int: 2, luck: 1 }, weakness: "☀️ свет больнее", worldImpact: "охотники рядом" },
  { id: "c13", name: "Монах", desc: "Уклонение", bonuses: { dex: 2, end: 1 }, weakness: "-1 к Интеллекту", worldImpact: "храмы" },
  { id: "c14", name: "Бард", desc: "Баффы и торг", bonuses: { cha: 3 }, weakness: "-1 к Силе", worldImpact: "союзники" },
  { id: "c15", name: "Страж", desc: "Танк и стойка", bonuses: { end: 3 }, weakness: "-1 к Ловкости", worldImpact: "городская служба" },
] as const;

const BACKGROUNDS = [
  { id: "b1", name: "Сирота дорог", desc: "Выживание на трактах", bonus: { luck: 1 }, perk: "Раз в день: +10 к следующей проверке" },
  { id: "b2", name: "Ученик мастера", desc: "Ремесло и железо", bonus: { end: 1 }, perk: "+5% к торгу за ремонт" },
  { id: "b3", name: "Бывший страж", desc: "Дисциплина", bonus: { str: 1 }, perk: "+1 🧱ЗАЩ в первом бою дня" },
  { id: "b4", name: "Книжник", desc: "Знаки и тексты", bonus: { int: 1 }, perk: "Иногда подсказки в сценах" },
  { id: "b5", name: "Шулер", desc: "Читаете людей", bonus: { cha: 1 }, perk: "+5% к торгу" },
  { id: "b6", name: "Трофейщик", desc: "Следы и добыча", bonus: { dex: 1 }, perk: "+1 шанс на редкий лут" },
] as const;

function makeInitialState(): GameState {
  return {
    version: 1,
    phase: "SETTINGS",
    wear: "OFF",
    universe: null,
    node: "HUB",

    day: 1,
    hour: 8,
    weather: "Ясно",
    location: "—",
    journalPath: "—",

    level: 1,
    xp: 0,
    xpToNext: 300,

    hpCur: 30,
    hpMax: 30,
    mpCur: 15,
    mpMax: 15,

    stats: { str: 3, dex: 3, end: 3, int: 3, cha: 3, luck: 3 },

    equipped: { accessories: [] },
    backpack: [],
    money: 0,

    effects: [],
    lootJournal: [],
    log: [{ role: "system", text: "Игра готова. Выберите настройки старта (износ + вселенная)." }],
  };
}

function serialize(state: GameState) { return JSON.stringify(state); }
function deserialize(raw: string): GameState | null {
  try {
    const obj = JSON.parse(raw) as GameState;
    if (obj?.version !== 1) return null;
    return obj;
  } catch { return null; }
}

function fmtBonus(b: Partial<Stats>) {
  const parts: string[] = [];
  if (b.str) parts.push(`💪+${b.str}`);
  if (b.dex) parts.push(`🎯+${b.dex}`);
  if (b.end) parts.push(`🛡️+${b.end}`);
  if (b.int) parts.push(`🧠+${b.int}`);
  if (b.cha) parts.push(`🗣️+${b.cha}`);
  if (b.luck) parts.push(`🍀+${b.luck}`);
  return parts.length ? parts.join(" ") : "—";
}

function addLog(state: GameState, role: "system" | "player", text: string) {
  state.log = [...state.log, { role, text }];
}

function nextHour(state: GameState) {
  state.hour += 1;
  if (state.hour >= 24) { state.hour = 0; state.day += 1; }
}

function maybeWeather(state: GameState) {
  const n = chanceCheck();
  if (n <= 10) state.weather = "Морось";
  else if (n <= 20) state.weather = "Ветер";
  else if (n <= 25) state.weather = "Туман";
  else state.weather = "Ясно";
}

function startCombat(state: GameState) {
  const u = state.universe!;
  if (u === "DARK_FANTASY") {
    state.enemy = { name: "Кривозубый падальщик", hpCur: 26, hpMax: 26, evasion: 8, defense: 3, weak: "🔥", resist: "🌑", attackIcons: ["🪓"], dmgMin: 5, dmgMax: 9 };
  } else if (u === "ANIME_ISEKAI") {
    state.enemy = { name: "Слизень ранга E", hpCur: 22, hpMax: 22, evasion: 6, defense: 2, weak: "❄️", resist: "🪛", attackIcons: ["🧪"], dmgMin: 4, dmgMax: 8 };
  } else {
    state.enemy = { name: "Дорожный бандит", hpCur: 24, hpMax: 24, evasion: 7, defense: 2, weak: "🪛", resist: "🪓", attackIcons: ["🗡️"], dmgMin: 5, dmgMax: 9 };
  }
}

function buildScene(state: GameState) {
  if (state.enemy) {
    return {
      text:
        `Перед вами ${state.enemy.name} — шаги звучат слишком близко. ` +
        `Секунда тянется, и вы чувствуете, что сейчас решает один ход. ` +
        `В воздухе пахнет металлом и сыростью.`,
      choices: [
        { id: "1" as const, icon: "⚔" as const, label: "Атака оружием" },
        { id: "2" as const, icon: "🛡" as const, label: "Осторожная стойка" },
        { id: "3" as const, icon: "✦" as const, label: "Расходник / умение" },
        { id: "4" as const, icon: "◦" as const, label: "Свой вариант (описать)" },
      ],
    };
  }

  const hub = safeHub(state.universe);
  const txt =
    `(${baseUniverseTitle(state.universe, state.canonTitle)}) ${state.weather}. ` +
    `Вы у входа в ${hub}. ` +
    `На доске объявлений свежая записка, рядом скомканная карта с пометкой “опасно”. ` +
    `Кто-то шепчет про “странный след” в двух часах пути и обещает награду. ` +
    `Первый шаг задаст тон всей истории.`;

  return {
    text: txt,
    choices: [
      { id: "1" as const, icon: "◦" as const, label: "Читать доску объявлений" },
      { id: "2" as const, icon: "◦" as const, label: "Поговорить с тем, кто шепчет" },
      { id: "3" as const, icon: "◦" as const, label: "Проверить экипировку/инвентарь" },
      { id: "4" as const, icon: "◦" as const, label: "Свой вариант (описать)" },
    ],
  };
}

function useCommand(state: GameState, input: string) {
  const cmd = input.trim();
  if (!cmd.startsWith("/")) return false;

  addLog(state, "player", cmd);

  if (cmd === "/помощь") {
    addLog(state, "system", "Команды: /статы /экип /инвентарь /настройки /помощь");
    return true;
  }
  if (cmd === "/статы") {
    addLog(state, "system", `💪 ${state.stats.str} 🎯 ${state.stats.dex} 🛡️ ${state.stats.end} 🧠 ${state.stats.int} 🗣️ ${state.stats.cha} 🍀 ${state.stats.luck}`);
    return true;
  }
  if (cmd === "/инвентарь") {
    if (!state.backpack.length) addLog(state, "system", "Рюкзак пуст.");
    else addLog(state, "system", state.backpack.map(it => `— ${it.rarity} ${it.name}${it.qty ? ` x${it.qty}` : ""} (${it.weight}кг, слоты ${it.slots})`).join("\n"));
    return true;
  }
  if (cmd === "/экип") {
    addLog(state, "system", `Оружие: ${state.equipped.weapon1?.rarity ?? ""} ${state.equipped.weapon1?.name ?? "—"}\nБроня: ${state.equipped.armor?.rarity ?? ""} ${state.equipped.armor?.name ?? "—"}`);
    return true;
  }
  if (cmd === "/настройки") {
    addLog(state, "system", `Износ: ${state.wear === "ON" ? "✅ ВКЛ" : "❌ ВЫКЛ"}\nВселенная: ${baseUniverseTitle(state.universe, state.canonTitle)}`);
    return true;
  }

  addLog(state, "system", "Неизвестная команда. /помощь");
  return true;
}

export default function Page() {
  const [state, setState] = useState<GameState>(() => makeInitialState());
  const [input, setInput] = useState("");
  const [racePage, setRacePage] = useState(0);
  const [classPage, setClassPage] = useState(0);
  const logRef = useRef<HTMLDivElement | null>(null);

  const currency = useMemo(() => baseCurrency(state.universe), [state.universe]);
  const showHud = state.phase === "PLAY";
  const slotsUsed = sumSlots(state.backpack);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [state.log.length]);

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const loaded = deserialize(raw);
    if (loaded) setState(loaded);
  }, []);

  useEffect(() => { localStorage.setItem(LS_KEY, serialize(state)); }, [state]);

  const scene = useMemo(() => (state.phase === "PLAY" ? buildScene(state) : null), [state]);

  function hardReset() {
    localStorage.removeItem(LS_KEY);
    setState(makeInitialState());
    setInput("");
    setRacePage(0);
    setClassPage(0);
  }

  function setWear(w: WearMode) {
    setState(prev => {
      const s = structuredClone(prev);
      s.wear = w;
      addLog(s, "player", `A) Износ: ${w === "ON" ? "✅ ВКЛ" : "❌ ВЫКЛ"}`);
      return s;
    });
  }

  function setUniverse(u: Universe) {
    setState(prev => {
      const s = structuredClone(prev);
      s.universe = u;
      addLog(s, "player", `B) Вселенная: ${baseUniverseTitle(u)}`);
      if (u === "CANON") s.phase = "CANON_MODE";
      else if (u === "CUSTOM") s.phase = "CUSTOM_RULES";
      else s.phase = "CHAR_SEX";
      return s;
    });
  }

  function setCanon(title: string, mode: CanonMode) {
    setState(prev => {
      const s = structuredClone(prev);
      s.canonTitle = title.trim() || "Без названия";
      s.canonMode = mode;
      s.phase = "CHAR_SEX";
      addLog(s, "player", `Канон: ${s.canonTitle} | Режим: ${mode === "A_STORYLIKE" ? "A" : "B"}`);
      return s;
    });
  }

  function setCustomRulesText(text: string) {
    setState(prev => {
      const s = structuredClone(prev);
      s.customRules = text.trim();
      s.phase = "CHAR_SEX";
      addLog(s, "player", `Правила мира: ${s.customRules}`);
      return s;
    });
  }

  function setSex(v: string) {
    setState(prev => {
      const s = structuredClone(prev);
      s.sex = v;
      s.phase = "CHAR_NAME";
      addLog(s, "player", `Пол: ${v}`);
      return s;
    });
  }

  function setName(v: string) {
    setState(prev => {
      const s = structuredClone(prev);
      s.name = v.trim() || "Безымянный";
      s.phase = "CHAR_RACE";
      addLog(s, "player", `Имя: ${s.name}`);
      return s;
    });
  }

  function chooseRace(id: string) {
    setState(prev => {
      const s = structuredClone(prev);
      const r = RACES.find(x => x.id === id)!;
      s.race = r;
      s.phase = "CHAR_CLASS";
      addLog(s, "player", `Раса: ${r.name}`);
      return s;
    });
  }

  function chooseClass(id: string) {
    setState(prev => {
      const s = structuredClone(prev);
      const c = CLASSES.find(x => x.id === id)!;
      s.cls = c;
      s.phase = "CHAR_BG";
      addLog(s, "player", `Класс: ${c.name}`);
      return s;
    });
  }

  function chooseBg(id: string) {
    setState(prev => {
      const s = structuredClone(prev);
      const bg = BACKGROUNDS.find(x => x.id === id)!;
      s.bg = bg;

      let base: Stats = { str: 3, dex: 3, end: 3, int: 3, cha: 3, luck: 3 };
      base = applyBonuses(base, s.race?.bonuses);
      base = applyBonuses(base, s.cls?.bonuses);
      base = applyBonuses(base, bg.bonus);
      s.stats = base;

      s.hpMax = 28 + s.stats.end * 4;
      s.hpCur = s.hpMax;
      s.mpMax = 12 + s.stats.int * 3;
      s.mpCur = s.mpMax;

      s.location = safeHub(s.universe);
      s.journalPath = `Старт → ${s.location}`;

      // starter gear minimal
      s.money = 40;
      s.equipped.weapon1 = { id: "w_dagger", rarity: "⚪", name: "Кинжал путника", type: "weapon", weight: 0.8, slots: 1, dmgMin: 6, dmgMax: 10, dmgIcons: ["🪛"], reqDex: 3 };
      s.equipped.armor = { id: "a_tunic", rarity: "⚪", name: "Кожаная куртка", type: "armor", weight: 4.5, slots: 2, defense: 2 };
      s.backpack = [{ id: "c_potion", rarity: "⚪", name: "Зелье лечения", type: "consumable", weight: 0.3, slots: 1, qty: 2 }];

      s.lootJournal = [
        `[День ${s.day}, ${String(s.hour).padStart(2, "0")}:00] + ⚪ Кинжал путника — старт`,
        `[День ${s.day}, ${String(s.hour).padStart(2, "0")}:00] + ⚪ Кожаная куртка — старт`,
        `[День ${s.day}, ${String(s.hour).padStart(2, "0")}:00] + ⚪ Зелье лечения x2 — старт`,
      ];

      s.phase = "PLAY";
      addLog(s, "player", `Предыстория: ${bg.name}`);
      addLog(s, "system", "Персонаж создан. Игра началась.");
      return s;
    });
  }

  function handleChoice(id: "1" | "2" | "3" | "4", customText?: string) {
    setState(prev => {
      const s = structuredClone(prev);
      if (s.phase !== "PLAY") return s;

      addLog(s, "player", customText ? `4) ◦ ${customText}` : `${id})`);

      nextHour(s);
      maybeWeather(s);

      if (s.enemy) {
        // MVP combat: only "start" and resolve quickly
        if (id === "1") {
          const roll = chanceCheck();
          const hitChance = 60;
          const hit = roll <= hitChance;
          if (!hit) addLog(s, "system", `⚔️ Промах. Шанс ${hitChance}% | Проверка ${roll}/100`);
          else {
            const dmg = 8;
            s.enemy.hpCur = Math.max(0, s.enemy.hpCur - dmg);
            addLog(s, "system", `⚔️ Попадание. Шанс ${hitChance}% | Проверка ${roll}/100\nИтоговый урон: ${dmg} | ❤️ HP врага: ${s.enemy.hpCur}/${s.enemy.hpMax}`);
            if (s.enemy.hpCur <= 0) {
              const xpGain = 60;
              s.xp += xpGain;
              addLog(s, "system", `🏁 Победа! ⭐ XP +${xpGain}`);
              delete s.enemy;
              if (s.xp >= s.xpToNext) {
                s.level += 1;
                s.xp -= s.xpToNext;
                s.xpToNext = computeXpToNext(s.level);
                addLog(s, "system", `🏅 УРОВЕНЬ ПОВЫШЕН! LV ${s.level}`);
              }
              return s;
            }
          }
        } else if (id === "3") {
          const idx = s.backpack.findIndex(it => it.id === "c_potion" && (it.qty ?? 0) > 0);
          if (idx >= 0) {
            s.backpack[idx].qty = (s.backpack[idx].qty ?? 1) - 1;
            s.hpCur = Math.min(s.hpMax, s.hpCur + 14);
            addLog(s, "system", `✦ Лечение: +14 HP → ❤️ ${s.hpCur}/${s.hpMax}`);
          } else addLog(s, "system", "✦ Нет зелья в рюкзаке");
        } else {
          addLog(s, "system", "🛡/◦ Вы действуете осторожно, выбирая позицию (MVP).");
        }

        // enemy response
        const eroll = chanceCheck();
        const ehit = eroll <= 55;
        if (!ehit) addLog(s, "system", `Ответ врага: промах. Проверка ${eroll}/100`);
        else {
          const edmg = 6;
          s.hpCur = Math.max(0, s.hpCur - edmg);
          addLog(s, "system", `Ответ врага: попадание. Проверка ${eroll}/100\nУрон: ${edmg} | Ваше ❤️ ${s.hpCur}/${s.hpMax}`);
          if (s.hpCur <= 0) {
            addLog(s, "system", "☠️ Вы пали. Возврат в безопасную точку. Рюкзак потерян.");
            s.backpack = [];
            s.hpCur = s.hpMax;
            s.location = safeHub(s.universe);
            delete s.enemy;
          }
        }
        return s;
      }

      // exploration
            // === scene transitions (non-combat) ===
      if (!s.enemy) {
        if (s.node === "HUB") {
          if (id === "1") s.node = "BOARD";
          else if (id === "2") s.node = "WHISPER";
          else if (id === "3") s.node = "CHECK";
          return s;
        }

        if (s.node === "BOARD") {
          if (id === "1") s.node = "ROAD";
          else if (id === "3") s.node = "HUB";
          return s;
        }

        if (s.node === "WHISPER") {
          if (id === "3") s.node = "HUB";
          return s;
        }

        if (s.node === "CHECK") {
          if (id === "3") s.node = "HUB";
          return s;
        }

        if (s.node === "ROAD") {
          if (id === "3") s.node = "HUB";
          return s;
        }
      }

      if (id === "1") {
        const roll = chanceCheck();
        addLog(s, "system", `Вы читаете доску. Проверка случая: ${roll}/100 → ${roll <= 25 ? "⚠️ подозрительная тень" : "тишина"}`);
        if (roll <= 25) startCombat(s);
      } else if (id === "2") {
        const roll = chanceCheck();
        addLog(s, "system", `Разговор. Проверка случая: ${roll}/100 → ${roll <= 50 ? "✅ наводка на тайник" : "❌ собеседник ушёл"}`);
        s.journalPath = roll <= 50 ? "Получена наводка на тайник" : "Срыв разговора";
      } else if (id === "3") {
        addLog(s, "system", "Вы проверяете ремни и карманы. Всё на месте.");
        s.journalPath = "Проверка снаряжения";
      } else {
        addLog(s, "system", `◦ Ваш вариант: "${customText ?? ""}" (MVP).`);
      }

      return s;
    });
  }

  function submitInput() {
    const txt = input.trim();
    if (!txt) return;

    // During play, route
    if (state.phase === "PLAY") {
      setState(prev => {
        const s = structuredClone(prev);
        if (useCommand(s, txt)) return s;
        return s;
      });

      if (txt === "1" || txt === "2" || txt === "3") handleChoice(txt as any);
      else if (txt === "4") {
        setState(prev => {
          const s = structuredClone(prev);
          addLog(s, "system", "Введите свой вариант текстом.");
          return s;
        });
      } else handleChoice("4", txt);

      setInput("");
      return;
    }

    // non-play: name/custom rules can be entered
    if (state.phase === "CHAR_NAME") setName(txt);
    else if (state.phase === "CUSTOM_RULES") setCustomRulesText(txt);
    setInput("");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-semibold">Text RPG — Web MVP</div>
            <div className="text-sm text-zinc-400">Сохранение в браузере. Деплой на Vercel.</div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900" onClick={hardReset}>Сброс</button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          {/* HUD */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="mb-3 text-sm font-semibold text-zinc-200">HUD</div>
            {!showHud ? (
              <div className="text-sm text-zinc-300">HUD появится после старта персонажа.</div>
            ) : (
              <div className="space-y-3 text-sm leading-5">
                <div>
                  <div>🕒 Время: День {state.day}, {String(state.hour).padStart(2,"0")}:00 | 🌦️ {state.weather}</div>
                  <div>📍 Локация: {state.location}</div>
                </div>

                <div>
                  <div>🧑 Персонаж: {state.name} — {state.race?.name}/{state.cls?.name}</div>
                  <div>🏅 Уровень: {state.level}</div>
                  <div>⭐ Опыт: {state.xp} / {state.xpToNext}</div>
                </div>

                <div>
                  <div>❤️ HP: {state.hpCur}/{state.hpMax}</div>
                  <div>🔷 MP: {state.mpCur}/{state.mpMax}</div>
                </div>

                <div>
                  <div className="font-semibold">📊 Характеристики</div>
                  <div>💪 {state.stats.str}  🎯 {state.stats.dex}  🛡️ {state.stats.end}</div>
                  <div>🧠 {state.stats.int}  🗣️ {state.stats.cha}  🍀 {state.stats.luck}</div>
                </div>

                <div>
                  <div className="font-semibold">⚔️ Экип</div>
                  <div>— Оружие: {state.equipped.weapon1?.rarity} {state.equipped.weapon1?.name} ({(state.equipped.weapon1 as any)?.dmgMin ?? "—"}–{(state.equipped.weapon1 as any)?.dmgMax ?? "—"})</div>
                  <div>— Броня: {state.equipped.armor?.rarity} {state.equipped.armor?.name}</div>
                </div>

                <div>
                  <div className="font-semibold">🎒 Рюкзак</div>
                  <div>слоты {slotsUsed}/10 | вес {sumWeight(state.backpack).toFixed(1)} кг</div>
                </div>

                <div>
                  <div>💰 Деньги: {state.money} {currency}</div>
                  <div>🧭 Журнал пути: {state.journalPath}</div>
                  <div>📒 Добыча: {state.lootJournal.slice(0,2).length ? state.lootJournal.slice(0,2).join(" | ") : "—"}</div>
                </div>
              </div>
            )}
          </div>

          {/* Main */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4">
            {state.phase !== "PLAY" ? (
              <div className="space-y-4">
                {state.phase === "SETTINGS" && (
                  <>
                    <div className="text-lg font-semibold">Старт — настройки</div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                      <div className="font-semibold">A) 🔧 Износ</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => setWear("ON")} className={`rounded-xl border px-3 py-2 text-sm ${state.wear==="ON" ? "border-emerald-500 bg-emerald-950/30" : "border-zinc-700 hover:bg-zinc-900"}`}>1) ✅ ВКЛ</button>
                        <button onClick={() => setWear("OFF")} className={`rounded-xl border px-3 py-2 text-sm ${state.wear==="OFF" ? "border-emerald-500 bg-emerald-950/30" : "border-zinc-700 hover:bg-zinc-900"}`}>2) ❌ ВЫКЛ</button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                      <div className="font-semibold">B) 🌍 Вселенная</div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button onClick={() => setUniverse("CLASSIC_FANTASY")} className="rounded-xl border border-zinc-700 px-3 py-2 text-left text-sm hover:bg-zinc-900">1) Классическое фэнтези</button>
                        <button onClick={() => setUniverse("DARK_FANTASY")} className="rounded-xl border border-zinc-700 px-3 py-2 text-left text-sm hover:bg-zinc-900">2) Тёмное фэнтези</button>
                        <button onClick={() => setUniverse("ANIME_ISEKAI")} className="rounded-xl border border-zinc-700 px-3 py-2 text-left text-sm hover:bg-zinc-900">3) Аниме-исэкай</button>
                        <button onClick={() => setUniverse("CANON")} className="rounded-xl border border-zinc-700 px-3 py-2 text-left text-sm hover:bg-zinc-900">4) Канон</button>
                        <button onClick={() => setUniverse("CUSTOM")} className="rounded-xl border border-zinc-700 px-3 py-2 text-left text-sm hover:bg-zinc-900 sm:col-span-2">5) Своя вселенная</button>
                      </div>
                    </div>
                  </>
                )}

                {state.phase === "CANON_MODE" && <CanonSetup onDone={setCanon} />}

                {state.phase === "CUSTOM_RULES" && <CustomSetup onDone={setCustomRulesText} />}

                {state.phase === "CHAR_SEX" && (
                  <div className="space-y-3">
                    <div className="text-lg font-semibold">A) Пол</div>
                    <div className="flex flex-wrap gap-2">
                      {["Мужской","Женский","Не важно"].map(v => (
                        <button key={v} onClick={() => setSex(v)} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900">{v}</button>
                      ))}
                    </div>
                  </div>
                )}

                {state.phase === "CHAR_NAME" && (
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">B) Имя</div>
                    <div className="text-sm text-zinc-400">Введите имя в поле снизу и нажмите Enter.</div>
                  </div>
                )}

                {state.phase === "CHAR_RACE" && (
                  <div className="space-y-3">
                    <div className="text-lg font-semibold">C) Раса (5 вариантов)</div>
                    <div className="grid gap-2">
                      {RACES.slice(racePage*5, racePage*5+5).map(r => (
                        <button key={r.id} onClick={() => chooseRace(r.id)} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-left hover:bg-zinc-900">
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-sm text-zinc-300">{r.desc}</div>
                          <div className="mt-2 text-xs text-zinc-400">Бонусы: {fmtBonus(r.bonuses)} | Слабость: {r.weakness} | Влияние: {r.worldImpact}</div>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => setRacePage(p => Math.max(0,p-1))} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40" disabled={racePage===0}>← Назад</button>
                      <div className="text-sm text-zinc-400">Стр. {racePage+1}/3</div>
                      <button onClick={() => setRacePage(p => Math.min(2,p+1))} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40" disabled={racePage===2}>Дальше →</button>
                    </div>
                  </div>
                )}

                {state.phase === "CHAR_CLASS" && (
                  <div className="space-y-3">
                    <div className="text-lg font-semibold">D) Класс (5 вариантов)</div>
                    <div className="grid gap-2">
                      {CLASSES.slice(classPage*5, classPage*5+5).map(c => (
                        <button key={c.id} onClick={() => chooseClass(c.id)} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-left hover:bg-zinc-900">
                          <div className="font-semibold">{c.name}</div>
                          <div className="text-sm text-zinc-300">{c.desc}</div>
                          <div className="mt-2 text-xs text-zinc-400">Бонусы: {fmtBonus(c.bonuses)} | Слабость: {c.weakness} | Влияние: {c.worldImpact}</div>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => setClassPage(p => Math.max(0,p-1))} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40" disabled={classPage===0}>← Назад</button>
                      <div className="text-sm text-zinc-400">Стр. {classPage+1}/3</div>
                      <button onClick={() => setClassPage(p => Math.min(2,p+1))} className="rounded-xl border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900 disabled:opacity-40" disabled={classPage===2}>Дальше →</button>
                    </div>
                  </div>
                )}

                {state.phase === "CHAR_BG" && (
                  <div className="space-y-3">
                    <div className="text-lg font-semibold">E) Предыстория</div>
                    <div className="grid gap-2">
                      {BACKGROUNDS.map(b => (
                        <button key={b.id} onClick={() => chooseBg(b.id)} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3 text-left hover:bg-zinc-900">
                          <div className="font-semibold">{b.name}</div>
                          <div className="text-sm text-zinc-300">{b.desc}</div>
                          <div className="mt-2 text-xs text-zinc-400">Бонус: {fmtBonus(b.bonus)} | Перк: {b.perk}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <>
                <div ref={logRef} className="h-[460px] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
                  {state.log.map((m, idx) => (
                    <div key={idx} className={`mb-3 rounded-xl p-3 ${m.role==="player" ? "bg-zinc-900/60" : "bg-zinc-900/20"}`}>
                      <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{m.role==="player" ? "Вы" : "Мир"}</div>
                      <pre className="whitespace-pre-wrap text-sm leading-5">{m.text}</pre>
                    </div>
                  ))}

                  {scene && (
                    <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                      {state.enemy && (
                        <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
                          <div className="font-semibold">Враг: {state.enemy.name}</div>
                          <div>❤️ HP: {state.enemy.hpCur}/{state.enemy.hpMax}</div>
                          <div>🌀 УКЛ: {state.enemy.evasion} | 🧱 ЗАЩ: {state.enemy.defense}</div>
                          <div>Слабость: {state.enemy.weak ?? "—"} | Сопротивление: {state.enemy.resist ?? "—"}</div>
                          <div>Атаки: {state.enemy.attackIcons.join(" ")} ({state.enemy.dmgMin}–{state.enemy.dmgMax})</div>
                        </div>
                      )}

                      <div className="mb-3 text-sm text-zinc-200">{scene.text}</div>
                      <div className="grid gap-2">
                        {scene.choices.map(c => (
                          <button key={c.id} onClick={() => handleChoice(c.id)} className="rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-left text-sm hover:bg-zinc-900">
                            {c.id}) {c.icon}  {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 text-xs text-zinc-500">Можно нажимать кнопки или писать 1–4. Команды: /помощь</div>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitInput(); }}
                    placeholder="Введите 1–4, свой вариант, или команду (/помощь)…"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-sm outline-none focus:border-zinc-600"
                  />
                  <button onClick={submitInput} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm hover:bg-zinc-800">Отправить</button>
                </div>
              </>
            )}

            {state.phase !== "PLAY" && (
              <div className="mt-4 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitInput(); }}
                  placeholder={state.phase === "CHAR_NAME" ? "Введите имя и Enter…" : state.phase === "CUSTOM_RULES" ? "2–3 правила мира и Enter…" : "Поле ввода…"}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-sm outline-none focus:border-zinc-600"
                />
                <button onClick={submitInput} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm hover:bg-zinc-800">OK</button>
              </div>
            )}

          </div>
        </div>

        <div className="mt-4 text-xs text-zinc-500">
          Это MVP. Для запуска: npm i, npm run dev. Для онлайн: залить в GitHub → Vercel Deploy.
        </div>
      </div>
    </div>
  );
}

function CanonSetup({ onDone }: { onDone: (title: string, mode: CanonMode) => void }) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<CanonMode>("A_STORYLIKE");

  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">Канон — название и режим</div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
        <div className="text-sm text-zinc-300">Введите название и выберите режим.</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Метро 2033" className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-sm outline-none focus:border-zinc-600" />
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => setMode("A_STORYLIKE")} className={`rounded-xl border px-3 py-2 text-left text-sm ${mode==="A_STORYLIKE" ? "border-emerald-500 bg-emerald-950/30" : "border-zinc-700 hover:bg-zinc-900"}`}>Режим A: аналогичный сюжет</button>
          <button onClick={() => setMode("B_WORLDONLY")} className={`rounded-xl border px-3 py-2 text-left text-sm ${mode==="B_WORLDONLY" ? "border-emerald-500 bg-emerald-950/30" : "border-zinc-700 hover:bg-zinc-900"}`}>Режим B: только мир/стиль</button>
        </div>
        <button onClick={() => onDone(title || "Без названия", mode)} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm hover:bg-zinc-800">Продолжить</button>
      </div>
    </div>
  );
}

function CustomSetup({ onDone }: { onDone: (rules: string) => void }) {
  const [rules, setRules] = useState("");
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">Своя вселенная — правила</div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
        <div className="text-sm text-zinc-300">Опишите 2–3 правила мира.</div>
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={4} placeholder="Например: магия запрещена в городах, ночью охотники, валюта — жетоны" className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-sm outline-none focus:border-zinc-600" />
        <button onClick={() => onDone(rules || "Правила не заданы")} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm hover:bg-zinc-800">Продолжить</button>
      </div>
    </div>
  );
}

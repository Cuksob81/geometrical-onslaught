/* Geometrical Onslaught - game logic */
const GetById = Id => document.getElementById(Id);
const Canvas = GetById('GameCanvas'), Context = Canvas.getContext('2d'), Ui = GetById('UiLayer');
const Arena = 2400, Tau = Math.PI * 2, PlayerRadius = 14, JoyRadius = 55;
let Width, Height, Dpr, Zoom, SafeTop = 0, SafeBottom = 0;

var RenderScale = 1, FpsGap = 0, FpsBox = null, ViewScale = 1;
function Resize(){
 Dpr = (devicePixelRatio || 1) * RenderScale;
 const VV = window.visualViewport;
 Width = Math.round(VV ? VV.width : innerWidth);
 Height = Math.round(VV ? VV.height : innerHeight);
 document.documentElement.style.setProperty('--app-w', Width + 'px');
 document.documentElement.style.setProperty('--app-h', Height + 'px');
 Canvas.width = Width * Dpr;
 Canvas.height = Height * Dpr;
 Zoom = Math.min(Width, Height) / 520 * ViewScale;
 SafeTop = GetById('TopProbe').offsetHeight;
 SafeBottom = GetById('BottomProbe').offsetHeight;
}

addEventListener('resize', Resize);
if(window.visualViewport) visualViewport.addEventListener('resize', Resize);
addEventListener('orientationchange', () => {setTimeout(Resize, 120); setTimeout(Resize, 600)});
document.addEventListener('fullscreenchange', () => setTimeout(Resize, 100));
addEventListener('pageshow', Resize);
setTimeout(Resize, 400);
Resize();

const Clamp = (V, Lo, Hi) => Math.max(Lo, Math.min(Hi, V)), Round2 = V => Math.round(V * 100) / 100, RandRange = (Lo, Hi) => Lo + Math.random() * (Hi - Lo);
const Shuffle = A => A.slice().sort(() => Math.random() - .5);
const DataEpoch = 2;
var WasWiped = false;
(function(){
 try{
  if(localStorage.getItem('GOEpoch') === String(DataEpoch)) return;
  for(const K of Object.keys(localStorage)) if(/^(ShapeSwarm|GO)/.test(K)){localStorage.removeItem(K); WasWiped = true}
  localStorage.setItem('GOEpoch', String(DataEpoch)); localStorage.setItem('ShapeSwarmSealed', '1');
 }catch(Err){}
})();
var Tampered = 0;
const SealSalt = 'ss/4.7·k9x';
const H53 = (Str, Seed = 0) => {let H1 = 0xdeadbeef ^ Seed, H2 = 0x41c6ce57 ^ Seed; for(let I = 0; I < Str.length; I++){const C = Str.charCodeAt(I); H1 = Math.imul(H1 ^ C, 2654435761); H2 = Math.imul(H2 ^ C, 1597334677)} H1 = Math.imul(H1 ^ (H1 >>> 16), 2246822507) ^ Math.imul(H2 ^ (H2 >>> 13), 3266489909); H2 = Math.imul(H2 ^ (H2 >>> 16), 2246822507) ^ Math.imul(H1 ^ (H1 >>> 13), 3266489909); return (4294967296 * (2097151 & H2) + (H1 >>> 0)).toString(36)};
function Seal(Key, V){
 const U = unescape(encodeURIComponent(V)), K = H53(SealSalt + Key); let Out = '';
 for(let I = 0; I < U.length; I++) Out += String.fromCharCode(U.charCodeAt(I) ^ K.charCodeAt(I % K.length) ^ ((I * 7) & 127));
 const B = btoa(Out); return 'v2.' + B + '.' + H53(SealSalt + Key + B, 7);
}
function Unseal(Key, Raw){
 if(Raw.slice(0, 3) !== 'v2.'){
  if(localStorage.getItem('ShapeSwarmSealed') === null){try{localStorage.setItem(Key, Seal(Key, Raw))}catch(Err){} return Raw}
  Tampered++; localStorage.removeItem(Key); return null;
 }
 const P = Raw.split('.');
 if(P.length === 3 && P[2] === H53(SealSalt + Key + P[1], 7)){
  try{const D = atob(P[1]), K = H53(SealSalt + Key); let Out = ''; for(let I = 0; I < D.length; I++) Out += String.fromCharCode(D.charCodeAt(I) ^ K.charCodeAt(I % K.length) ^ ((I * 7) & 127)); return decodeURIComponent(escape(Out))}catch(Err){}
 }
 Tampered++; localStorage.removeItem(Key); return null;
}
function StorageGet(Key){try{const Raw = localStorage.getItem(Key); return Raw === null ? null : Unseal(Key, Raw)}catch(Err){return null}}
function StorageSet(Key, V){try{localStorage.setItem(Key, Seal(Key, String(V)))}catch(Err){}}
let Best = {};
try{Best = JSON.parse(StorageGet('ShapeSwarmBest2') || '{}') || {}}catch(Err){Best = {}}


/* ---------- sound effects (generated in-browser; no extra files) ---------- */
let AudioEngine = null, SoundEnabled = true, LastHitSound = 0, SfxVol = 1;
function InitAudio(){
 try{
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if(!AudioContextClass) return null;
  if(!AudioEngine) AudioEngine = new AudioContextClass();
  if(AudioEngine.state === 'suspended') AudioEngine.resume();
  return AudioEngine;
 }catch(Err){return null}
}
function PlayTone(Frequency, Duration = .07, Type = 'sine', Volume = .025, EndFrequency = Frequency, Delay = 0){
 if(!SoundEnabled) return;
 const Audio = InitAudio(); if(!Audio) return;
 const Start = Audio.currentTime + Delay, Osc = Audio.createOscillator(), Gain = Audio.createGain();
 Osc.type = Type;
 Osc.frequency.setValueAtTime(Math.max(1, Frequency), Start);
 Osc.frequency.exponentialRampToValueAtTime(Math.max(1, EndFrequency), Start + Duration);
 Gain.gain.setValueAtTime(.0001, Start);
 Gain.gain.exponentialRampToValueAtTime(Math.max(.0001, Volume * SfxVol), Start + .008);
 Gain.gain.exponentialRampToValueAtTime(.0001, Start + Duration);
 Osc.connect(Gain); Gain.connect(Audio.destination); Osc.start(Start); Osc.stop(Start + Duration + .015);
}
var Muting = false;
function PlaySfx(Name){
 if(!SoundEnabled || Muting) return;
 switch(Name){
  case 'Shoot': PlayTone(620,.045,'triangle',.12,360); break;
  case 'Hit': {const Now = performance.now(); if(Now - LastHitSound < 65) return; LastHitSound = Now; PlayTone(230,.045,'square',.12,120); break}
  case 'Kill': PlayTone(420,.07,'triangle',.16,180); break;
  case 'Pickup': PlayTone(760,.09,'sine',.18,1120); break;
  case 'Hurt': PlayTone(170,.16,'sawtooth',.20,65); break;
  case 'LevelUp': PlayTone(520,.12,'triangle',.18,780); PlayTone(780,.16,'triangle',.15,1180,.1); break;
  case 'Wave': PlayTone(330,.12,'triangle',.16,500); PlayTone(500,.16,'triangle',.16,660,.12); break;
  case 'Shop': PlayTone(430,.06,'sine',.14,580); break;
  case 'GameOver': PlayTone(300,.25,'triangle',.18,110); PlayTone(180,.35,'sine',.15,65,.2); break;
  case 'Victory': PlayTone(520,.12,'triangle',.16,780); PlayTone(780,.12,'triangle',.16,1040,.12); PlayTone(1040,.2,'sine',.16,1320,.24); break;
 }
}
function ToggleSound(){
 SoundEnabled = !SoundEnabled;
 if(SoundEnabled){InitAudio(); PlaySfx('Shop')}
 if(typeof ShowBanner === 'function') ShowBanner(SoundEnabled ? 'Sound on' : 'Sound off', 'Press M to toggle sound', SoundEnabled ? '#4ff0d6' : '#8f98c8');
}
addEventListener('pointerdown', InitAudio, {once:true});

/* ---------- data ---------- */
const ElemNames = ['Fire', 'Water', 'Earth', 'Wind'];
const Elems = {
 Fire: {Glyph: '▲', Color: '#ff7a3d', Desc: 'Burns enemies over time. +8% damage per level. Lv3 Ember Burst: burning enemies explode on death.'},
 Water: {Glyph: '●', Color: '#4fb4ff', Desc: 'Slows enemies. +6% fire rate per level. Lv3 Deep Freeze: every 6th hit freezes a target.'},
 Earth: {Glyph: '■', Color: '#c9a066', Desc: 'Heavy bolts that knock back and stun. +1.5 defense per level. Lv3 Shatter: stunned enemies take +80% damage.'},
 Wind: {Glyph: '◆', Color: '#8ff5d2', Desc: 'Fast piercing bolts. +4% move speed per level. Lv3 Chain Gust: hits arc to a nearby enemy.'}
};

const Modes = {
 Standard: {Total: 1800, RoundLen: 180, Step: .22, Info: '30:00'},
 Quickplay: {Total: 600, RoundLen: 120, Step: .40, Info: '10:00'},
 Endless: {Total: 0, RoundLen: 90, Step: .25, Info: 'No timer'}
};

const EnemyTypes = [
 {Hp: 18, Speed: 60, Radius: 11, Damage: 8, Sides: 0, Color: '#ff5d73', XpValue: 3},
 {Hp: 10, Speed: 115, Radius: 7, Damage: 5, Sides: 3, Color: '#ffc857', XpValue: 2},
 {Hp: 50, Speed: 38, Radius: 17, Damage: 14, Sides: 5, Color: '#9b7bff', XpValue: 6},
 {Hp: 26, Speed: 55, Radius: 12, Damage: 8, Sides: 8, Color: '#ff8fd0', XpValue: 7},
 {Hp: 650, Speed: 26, Radius: 52, Damage: 30, Sides: 10, Color: '#ff3b3b', XpValue: 40}
];

const Item = (Name, Glyph, Key, Value, Opts, Desc) => ({Name, Glyph, Key, Value, ...Opts});
const Items = [
 Item('Power', '●', 'Damage', 3, {Unit: 'Damage'}),
 Item('Overclock', '▲', 'FireRate', .15, {Unit: 'Fire Rate'}),
 Item('Extra bolt', '⬢', 'Projectile', 1, {IsInt: 1, Unit: 'Projectile'}),
 Item('Scope', '◉', 'Range', 20, {Unit: 'Range'}),
 Item('Accelerator', '▷', 'ProjectileSpeed', 40, {Unit: 'Bolt Speed'}),
 Item('Piercer', '◇', 'Piercing', 1, {IsInt: 1, Unit: 'Pierce'}),
 Item('Precision', '◎', 'CriticalChance', .025, {IsPct: 1, Unit: 'Crit Chance'}),
 Item('Lethality', '✦', 'CriticalDamage', .12, {IsPct: 1, Unit: 'Crit Damage'}),
 Item('Hull', '■', 'MaximumHealth', 15, {Unit: 'Maximum Health'}),
 Item('Repair', '✚', 'Regeneration', .4, {Unit: 'Regeneration'}),
 Item('Plating', '▣', 'Defense', 1, {IsInt: 1, Unit: 'Defense'}),
 Item('Evasion', '◌', 'Evasion', .03, {IsPct: 1, Unit: 'Evasion'}),
 Item('Thrusters', '▶', 'MovementSpeed', 8, {Unit: 'Movement Speed'}),
 Item('Magnet', '◐', 'PickupRange', 30, {Unit: 'Pickup Range'}),
 Item('Leech', '◆', 'Lifesteal', .015, {IsPct: 1, Unit: 'Lifesteal'}),
 Item('Thorns', '▼', 'Thorn', 4, {Unit: 'Thorn Damage'}),
 Item('Impact', '◀', 'Knockback', 15, {Unit: 'Knockback'}),
 Item('Blast', '✱', 'BlastRadius', 15, {Unit: 'Blast Radius'}),
 Item('Scholar', '★', 'ExperienceBonus', .08, {IsPct: 1, Unit: 'Experience'}),
 Item('Fortune', '♣', 'Luck', .10, {IsPct: 1, Unit: 'Luck'}),
 Item('Potency', '⚡', 'ElementPower', .10, {IsPct: 1, Unit: 'Element Power'}),
 Item('Lingering', '⌛', 'StatusDuration', .15, {IsPct: 1, Unit: 'Status Duration'}),
 Item('Bulk', '⬤', 'ProjectileSize', .10, {IsPct: 1, Unit: 'Bolt Size'})
];

const StatCaps = {Projectile: 10, Evasion: .6, CriticalChance: .6, CriticalDamage: 1.5, Piercing: 8, Lifesteal: .2, BlastRadius: 150, Range: 520, FireRate: 8, Defense: 40};
const TierMult = [1, 1.5, 2, 2.5, 4, 5], IntTier = [1, 1, 2, 2, 3, 4];
const RarityNames = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythical'];
const RarityColors = ['#FFFFFF', '#1EFF00', '#0070DD', '#A335EE', '#FF8000', '#1FDBDE'];
const Percent = V => Math.round(V * 100) + '%';

const StatList = [
 ['Damage', 'Damage', V => Round2(V)],
 ['FireRate', 'Fire Rate', V => Round2(V) + '/s'],
 ['Projectile', 'Projectile', V => V],
 ['Range', 'Range', V => V],
 ['ProjectileSpeed', 'Projectile Speed', V => V],
 ['Piercing', 'Piercing', V => V],
 ['CriticalChance', 'Critical Chance', Percent],
 ['CriticalDamage', 'Critical Damage', V => Percent(2 + V)],
 ['MaximumHealth', 'Maximum Health', V => V],
 ['Regeneration', 'Regeneration', V => Round2(V) + '/s'],
 ['Defense', 'Defense', V => V],
 ['Evasion', 'Evasion', Percent],
 ['MovementSpeed', 'Movement Speed', V => V],
 ['PickupRange', 'Pickup Range', V => V],
 ['Lifesteal', 'Lifesteal', V => Round2(V * 100) + '%'],
 ['Thorn', 'Thorn', V => V],
 ['Knockback', 'Knockback', V => V],
 ['BlastRadius', 'Blast Radius', V => V],
 ['ExperienceBonus', 'Experience Bonus', Percent],
 ['Luck', 'Luck', Percent],
 ['ElementPower', 'Element Power', Percent],
 ['StatusDuration', 'Status Duration', Percent],
 ['ProjectileSize', 'Bolt Size', Percent]
];

function ItemValue(It, Tier){return It.IsInt ? IntTier[Tier] * It.Value : Round2(It.Value * TierMult[Tier])}
function ItemText(It, Tier){const V = ItemValue(It, Tier); return '+' + (It.IsPct ? Round2(V * 100) + '%' : Round2(V)) + ' ' + It.Unit}

function RollTier(){
 const Power = Player.Level + Round * 2, L = Stats.Luck, R = Math.random();
 if(Power >= 22 && R < .01 + L * .03) return 5;
 if(Power >= 16 && R < .03 + L * .06) return 4;
 if(Power >= 10 && R < .08 + L * .10) return 3;
 if(Power >= 5 && R < .20 + L * .15) return 2;
 return R < .40 + L * .20 ? 1 : 0;
}

/* 5 slots: always at least one element card (if any are below max level) */
function RollOffers(){
 const Open = ElemNames.filter(N => Elem[N] < 5), Offers5 = [];
 if(Open.length) Offers5.push({Kind: 'Elem', Name: Open[Math.floor(Math.random() * Open.length)]});
 const Pool = Shuffle([...Items.map(It => ({Kind: 'Item', Item: It})), ...Open.map(N => ({Kind: 'Elem', Name: N}))]);
 for(const P of Pool){
  if(Offers5.length >= 5) break;
  if(P.Kind === 'Elem' && Offers5.some(O => O.Name === P.Name)) continue;
  Offers5.push(P);
 }
 for(const O of Offers5) if(O.Kind === 'Item') O.Tier = RollTier();
 return Shuffle(Offers5);
}

function ApplyOffer(Offer){
 if(Offer.Kind === 'Elem'){Elem[Offer.Name]++; return}
 const It = Offer.Item, V = ItemValue(It, Offer.Tier);
 Stats[It.Key] = Math.min(StatCaps[It.Key] ?? 1e9, Stats[It.Key] + V);
 if(It.Key === 'MaximumHealth') Player.Hp += V;
}

/* ---------- state ---------- */
let Mode = 'menu', SelMode = 'Standard', SelElem = 'Fire', ModeKey = 'Standard';
let Round = 1, Rounds = 0, RoundTime = 0, Diff = 1, SpawnTimer = 0, Time = 0, Offers = [], Pending = 0, Rerolls = 3, Shots = 0, LastElem = 'Fire';
let Shake = 0, DyingTime = 0, HpView = 0, Aim = 0, AutoAim = false, Obj = null, ObjKills = 0;
let Player, Stats, Elem, RunStats, Enemies = [], Bolts = [], EnemyBolts = [], Pickups = [], Crystals = [], Zone = null;
let Particles = [], Texts = [], ActiveBanner = null, Camera = {X: Arena / 2, Y: Arena / 2};
const Dots = Array.from({length: 220}, () => ({X: RandRange(0, Arena), Y: RandRange(0, Arena), Size: RandRange(1, 2.5), Phase: RandRange(0, Tau)}));
let InputMode = matchMedia('(pointer:coarse)').matches ? 'touch' : 'key';

const XpNeeded = L => Math.round(18 + L * 10 + L * L * 1.6);

function NewRun(){
 Stats = {
  Damage: 10,
  FireRate: 1.4,
  Projectile: 1,
  Range: 260,
  ProjectileSpeed: 380,
  Piercing: 0,
  CriticalChance: .05,
  CriticalDamage: 0,
  MaximumHealth: 100,
  Regeneration: .5,
  Defense: 0,
  Evasion: 0,
  MovementSpeed: 130,
  PickupRange: 60,
  Lifesteal: 0,
  Thorn: 0,
  Knockback: 20,
  BlastRadius: 0,
  ExperienceBonus: 0,
  Luck: 0,
  ElementPower: 0,
  StatusDuration: 0,
  ProjectileSize: 0
 };

 Elem = {Fire: 0, Water: 0, Earth: 0, Wind: 0};
 Elem[SelElem] = 1;
 LastElem = SelElem;

 ModeKey = SelMode;
 const Cfg = Modes[ModeKey];
 Rounds = Cfg.Total ? Cfg.Total / Cfg.RoundLen : 0;

 Player = {X: Arena / 2, Y: Arena / 2, Hp: Stats.MaximumHealth, Inv: 0, Cooldown: 0, KnockX: 0, KnockY: 0, Xp: 0, Level: 1, Recoil: 0};
 RunStats = {Kills: 0, Damage: 0, Time: 0};
 HpView = Player.Hp; Camera.X = Player.X; Camera.Y = Player.Y;
 Enemies = []; Bolts = []; EnemyBolts = []; Pickups = []; Crystals = []; Zone = null; Particles = []; Texts = [];
 Round = 1; Pending = 0; Rerolls = 3; Shots = 0; Time = 0;
 Mode = 'play'; Ui.className = '';
 StartRound();
}

/* ---------- rounds & objectives ---------- */
const ObjOrder = ['slay', 'gather', 'elite', 'zone'];

function StartRound(){
 const Cfg = Modes[ModeKey];
 RoundTime = Cfg.RoundLen; Diff = 1 + (Round - 1) * Cfg.Step; SpawnTimer = .5; ObjKills = 0;
 Enemies = Enemies.filter(En => !En.Elite); Crystals = []; Zone = null; NewDungeon();
 const Type = ObjOrder[(Round - 1) % 4];
 Obj = {Type, Have: 0, Need: 1, Done: false};

 if(Type === 'slay') Obj.Need = Math.round(22 + Round * 7);
 if(Type === 'gather'){
  Obj.Need = 5;
  for(let I = 0; I < 5; I++) Crystals.push(Object.assign(RandFloor(), {Phase: RandRange(0, Tau)}));
 }
 if(Type === 'elite') SpawnEnemy(4, true);
 if(Type === 'zone'){
  Obj.Need = 22 + Round * 2;
  const A = RandRange(0, Tau);
  Zone = ZonePlace();
 }

 const Boss = Round % 5 === 0;
 if(Boss) SpawnEnemy(4, false);
 ShowBanner('Round ' + Round, Boss ? 'Boss incoming' : ObjectiveName(), '#4ff0d6');
}

function ObjectiveName(){
 return {slay: 'Slay enemies', gather: 'Collect the crystals', elite: 'Defeat the elite', zone: 'Hold the zone'}[Obj.Type];
}

function ObjectiveText(){
 const T = Obj.Type, Prog = T === 'zone' ? Math.floor(Obj.Have) + '/' + Obj.Need + 's' : Math.floor(Obj.Have) + '/' + Obj.Need;
 return Obj.Done ? ObjectiveName() + ' ✔' : ObjectiveName() + ' ' + Prog;
}

function ObjectiveTick(Dt){
 if(Obj.Done) return;
 if(Obj.Type === 'slay') Obj.Have = ObjKills;
 if(Obj.Type === 'gather'){
  for(const C of Crystals) if(!C.Got && PartyNear(C.X, C.Y, PlayerRadius + 14)){C.Got = true; Obj.Have++; Burst(C.X, C.Y, '#4ff0d6', 14, 160, .5); Ring(C.X, C.Y, '#4ff0d6', 50, .4)}
 }
 if(Obj.Type === 'zone' && PartyNear(Zone.X, Zone.Y, Zone.R)) Obj.Have += Dt;
 if(Obj.Have >= Obj.Need){
  Obj.Done = true; Pending++; PartyBonus(); Crystals = []; Zone = null;
  Player.Hp = Math.min(Stats.MaximumHealth, Player.Hp + Stats.MaximumHealth * .25);
  ShowBanner('Objective complete', 'Bonus upgrade', '#ffc857');
  Ring(Player.X, Player.Y, '#ffc857', 90, .6);
 }
}

function EndRound(){
 if(!Obj.Done){
  const Loss = Stats.MaximumHealth * .25;
  Player.Hp = Math.max(1, Player.Hp - Loss);
  ShowBanner('Objective failed', '-25% health', '#ff5d73'); Shake = Math.max(Shake, 8);
 }
 if(Rounds && Round >= Rounds){GameOver(true); return}
 Round++; StartRound();
}

/* ---------- enemies ---------- */
function PickType(){
 const R = Math.random();
 if(Diff >= 1.7 && R < .15) return 3;
 if(Diff >= 1.4 && R < .40) return 2;
 if(Diff >= 1.2 && R < .75) return 1;
 return 0;
}

function SpawnEnemy(Kind, Elite){
 const Type = EnemyTypes[Kind];
 const SP = SpawnPoint(), X = SP.X, Y = SP.Y;
 const HpMul = Elite ? .45 : 1, Size = Elite ? .75 : 1, Spawn = Kind === 4 ? 1.2 : .6;
 Enemies.push({
  Kind, X, Y, Elite: !!Elite,
  Hp: Type.Hp * Diff * HpMul, MaxHp: Type.Hp * Diff * HpMul,
  Speed: Type.Speed * (1 + Math.min(.4, (Diff - 1) * .08)),
  Radius: Type.Radius * Size, Damage: Type.Damage * (1 + (Diff - 1) * .5),
  Sides: Type.Sides, Color: Elite ? '#ffc857' : Type.Color,
  Flash: 0, Cooldown: RandRange(1, 3), Rot: 0, SpawnLeft: Spawn, SpawnTotal: Spawn,
  KnockX: 0, KnockY: 0, SlowT: 0, SlowPct: 0, StunT: 0, Burn: null, BurnTick: 0, Dead: false
 });
}

function EnemyShot(En, Angle){EnemyBolts.push({X: En.X, Y: En.Y, Vx: Math.cos(Angle) * 150, Vy: Math.sin(Angle) * 150, Damage: En.Damage * .8, Life: 5})}

/* ---------- effects ---------- */
function Burst(X, Y, Color, Count, Speed, Life){
 for(let I = 0; I < Count && Particles.length < ParticleCap; I++){
  const Angle = RandRange(0, Tau), V = RandRange(.3, 1) * Speed;
  Particles.push({X, Y, Vx: Math.cos(Angle) * V, Vy: Math.sin(Angle) * V, Life: Life || .5, MaxLife: Life || .5, Color, Size: RandRange(1.5, 3.5)});
 }
}
function Ring(X, Y, Color, Size, Life){Particles.push({X, Y, Vx: 0, Vy: 0, Life: Life || .4, MaxLife: Life || .4, Color, Size, Ring: true})}
function FloatText(X, Y, Text, Color){if(Texts.length < 30) Texts.push({X: X + RandRange(-8, 8), Y, Text, Color, Life: .7})}
function ShowBanner(Text, Sub, Color){ActiveBanner = {Text, Sub, Color, T: 0, Max: 2}}

function UpdateFx(Dt){
 Shake *= Math.pow(.005, Dt);
 for(const Pt of Particles){Pt.Life -= Dt; Pt.X += Pt.Vx * Dt; Pt.Y += Pt.Vy * Dt; Pt.Vx *= 1 - 4 * Dt; Pt.Vy *= 1 - 4 * Dt}
 Particles = Particles.filter(Pt => Pt.Life > 0);
 for(const Tx of Texts){Tx.Life -= Dt; Tx.Y -= 40 * Dt}
 Texts = Texts.filter(Tx => Tx.Life > 0);
 if(ActiveBanner){ActiveBanner.T += Dt; if(ActiveBanner.T > ActiveBanner.Max) ActiveBanner = null}
 if(Player){
  const CT = CamT(); Camera.X += (CT.X - Camera.X) * Math.min(1, Dt * 9); Camera.Y += (CT.Y - Camera.Y) * Math.min(1, Dt * 9);
  HpView += (Player.Hp - HpView) * Math.min(1, Dt * 8);
 }
 if(Mode === 'dying'){DyingTime -= Dt; if(DyingTime <= 0) GameOver(false)}
}

/* ---------- combat ---------- */
const EffDamage = () => Stats.Damage * (1 + .08 * Elem.Fire) * (1 + (Stats.DamageMult || 0));
const EffFireRate = () => Stats.FireRate * (1 + .06 * Elem.Water);
const EffDefense = () => Stats.Defense + 1.5 * Elem.Earth;
const EffSpeed = () => Stats.MovementSpeed * (1 + .04 * Elem.Wind);

function DamageEnemy(En, Amount, IsCrit, Vx, Vy, Color, Knock){
 if(En.Dead) return;
 if(IsCrit) HitStop = Math.max(HitStop, .03);
 PlaySfx('Hit');
 En.Hp -= Amount; En.Flash = .1; RunStats.Damage += Amount;
 FloatText(En.X, En.Y - En.Radius, Math.round(Amount), IsCrit ? '#ffc857' : (Color || '#ffffff'));
 Burst(En.X, En.Y, En.Color, 3, 90, .35);
 if(Vx !== undefined && Knock){
  const Len = Math.hypot(Vx, Vy) || 1, Force = Knock * (En.Kind === 4 ? .15 : 1) * 10 / (En.Radius + 6);
  En.KnockX += Vx / Len * Force * 10; En.KnockY += Vy / Len * Force * 10;
 }
 if(En.Hp <= 0){En.Dead = true; KillEnemy(En)}
}

function ApplyElement(En, Bt){
 const P = 1 + Stats.ElementPower, D = 1 + Stats.StatusDuration, L = Bt.Lv;
 if(Bt.Elem === 'Fire'){En.Burn = {T: 3 * D, Dps: Bt.Damage * (.25 + .08 * L) * P}}
 if(Bt.Elem === 'Water'){En.SlowT = 2 * D; En.SlowPct = Math.min(.7, (.2 + .07 * L) * P)}
 if(Bt.Elem === 'Earth' && Math.random() < (.06 + .04 * L) * P){En.StunT = .7 * D; Ring(En.X, En.Y, Elems.Earth.Color, En.Radius * 2, .3)}
}

function KillEnemy(En){
 PlaySfx('Kill');
 const Type = EnemyTypes[En.Kind], Xp = Type.XpValue * (En.Elite ? 3 : 1) * (1 + (Diff - 1) * .25) * (1 + Stats.ExperienceBonus);
 const Pieces = En.Kind === 4 ? 8 : 1;
 for(let I = 0; I < Pieces; I++){
  if(Pickups.length > 200){PartyXp(NearT(En.X, En.Y), Xp / Pieces); continue}
  const Angle = RandRange(0, Tau);
  Pickups.push({X: En.X, Y: En.Y, Vx: Math.cos(Angle) * 90, Vy: Math.sin(Angle) * 90, Value: Xp / Pieces, Phase: RandRange(0, Tau)});
 }
 Burst(En.X, En.Y, En.Color, En.Kind === 4 ? 40 : 12, En.Kind === 4 ? 260 : 170, .6); Ring(En.X, En.Y, En.Color, En.Radius * 2.4, .35);
 Shake = Math.max(Shake, En.Kind === 4 ? 12 : 2);
 RunStats.Kills++; ObjKills++;
 if(En.Elite && Obj && Obj.Type === 'elite' && !Obj.Done) Obj.Have = 1;
}

function GainXp(V){
 Player.Xp += V;
 while(Player.Xp >= XpNeeded(Player.Level)){
  Player.Xp -= XpNeeded(Player.Level); Player.Level++; Pending++; PlaySfx('LevelUp');
  FloatText(Player.X, Player.Y - 34, 'LEVEL UP', '#ffc857'); Ring(Player.X, Player.Y, '#ffc857', 60, .6);
 }
}

function HurtPlayer(Amount, Source){
 if(Player.Inv > 0 || Mode !== 'play') return false;
 if(Math.random() < Stats.Evasion){FloatText(Player.X, Player.Y - 22, 'dodge', '#4ff0d6'); Player.Inv = .25; return false}
 const Def = EffDefense(), Taken = Math.max(1, Amount * (1 - Def / (Def + 25)));
 Player.Hp -= Taken; Player.Inv = .5; Shake = Math.max(Shake, 6); PlaySfx('Hurt');
 FloatText(Player.X, Player.Y - 22, '-' + Math.round(Taken), '#ff5d73'); Burst(Player.X, Player.Y, '#ff5d73', 8, 150, .4);
 if(Source){
  const Dx = Player.X - Source.X, Dy = Player.Y - Source.Y, Len = Math.hypot(Dx, Dy) || 1;
  Player.KnockX = Dx / Len * 230; Player.KnockY = Dy / Len * 230;
  if(Stats.Thorn) DamageEnemy(Source, Stats.Thorn);
 }
 if(Player.Hp <= 0) PlayerDie();
 return true;
}

function PlayerDie(){
 Mode = 'dying'; DyingTime = 1; Player.Hp = 0; Shake = 16;
 Burst(Player.X, Player.Y, '#4ff0d6', 50, 300, .9); Ring(Player.X, Player.Y, '#4ff0d6', 90, .6); Enemies = [];
}

function Volley(Target){
 const Owned = ElemNames.filter(N => Elem[N] > 0), Count = Stats.Projectile;
 for(let I = 0; I < Count; I++){
  const Name = Owned[(Shots + I) % Owned.length], Lv = Elem[Name], Crit = Math.random() < Stats.CriticalChance;
  const Angle = Aim + (I - (Count - 1) / 2) * .18;
  const Speed = Stats.ProjectileSpeed * (Name === 'Wind' ? 1.3 : Name === 'Earth' ? .8 : 1);
  const Dmg = EffDamage() * (Name === 'Earth' ? 1.25 : 1) * (Crit ? 2 + Stats.CriticalDamage : 1);
  Bolts.push({
   X: Player.X, Y: Player.Y, Vx: Math.cos(Angle) * Speed, Vy: Math.sin(Angle) * Speed, Damage: Dmg, Elem: Name, Lv, Crit,
   Life: (Stats.Range + 40) / Speed, Pierce: Stats.Piercing + (Name === 'Wind' ? Math.floor((Lv + 1) / 2) : 0), Hit: [],
   Size: (Name === 'Earth' ? 6 : Name === 'Wind' ? 3 : 4) * (1 + Stats.ProjectileSize),
   Knock: Stats.Knockback + (Name === 'Earth' ? 30 * Lv : 0), Ow: CurOwner
  });
  LastElem = Name;
 }
 Shots += Count; Player.Cooldown = 1 / EffFireRate(); Player.Recoil = 1; PlaySfx('Shoot');
 Burst(Player.X + Math.cos(Aim) * 20, Player.Y + Math.sin(Aim) * 20, Elems[LastElem].Color, 3, 120, .15);
}

/* ---------- screens ---------- */
function CardHtml(Offer, Index, Animate){
 let Color, Label, Glyph, Name, Text;
 if(Offer.Kind === 'Elem'){
  const E = Elems[Offer.Name], Lv = Elem[Offer.Name];
  Color = E.Color; Glyph = ElemIcon(Offer.Name, 34); Name = Offer.Name;
  Label = Lv ? 'Element · Lv ' + Lv + ' → ' + (Lv + 1) : 'Element · Unlock';
  Text = E.Desc;
 }else{
  Color = RarityColors[Offer.Tier]; Label = RarityNames[Offer.Tier]; Glyph = Offer.Item.Glyph; Name = Offer.Item.Name; Text = ItemText(Offer.Item, Offer.Tier);
 }
 return `<button class="Card ${Animate ? 'In' : ''} ${Offer.Tier >= 3 ? 'Shine' : ''}" style="--Index:${Index};border-color:${Color};box-shadow:0 0 16px ${Color}44" data-pick="${Index}"><div class="Glyph" style="color:${Color}">${Glyph}</div><em style="color:${Color}">${Label}</em><b>${Name}</b><span>${Text}</span></button>`;
}

function StatsHtml(){
 const ElemLine = ElemNames.map(N => `<div style="color:${Elems[N].Color}">${ElemIcon(N, 12)} ${N}<b>Lv ${Elem[N]}</b></div>`).join('');
 return `<details><summary>Stats · Level ${Player.Level} · HP ${Math.ceil(Player.Hp)}/${Stats.MaximumHealth}</summary><div class="StatGrid">${ElemLine}${StatList.map(S => `<div>${S[1]}<b>${S[2](Stats[S[0]] ?? 0)}</b></div>`).join('')}</div></details>`;
}

function OpenLevel(){
 Mode = 'level'; Joys.Move = null; Joys.Aim = null; Offers = RollOffers(); RenderLevel(true);
}

function RenderLevel(Animate){
 Ui.className = 'On';
 Ui.innerHTML = `<div class="Box Wide"><h2>Level ${Player.Level - Pending + 1}</h2><p>Choose 1 of 5 upgrades${Pending > 1 ? ' (' + Pending + ' pending)' : ''}.</p>
 <div class="Cards">${Offers.map((O, I) => CardHtml(O, I, Animate)).join('')}</div>
 <div class="Row"><button class="Btn Alt" data-act="reroll" ${Rerolls <= 0 ? 'disabled' : ''}>Reroll (${Rerolls}/3 left)</button></div>${StatsHtml()}</div>`;
}

function Pause(){
 if(Mode === 'play'){
  Mode = 'pause'; Joys.Move = null; Joys.Aim = null; Ui.className = 'On';
  Ui.innerHTML = `<div class="Box"><h2>Paused</h2><p>Round ${Round} · ${ObjectiveText()}</p><div class="Row"><button class="Btn" data-act="resume">Resume</button><button class="Btn Alt" data-act="menu">Quit to menu</button></div>${StatsHtml()}</div>`;
 }else if(Mode === 'pause'){Mode = 'play'; Ui.className = ''}
}

Ui.addEventListener('click', Ev => {
 const Button = Ev.target.closest('button'); if(!Button) return;
 PlaySfx('Shop');
 const Data = Button.dataset;
 if(Data.pick !== undefined && Mode === 'level'){
  ApplyOffer(Offers[+Data.pick]); Pending--;
  if(Pending > 0){Offers = RollOffers(); RenderLevel(true)}
  else{HostLevelDone()}
 }else if(Data.act === 'reroll' && Rerolls > 0){Rerolls--; Offers = RollOffers(); RenderLevel(true)}
 else if(Data.mode){SelMode = Data.mode; ShowMenu()}
 else if(Data.elem){SelElem = Data.elem; ShowMenu()}
 else if(Data.act === 'resume') Pause();
 else if(Data.act === 'menu'){if(Party.On) PartyLeave(); Mode = 'menu'; Player = null; ShowMenu()}
 else if(Data.act === 'play'){
  if(InputMode === 'touch'){
   try{document.documentElement.requestFullscreen().then(() => screen.orientation.lock('landscape')).catch(() => {})}catch(Err){}
  }
  NewRun();
 }
});

const FormatTime = S => Math.floor(S / 60) + ':' + String(Math.floor(S % 60)).padStart(2, '0');

function GameOver(Won){
 PlaySfx(Won ? 'Victory' : 'GameOver');
 Mode = 'over';
 const Key = ModeKey, Score = Math.floor(RunStats.Time);
 if(Won || Score > (Best[Key] || 0)){if(Score > (Best[Key] || 0)){Best[Key] = Score; StorageSet('ShapeSwarmBest2', JSON.stringify(Best))}}
 Ui.className = 'On';
 Ui.innerHTML = `<div class="Box"><h1>${Won ? 'Victory' : 'Defeated'}</h1><p>${ModeKey} · best time ${FormatTime(Best[Key] || 0)}</p>
 <div class="Summary"><div>Round<b>${Round}</b></div><div>Level<b>${Player.Level}</b></div><div>Kills<b>${RunStats.Kills}</b></div><div>Damage<b>${Math.round(RunStats.Damage)}</b></div><div>Time<b>${FormatTime(RunStats.Time)}</b></div><div>Element<b>${SelElem}</b></div></div>
 <div class="Row"><button class="Btn" data-act="play">Play again</button><button class="Btn Alt" data-act="menu">Menu</button></div></div>`;
}

function ShowMenu(){
 const Fresh = !Ui.querySelector('.MenuWrap');
 Ui.className = 'On';
 const ModeColor = {Standard: '#4ff0d6', Quickplay: '#ffc857', Endless: '#9b7bff'};
 const ModeCards = Object.keys(Modes).map(K => {
  const M = Modes[K], Rd = M.Total ? M.Total / M.RoundLen + ' rounds' : 'Until you fall';
  return `<button class="Pick ModeCard ${K === SelMode ? 'Sel' : ''}" style="--Chip:${ModeColor[K] || '#4ff0d6'}" data-mode="${K}"><span class="PBig">${M.Total ? M.Info : '∞'}</span><b class="PName">${K}</b><span class="PSub">${Rd}</span><span class="PBest">${Best[K] ? 'Best ' + FormatTime(Best[K]) : 'No record yet'}</span></button>`;
 }).join('');
 const ElemCards = ElemNames.map(N => {
  const E = Elems[N], Parts = E.Desc.split('. ');
  return `<button class="Pick ElemCard ${N === SelElem ? 'Sel' : ''}" style="--Chip:${E.Color}" data-elem="${N}"><span class="EGlyph">${ElemIcon(N, 22)}</span><span class="EText"><b class="PName">${N}</b><span class="PSub">${Parts[0]}</span><span class="PPerk">${(Parts[1] || '').replace(/\.$/, '')}</span><span class="PSub" style="color:#c9d0ff">${Parts[2] || ''}</span></span></button>`;
 }).join('');
 const Glyphs = ElemNames.map(N => `<span>${ElemIcon(N, 22)}</span>`).join('');
 const Hints = InputMode === 'touch'
  ? '<span class="Hint"><kbd>Left stick</kbd>move</span><span class="Hint"><kbd>Right stick</kbd>aim + fire</span><span class="Hint"><kbd>Button</kbd>auto-aim</span>'
  : '<span class="Hint"><kbd>WASD</kbd>move</span><span class="Hint"><kbd>Mouse</kbd>aim</span><span class="Hint"><kbd>Click</kbd>or<kbd style="margin-left:4px">Space</kbd>fire</span><span class="Hint"><kbd>Shift</kbd>dash</span><span class="Hint"><kbd>E</kbd>nova</span><span class="Hint"><kbd>Q</kbd>auto-aim</span><span class="Hint"><kbd>P</kbd>pause</span><span class="Hint"><kbd>Enter</kbd>play</span>';
const WS = TreeHtml();
 const MutDef = {Glass: ['Glass Cannon', 'Half max HP, +60% damage'], Heavy: ['Heavy Core', '-25% move speed, +35% damage'], Frenzy: ['Frenzy', '+50% fire rate, -25% max HP'], Swarm: ['Swarm', 'Waves grow 25% harder'], Fast: ['Fast Foes', 'Enemies move 25% faster'], Armored: ['Armored', 'Enemies +40% HP, you gain +30% XP'], Volatile: ['Volatile', 'Dying enemies blast you within 90px'], Elite: ['Elite Rush', 'A tough elite spawns every 25s'], Blood: ['Blood Pact', 'Drain 1.5% HP/s (cancels regen), heal 1.2% per kill'], NoRegen: ['No Regen', 'All health regeneration disabled']};
 const MutChips = Object.keys(MutDef).map(K => `<button class="Pick ${Mut[K] ? 'Sel' : ''}" style="--Chip:#ff5d73" data-mut="${K}"><span class="PName">${MutDef[K][0]}</span><span class="PSub">${MutDef[K][1]}</span></button>`).join('');
 const Bst = Best[SelMode] ? ' · best <b>' + FormatTime(Best[SelMode]) + '</b>' : '';
 Ui.innerHTML = `<div class="MenuWrap ${Fresh ? 'Enter' : ''}">
 <div class="MHero">
  <div class="Glyphs Rise" style="--d:0">${Glyphs}</div>
  <h1 class="Rise" style="--d:1">Geometrical<br>Onslaught</h1>
  <p class="Lead Rise" style="--d:2">Master Fire, Water, Earth and Wind. Every round has an objective: complete it for a bonus upgrade, fail it and lose health.</p>
  <div class="Rise" style="--d:3"><div class="PlayRow"><button class="PlayBtn" data-act="setup"><span>▶</span>Singleplayer</button><button class="PlayBtn Alt" data-act="mp"><span>👥</span>Multiplayer</button></div>${ContinueHtml()}<div><button class="Ghost" data-act="play" style="margin:10px 0 0">⚡ Quick start · ${SelMode} · ${SelDiff} · ${SelElem}</button></div></div>
  <div class="Loadout Rise" style="--d:4"><b>${SelMode}</b> · starting with <b style="color:${Elems[SelElem].Color}">${SelElem}</b>${Bst}</div>
  ${JoinCard()}
  ${MenuNote ? '<div class="Note">' + MenuNote + '</div>' : ''}
 </div>
 <div class="MPanels Tab_${MenuTab}"><div class="Tabs Rise" style="--d:1"><button class="TabBtn ${MenuTab === 'shop' ? 'On' : ''}" data-tab="shop">Upgrade Tree</button><button class="TabBtn ${MenuTab === 'rank' ? 'On' : ''}" data-tab="rank">Ranking</button></div>
  <div class="Panel Rise T-run" style="--d:2"><div class="PTitle">Mode</div><div class="PGrid3">${ModeCards}</div></div>
  <div class="Panel Rise T-run" style="--d:3"><div class="PTitle">Starting element</div><div class="PGrid2">${ElemCards}</div></div>
  <div class="Panel Rise T-shop" style="--d:4"><div class="PTitle">Infinite upgrade tree <b style="float:right;color:var(--Amber)">◆ ${Meta.Shards} shards</b></div><div class="TreeScroll">${WS}</div></div>
  <div class="Panel Rise T-mut" style="--d:5"><div class="PTitle">Mutators <b style="float:right;color:var(--Coral)">+20% shards each</b></div><div class="PGrid2 WsScroll">${MutChips}</div></div>
 <div class="Panel Rise T-rank" style="--d:2">${BoardHtml()}</div>
 </div>
 <div class="MFoot Rise" style="--d:5"><div>${Hints}</div><div><button class="Ghost" data-act="acct">${Acct ? '☁ ' + HtmlEsc(PublicName()) : '☁ Sign in'}</button><button class="Ghost" data-act="settings">Settings</button></div></div>
</div>`;
 MenuNote = '';
}

/* >>> SHAPE-SWARM-UPDATE START (v2): saves + export/import + upgrade fixes + objectives + enemies + difficulty */

/* =====================================================================
   1. RUN SAVES - one resumable slot per mode, overwritten by each new run
   ===================================================================== */
const SaveKeyPrefix = 'ShapeSwarmRun_', SaveVersion = 1;
let SaveWarned = false, MenuNote = '', HordeT = 60, LastObjType = null;

/* Storage layer. To move saves to Firebase/Drive later, replace only Get and Set
   (a cloud version is async, so the callers below would need await). */
const SaveStore = {
  Get(ModeName){
    try{const Raw = StorageGet(SaveKeyPrefix + ModeName); return Raw ? JSON.parse(Raw) : null}catch(Err){return null}
  },
  Set(ModeName, Data){
    try{StorageSet(SaveKeyPrefix + ModeName, JSON.stringify(Data)); return true}catch(Err){return false}
  }
};

function ValidSave(S){
  return !!S && S.V === SaveVersion && !!S.Player && !!S.Stats && !!S.Elem && !!S.Obj && !!S.RunStats &&
    typeof S.Round === 'number' && Number.isFinite(S.Player.Hp);
}

function SnapshotRun(){
  return {
    V: SaveVersion, SavedAt: Date.now(), Over: false,
    ModeKey, SelElem, AutoAim, HordeT, LastObjType,
    Round, Rounds, RoundTime, Diff, SpawnTimer, Time, Pending, Rerolls, Shots, LastElem, ObjKills,
    Obj, Player, Stats, Elem, RunStats, Enemies, EnemyBolts, Pickups, Crystals, Zone, Camera, Offers, DSeed: Dg.Seed, DOpen: Dg.Chests.map(C => C.Open ? 1 : 0),
    Bolts: Bolts.map(B => ({...B, Hit: []}))
  };
}

function SaveRun(){
  if(!Player || !Stats || !['play', 'pause', 'level'].includes(Mode)) return false;
  const Ok = SaveStore.Set(ModeKey, SnapshotRun());
  if(!Ok && !SaveWarned){SaveWarned = true; ShowBanner('Saving unavailable', 'Browser storage is blocked', '#ff5d73')}
  return Ok;
}

/* a finished run keeps its data but can no longer be continued */
function FinishSave(){
  const S = SaveStore.Get(ModeKey);
  if(S && !S.Over){S.Over = true; SaveStore.Set(ModeKey, S)}
}

function LoadRun(ModeName){
  const S = SaveStore.Get(ModeName);
  if(!ValidSave(S) || S.Over || !Modes[ModeName]) return false;
  try{
    SelMode = ModeKey = ModeName; SelElem = S.SelElem || SelElem; AutoAim = !!S.AutoAim;
    HordeT = S.HordeT ?? 45; LastObjType = S.LastObjType ?? null;
    Round = S.Round; Rounds = S.Rounds; RoundTime = S.RoundTime; Diff = S.Diff; SpawnTimer = S.SpawnTimer; Time = S.Time;
    Pending = S.Pending; Rerolls = S.Rerolls; Shots = S.Shots; LastElem = S.LastElem; ObjKills = S.ObjKills;
    Obj = S.Obj; Player = S.Player; Stats = S.Stats; Elem = S.Elem; RunStats = S.RunStats;
    Enemies = S.Enemies || []; Bolts = S.Bolts || []; EnemyBolts = S.EnemyBolts || [];
    Pickups = S.Pickups || []; Crystals = S.Crystals || []; Zone = S.Zone || null;
    Camera = S.Camera || {X: Player.X, Y: Player.Y}; Offers = S.Offers || [];
    Particles = []; Texts = []; ActiveBanner = null; Shake = 0; HpView = Player.Hp;
    GenDungeon(S.DSeed ?? ((Math.random() * 2 ** 31) | 0)); Dg.Seen.fill(0); (S.DOpen || []).forEach((V, I) => {if(Dg.Chests[I]) Dg.Chests[I].Open = !!V});
    for(const O of [Player, ...Enemies, ...Pickups, ...Crystals, ...(Zone ? [Zone] : [])]){const Pq = Place(O.X, O.Y); O.X = Pq.X; O.Y = Pq.Y}
    Camera = {X: Player.X, Y: Player.Y}; FlowUpdate();
    Mode = 'play'; Ui.className = '';
    Pause(); /* resume into the pause screen so the player is never dropped into live combat */
    return true;
  }catch(Err){return false}
}

/* menu: Continue button + Export/Import buttons */
function ContinueHtml(){
  const S = SaveStore.Get(SelMode);
  if(!ValidSave(S) || S.Over) return '';
  return `<button class="Cont" data-act="continue"><b>Continue ${SelMode}</b><span>Round ${S.Round} · Lv ${S.Player.Level} · ${FormatTime(S.RunStats.Time)}</span></button>`;
}

/* capture phase: runs before the game's own click handler */
Ui.addEventListener('click', Ev => {
  const Button = Ev.target.closest('button'); if(!Button) return;
  switch(Button.dataset.act){
    case 'menu': SaveRun(); break;
    case 'continue': if(!LoadRun(SelMode)) ShowMenu(); break;
  }
}, true);

setInterval(SaveRun, 2000);
addEventListener('pagehide', SaveRun);
document.addEventListener('visibilitychange', () => {if(document.hidden) SaveRun()});

/* a new run overwrites that mode's slot at once; game over closes it */
const NewRunBase = NewRun;
NewRun = function(){HordeT = 60; LastObjType = null; NewRunBase(); SaveRun()};
const GameOverBase = GameOver;
GameOver = function(Won){FinishSave(); GameOverBase(Won)};

/* =====================================================================
   3. UPGRADE FIXES
   - whole-number stats (Extra bolt, Piercer) only exist at tiers where the
     value is strictly different, so rarity always means "strictly better"
   - Plating (Defense) no longer rounds to the same number on neighbouring tiers
   - upgrades for stats that are already capped are no longer offered
   ===================================================================== */
const IntRules = {
  Projectile: {3: 1, 5: 2},          /* Epic +1, Mythical +2 */
  Piercing:   {2: 1, 4: 2}           /* Rare +1, Legendary +2 */
};
const DefenseItem = Items.find(I => I.Key === 'Defense');
if(DefenseItem) delete DefenseItem.IsInt;

function SnapTier(Key, Tier){
  let BestTier = -1;
  for(const T of Object.keys(IntRules[Key])) if(+T <= Tier && +T > BestTier) BestTier = +T;
  return BestTier;
}

ItemValue = function(It, Tier){
  const Rule = IntRules[It.Key];
  if(Rule) return Rule[Tier] ?? 0;
  /* 3 decimals: the original rounded to 2, so Leech Common (1.5%) and Uncommon (2.25%) both became 2% */
  return It.IsInt ? IntTier[Tier] * It.Value : Math.round(It.Value * TierMult[Tier] * 1000) / 1000;
};

RollOffers = function(){
  const Open = ElemNames.filter(N => Elem[N] < 5), Out = [];
  if(Open.length) Out.push({Kind: 'Elem', Name: Open[Math.floor(Math.random() * Open.length)]});
  const Pool = Shuffle([...Items.map(It => ({Kind: 'Item', Item: It})), ...Open.map(N => ({Kind: 'Elem', Name: N}))]);
  for(const P of Pool){
    if(Out.length >= 5) break;
    if(P.Kind === 'Elem'){
      if(Out.some(O => O.Kind === 'Elem' && O.Name === P.Name)) continue;
      Out.push(P); continue;
    }
    const Key = P.Item.Key, Cap = StatCaps[Key];
    if(Cap !== undefined && Stats[Key] >= Cap) continue;
    let Tier = RollTier();
    if(IntRules[Key]){Tier = SnapTier(Key, Tier); if(Tier < 0) continue}
    Out.push({Kind: 'Item', Item: P.Item, Tier});
  }
  return Shuffle(Out);
};

/* =====================================================================
   4. DIFFICULTY - gentle start, nightmare finish (Standard / Quickplay),
      straight line in Endless. Recomputed every frame so it climbs smoothly.
   ===================================================================== */
const DiffCurves = {
  Standard:  {Lo: .75, Hi: 7.0, K: 1.8},
  Quickplay: {Lo: .85, Hi: 5.5, K: 1.6}
};

function DiffNow(){
  const Cfg = Modes[ModeKey], Frac = Clamp(1 - RoundTime / Cfg.RoundLen, 0, 1), Pos = (Round - 1) + Frac;
  if(!Cfg.Total) return .9 + Pos * .3;                                  /* Endless: linear */
  const C = DiffCurves[ModeKey] || DiffCurves.Standard, P = Clamp(Pos / Rounds, 0, 1);
  return C.Lo + (C.Hi - C.Lo) * Math.pow(P, C.K);
}
function UpdateDifficulty(){Diff = DiffNow() * (Obj && Obj.Type === 'survive' && !Obj.Done ? 1.15 : 1)}

/* late-game "Horde incoming" bursts */
function HordeTick(Dt){
  HordeT -= Dt;
  if(HordeT > 0 || Diff < 2.2) return;
  const Count = Math.min(40, Math.round(6 + Diff * 2.2));
  for(let I = 0; I < Count && Enemies.length < 140; I++) SpawnEnemy(PickType());
  ShowBanner('Horde incoming', 'Hold the line', '#ff5d73'); Shake = Math.max(Shake, 6);
  HordeT = Math.max(24, 62 - Diff * 5);
}

/* =====================================================================
   5. NEW ENEMIES (kinds 5-9) - added after the five original kinds
   ===================================================================== */
if(EnemyTypes.length === 5){
  EnemyTypes.push(
    {Hp: 34, Speed: 46,  Radius: 14, Damage: 9,  Sides: 6,  Color: '#6df0a0', XpValue: 5},  /* 5 Splitter: splits into 2 Shards on death */
    {Hp: 8,  Speed: 135, Radius: 6,  Damage: 4,  Sides: 3,  Color: '#6df0a0', XpValue: 1},  /* 6 Shard: fast, tiny (only from Splitters) */
    {Hp: 22, Speed: 44,  Radius: 11, Damage: 7,  Sides: 4,  Color: '#ffa14f', XpValue: 6},  /* 7 Sniper: stops at range and shoots */
    {Hp: 42, Speed: 52,  Radius: 13, Damage: 13, Sides: 7,  Color: '#ff2e88', XpValue: 7},  /* 8 Charger: telegraphs, then dashes */
    {Hp: 15, Speed: 85,  Radius: 10, Damage: 10, Sides: 12, Color: '#ffd23b', XpValue: 4}   /* 9 Bomber: explodes on contact or death */
  );
}
const HuntNames = {0: 'chasers', 1: 'swifts', 2: 'heavies', 5: 'splitters', 7: 'snipers', 8: 'chargers', 9: 'bombers'};

/* [minimum difficulty, kind, weight] - each kind fades in over 1.2 difficulty above its minimum */
const SpawnTable = [[0, 0, 100], [1.0, 1, 38], [1.4, 5, 24], [1.7, 2, 26], [2.1, 9, 20], [2.6, 7, 18], [3.2, 8, 18], [3.8, 3, 20]];
PickType = function(){
  if(Obj && Obj.Type === 'hunt' && !Obj.Done && Math.random() < .45) return Obj.Kind;
  let Total = 0;
  const W = SpawnTable.map(([Min, Kind, Weight]) => {
    const Ramp = Min === 0 ? 1 : Clamp((Diff - Min) / 1.2, 0, 1);
    const V = Weight * Ramp * (Kind === 0 ? 1 / (1 + Diff * .25) : 1);
    Total += V; return V;
  });
  let R = Math.random() * Total;
  for(let I = 0; I < W.length; I++){R -= W[I]; if(R <= 0) return SpawnTable[I][1]}
  return 0;
};

/* cap late-game contact damage so a single hit is never an instant kill */
const SpawnEnemyBase = SpawnEnemy;
SpawnEnemy = function(Kind, Elite){
  SpawnEnemyBase(Kind, Elite);
  const En = Enemies[Enemies.length - 1];
  if(En && En.Kind === Kind) En.Damage = Math.min(En.Damage, EnemyTypes[Kind].Damage * 2.6);
};

function SplitEnemy(En){
  if(Enemies.length > 150) return;
  for(let I = 0; I < 2; I++){
    SpawnEnemy(6);
    const S = Enemies[Enemies.length - 1];
    S.X = Clamp(En.X + (I ? 14 : -14), 10, Arena - 10); S.Y = Clamp(En.Y + RandRange(-10, 10), 10, Arena - 10);
    S.SpawnLeft = S.SpawnTotal = .2;
  }
}
function Explode(En){
  Ring(En.X, En.Y, '#ffd23b', 90, .4); Burst(En.X, En.Y, '#ffd23b', 22, 240, .5); Shake = Math.max(Shake, 5);
  if(Mode === 'play' && Math.hypot(En.X - Player.X, En.Y - Player.Y) < 85) HurtPlayer(En.Damage * 1.4, En);
}

/* per-frame behaviours for the new enemy kinds (runs after the normal update) */
function EnemyBehaviors(Dt){
  for(const En of Enemies){
    if(En.Dead || En.SpawnLeft > 0) continue;
    const Dx = Player.X - En.X, Dy = Player.Y - En.Y, Dist = Math.hypot(Dx, Dy) || 1;
    if(En.BaseSpeed === undefined) En.BaseSpeed = En.Speed;
    if(En.Kind === 7){                                   /* Sniper */
      En.Speed = Dist < 300 ? 0 : En.BaseSpeed;
      En.ShotT = (En.ShotT ?? RandRange(1, 2.4)) - Dt;
      if(En.ShotT <= 0 && Dist < 460 && !(En.StunT > 0)){
        EnemyShot(En, Math.atan2(Dy, Dx)); En.ShotT = Math.max(1.1, 2.6 - Diff * .12);
      }
    }else if(En.Kind === 8){                             /* Charger */
      En.ChargeT = (En.ChargeT ?? RandRange(2, 4)) - Dt;
      if(En.Windup > 0){
        En.Speed = 0; En.Windup -= Dt;
        if(En.Windup <= 0){En.KnockX += Dx / Dist * 520; En.KnockY += Dy / Dist * 520; Burst(En.X, En.Y, En.Color, 8, 160, .3); En.Speed = En.BaseSpeed}
      }else if(En.ChargeT <= 0 && Dist < 420 && !(En.StunT > 0)){
        En.Windup = .55; En.ChargeT = Math.max(2.2, 4.5 - Diff * .2); En.Speed = 0; Ring(En.X, En.Y, En.Color, En.Radius * 3, .55);
      }
    }else if(En.Kind === 9){                             /* Bomber: fuse on contact */
      if(Dist < PlayerRadius + En.Radius + 6){En.Dead = true; En.Hp = 0; KillEnemy(En)}
    }
  }
}
const UpdateBase = Update;
Update = function(Dt){
  UpdateBase(Dt);
  if(Mode === 'play' && Player) EnemyBehaviors(Dt);
};

const KillEnemyBase = KillEnemy;
KillEnemy = function(En){
  KillEnemyBase(En);
  if(Obj && !Obj.Done){
    if(Obj.Type === 'hunt' && En.Kind === Obj.Kind) Obj.Have++;
    if(Obj.Type === 'boss' && En.Kind === 4 && !En.Elite) Obj.Have = 1;
  }
  if(En.Kind === 5) SplitEnemy(En);
  if(En.Kind === 9) Explode(En);
};

/* =====================================================================
   6. OBJECTIVES - 10 types (was 4)
   slay, gather, elite, zone (original) + survive, flawless, hunt, harvest,
   ambush (relics that spring an ambush) and boss (every 5th round)
   ===================================================================== */
const ObjPool = ['slay', 'gather', 'elite', 'zone', 'survive', 'flawless', 'hunt', 'harvest', 'ambush'];
const HuntPool = [[0, 1], [1, 2], [5, 3], [9, 4], [2, 4], [7, 5], [8, 6]];   /* [kind, earliest round] */

function PickObjective(){
  if(Round === 1) return 'slay';
  const Pool = ObjPool.filter(T => T !== LastObjType && !(T === 'hunt' && Round < 2) && !(T === 'flawless' && Round < 3));
  return Pool[Math.floor(Math.random() * Pool.length)];
}

StartRound = function(){
  const Cfg = Modes[ModeKey], Boss = Round % 5 === 0;
  RoundTime = Cfg.RoundLen; Diff = DiffNow(); SpawnTimer = .5; ObjKills = 0;
  Enemies = Enemies.filter(En => !En.Elite); Crystals = []; Zone = null; NewDungeon();
  const Type = Boss ? 'boss' : PickObjective();
  LastObjType = Type;
  Obj = {Type, Have: 0, Need: 1, Done: false};
  if(Type === 'slay') Obj.Need = Math.round(22 + Round * 7);
  if(Type === 'gather' || Type === 'ambush'){
    Obj.Need = Type === 'ambush' ? 4 : 5;
    if(Type === 'ambush'){Obj.Type = 'gather'; Obj.Ambush = true; Obj.Seen = 0}
    for(let I = 0; I < Obj.Need; I++) Crystals.push(Object.assign(RandFloor(), {Phase: RandRange(0, Tau)}));
  }
  if(Type === 'elite') SpawnEnemy(4, true);
  if(Type === 'zone'){
    Obj.Need = 22 + Round * 2;
    const A = RandRange(0, Tau);
    Zone = ZonePlace();
  }
  if(Type === 'survive') Obj.Need = Math.round(Cfg.RoundLen * .7);
  if(Type === 'flawless') Obj.Need = Math.min(45, 16 + Round * 2);
  if(Type === 'hunt'){
    const Open = HuntPool.filter(H => Round >= H[1]);
    Obj.Kind = Open[Math.floor(Math.random() * Open.length)][0];
    Obj.Need = Math.min(30, 8 + Round);
  }
  if(Type === 'harvest') Obj.Need = 20 + Round * 3;
  if(Type === 'boss') SpawnEnemy(4, false);
  ShowBanner('Round ' + Round, Boss ? 'Boss incoming' : ObjectiveName(), '#4ff0d6');
};

ObjectiveName = function(){
  if(!Obj) return '';
  if(Obj.Ambush) return 'Seize the relics';
  if(Obj.Type === 'hunt') return 'Hunt ' + (HuntNames[Obj.Kind] || 'targets');
  return ({slay: 'Slay enemies', gather: 'Collect the crystals', elite: 'Defeat the elite', zone: 'Hold the zone',
    survive: 'Survive', flawless: 'Stay untouched', harvest: 'Collect XP orbs', boss: 'Defeat the boss'})[Obj.Type] || 'Objective';
};
ObjectiveText = function(){
  const Timed = Obj.Type === 'zone' || Obj.Type === 'survive' || Obj.Type === 'flawless';
  const Prog = Math.floor(Obj.Have) + '/' + Obj.Need + (Timed ? 's' : '');
  return Obj.Done ? ObjectiveName() + ' ✔' : ObjectiveName() + ' ' + Prog;
};

const ObjectiveTickBase = ObjectiveTick;
ObjectiveTick = function(Dt){
  UpdateDifficulty();
  if(Obj && !Obj.Done && (Obj.Type === 'survive' || Obj.Type === 'flawless')) Obj.Have += Dt;
  ObjectiveTickBase(Dt);                                 /* handles crystals, zone and the completion reward */
  if(Obj && Obj.Ambush && !Obj.Done && Obj.Have > (Obj.Seen || 0)){
    Obj.Seen = Obj.Have;
    const Count = 3 + Math.floor(Round / 3);
    for(let I = 0; I < Count && Enemies.length < 140; I++) SpawnEnemy(PickType());
    ShowBanner('Ambush!', 'The relic was a trap', '#ff5d73'); Shake = Math.max(Shake, 5);
  }
  HordeTick(Dt);
};

const HurtPlayerBase = HurtPlayer;
HurtPlayer = function(Amount, Source){
  const Hit = HurtPlayerBase(Amount, Source);
  if(Hit && Obj && Obj.Type === 'flawless' && !Obj.Done) Obj.Have = 0;
  return Hit;
};

const GainXpBase = GainXp;
GainXp = function(V){
  if(Obj && Obj.Type === 'harvest' && !Obj.Done) Obj.Have++;
  GainXpBase(V);
};

/* <<< SHAPE-SWARM-UPDATE END */

/* ---------- input ---------- */
const Joys = {Move: null, Aim: null}, Keys = {};
let MouseX = 0, MouseY = 0, Trigger = false, Firing = false;
const AimBtn = () => ({X: Width - 138, Y: SafeTop + 48, W: 122, H: 32});

function JoyMove(J, Ev){
 let Dx = Ev.clientX - J.Ox, Dy = Ev.clientY - J.Oy;
 const L = Math.hypot(Dx, Dy);
 if(L > JoyRadius){Dx = Dx / L * JoyRadius; Dy = Dy / L * JoyRadius}
 J.Dx = Dx; J.Dy = Dy;
}

Canvas.addEventListener('pointerdown', Ev => {
 if(Ev.pointerType !== 'mouse') InputMode = 'touch';
 if(Mode !== 'play') return;
 const B = AimBtn();
 if(Ev.clientX >= B.X && Ev.clientX <= B.X + B.W && Ev.clientY >= B.Y && Ev.clientY <= B.Y + B.H){AutoAim = !AutoAim; return}
 const Gr = GearBtn();
 if(InputMode === 'touch' && Ev.clientX >= Gr.X && Ev.clientX <= Gr.X + Gr.W && Ev.clientY >= Gr.Y && Ev.clientY <= Gr.Y + Gr.H){Joys.Move = null; Joys.Aim = null; Pause(); if(Mode === 'pause' || Party.MenuOpen) RenderSettings(); return}
 if(Ev.pointerType === 'mouse' && Ev.button === 0) Trigger = true;
 if(InputMode !== 'touch') return;
 for(const [N, X, Y] of TouchBtns()) if(Math.hypot(Ev.clientX - X, Ev.clientY - Y) < 36){N === 'Dash' ? Dash() : Nova(); return}
 const Side = ((Ev.clientX < Width / 2) !== Settings.Lefty) ? 'Move' : 'Aim';
 if(Joys[Side]) return;
 Joys[Side] = {Id: Ev.pointerId, Ox: Ev.clientX, Oy: Ev.clientY, Dx: 0, Dy: 0};
 try{Canvas.setPointerCapture(Ev.pointerId)}catch(Err){}
});

Canvas.addEventListener('pointermove', Ev => {
 if(Ev.pointerType === 'mouse'){InputMode = 'key'; Joys.Move = null; Joys.Aim = null; MouseX = Ev.clientX; MouseY = Ev.clientY; return}
 for(const K of ['Move', 'Aim']) if(Joys[K] && Joys[K].Id === Ev.pointerId) JoyMove(Joys[K], Ev);
});

const PointerUp = Ev => {for(const K of ['Move', 'Aim']) if(Joys[K] && Joys[K].Id === Ev.pointerId) Joys[K] = null};
Canvas.addEventListener('pointerup', PointerUp);
Canvas.addEventListener('pointercancel', PointerUp);
Canvas.addEventListener('contextmenu', Ev => Ev.preventDefault());
addEventListener('pointerup', Ev => {if(Ev.pointerType === 'mouse') Trigger = false});
addEventListener('pointercancel', Ev => {if(Ev.pointerType === 'mouse') Trigger = false});

addEventListener('keydown', Ev => {
 const Tgt = Ev.target; if(Tgt && (Tgt.tagName === 'INPUT' || Tgt.tagName === 'TEXTAREA' || Tgt.tagName === 'SELECT' || Tgt.isContentEditable)) return;
 const Key = Ev.key.toLowerCase();
 if(Key === 'm' && !Ev.repeat){ToggleSound(); return}
 if(('wasd'.includes(Key) && Key.length === 1) || Key.startsWith('arrow')){InputMode = 'key'; Keys[Key] = 1; Ev.preventDefault()}
 else if(Key === 'shift' && !Ev.repeat) Dash();
 else if(Key === 'e' && !Ev.repeat) Nova();
 else if(Key === ' ' && Mode === 'play'){Keys[' '] = 1; Ev.preventDefault()}
 else if(Key === 'u' && !Ev.repeat && Party.On) PartyUpgradeToggle();
 else if(Key === 'q' && Mode === 'play') AutoAim = !AutoAim;
 else if(Key === 'enter' && !Ev.repeat && (Mode === 'menu' || Mode === 'over')){const Go = Ui.querySelector('[data-act="play"]'); if(Go){Ev.preventDefault(); Go.click()}}
 else if((Key === 'p' || Key === 'escape') && !Ev.repeat) Pause();
});
addEventListener('keyup', Ev => {Keys[Ev.key.toLowerCase()] = 0});
addEventListener('blur', () => {Trigger = false; for(const K in Keys) Keys[K] = 0; if(Mode === 'play') Pause()});

/* ---------- update ---------- */
function Update(Dt){
 Time += Dt; RunStats.Time += Dt;
 let Mx = (Keys['d'] || Keys['arrowright'] ? 1 : 0) - (Keys['a'] || Keys['arrowleft'] ? 1 : 0), My = (Keys['s'] || Keys['arrowdown'] ? 1 : 0) - (Keys['w'] || Keys['arrowup'] ? 1 : 0);
 if(Joys.Move){Mx += Joys.Move.Dx / JoyRadius; My += Joys.Move.Dy / JoyRadius}
 let Len = Math.hypot(Mx, My); if(Len > 1){Mx /= Len; My /= Len; Len = 1}
 const Speed = Player.Down ? 0 : EffSpeed();
 MoveW(Player, (Mx * Speed + Player.KnockX) * Dt, (My * Speed + Player.KnockY) * Dt, PlayerRadius);
 Player.KnockX *= Math.max(0, 1 - 9 * Dt); Player.KnockY *= Math.max(0, 1 - 9 * Dt);
 Player.Inv -= Dt; Player.Recoil = Math.max(0, Player.Recoil - Dt * 8);
 Player.Hp = Player.Down ? 0 : Math.min(Stats.MaximumHealth, Player.Hp + Stats.Regeneration * Dt);
 if(Len > .2 && Math.random() < .6 && Particles.length < ParticleCap) Particles.push({X: Player.X - Mx * 10, Y: Player.Y - My * 10, Vx: -Mx * 30, Vy: -My * 30, Life: .3, MaxLife: .3, Color: Elems[LastElem].Color, Size: 2});

 /* round flow */
 RoundTime -= Dt;
 ObjectiveTick(Dt);
 if(RoundTime <= 0){EndRound(); if(Mode !== 'play') return}
 SpawnTimer -= Dt;
 if(SpawnTimer <= 0 && Enemies.length < 130){
  const Count = 1 + Math.floor(Diff / 2.5);
  for(let I = 0; I < Count; I++) SpawnEnemy(PickType());
  SpawnTimer = Math.max(.25, .9 / (1 + (Diff - 1) * .6));
 }

 /* aim & fire */
 Player.Cooldown -= Dt; Player.DashCd = Math.max(0, (Player.DashCd || 0) - Dt); Player.NovaCd = Math.max(0, (Player.NovaCd || 0) - Dt);
 let Target = null, NearDist = Stats.Range;
 for(const En of Enemies){
  if(En.SpawnLeft > 0) continue;
  const Dist = Math.hypot(En.X - Player.X, En.Y - Player.Y) - En.Radius;
  if(Dist < NearDist){NearDist = Dist; Target = En}
 }
 if(AutoAim){if(Target) Aim = Math.atan2(Target.Y - Player.Y, Target.X - Player.X)}
 else if(InputMode === 'touch'){const J = Joys.Aim; if(J && Math.hypot(J.Dx, J.Dy) > 10) Aim = Math.atan2(J.Dy, J.Dx)}
 else Aim = Math.atan2(MouseY - (Height / 2 + (Player.Y - Camera.Y) * Zoom), MouseX - (Width / 2 + (Player.X - Camera.X) * Zoom));
 /* auto-aim fires by itself when something is in range; manual aim fires only while you hold the trigger */
 const Holding = InputMode === 'touch' ? !!(Joys.Aim && Math.hypot(Joys.Aim.Dx, Joys.Aim.Dy) > 10) : (Trigger || !!Keys[' ']);
 Firing = AutoAim ? !!Target : Holding;
 if(Player.Cooldown <= 0 && Firing && !Player.Down) Volley(Target);

 /* enemies */
 for(const En of Enemies){
  En.Flash -= Dt; En.Rot += Dt * (En.Kind === 4 ? .6 : 1.2);
  if(En.SpawnLeft > 0){En.SpawnLeft -= Dt; continue}
  if(En.Burn){
   En.Burn.T -= Dt; En.BurnTick -= Dt;
   if(En.BurnTick <= 0){En.BurnTick = .5; DamageEnemy(En, En.Burn.Dps * .5, false, undefined, undefined, Elems.Fire.Color)}
   if(En.Burn.T <= 0) En.Burn = null;
  }
  En.SlowT -= Dt; En.StunT -= Dt;
  const Tg = NearT(En.X, En.Y), Dx = Tg.X - En.X, Dy = Tg.Y - En.Y, Dist = Math.hypot(Dx, Dy) || 1;
  let Spd = En.Speed * (En.SlowT > 0 ? 1 - En.SlowPct : 1);
  if(En.StunT > 0) Spd = 0;
  if(En.Kind === 3){if(Dist < 170) Spd = -Spd * .7; else if(Dist < 230) Spd = 0}
  if(En.Kind === 1) En.Rot = Math.atan2(Dy, Dx) + Math.PI / 2;
  const Cv = ChaseVec(En, Dx, Dy, Dist); MoveW(En, (Cv.X * Spd + En.KnockX) * Dt, (Cv.Y * Spd + En.KnockY) * Dt, Math.min(En.Radius * .7, 22));
  En.KnockX *= Math.max(0, 1 - 7 * Dt); En.KnockY *= Math.max(0, 1 - 7 * Dt);
  if(En.Kind >= 3 && En.StunT <= 0){
   En.Cooldown -= Dt;
   if(En.Cooldown <= 0){
    if(En.Kind === 3) EnemyShot(En, Math.atan2(Dy, Dx));
    else{for(let I = 0; I < 12; I++) EnemyShot(En, I / 12 * Tau + En.Rot); Ring(En.X, En.Y, En.Color, En.Radius * 2, .4)}
    En.Cooldown = En.Kind === 4 ? 2.4 : 2.2;
   }
  }
 }

 /* solid collisions: enemy vs enemy, enemy vs player */
 for(let I = 0; I < Enemies.length; I++){
  const A = Enemies[I]; if(A.SpawnLeft > 0) continue;
  for(let J = I + 1; J < Enemies.length; J++){
   const B = Enemies[J]; if(B.SpawnLeft > 0) continue;
   const Dx = B.X - A.X, Dy = B.Y - A.Y, Reach = A.Radius + B.Radius;
   if(Math.abs(Dx) < Reach && Math.abs(Dy) < Reach){
    const Dist = Math.hypot(Dx, Dy) || 1;
    if(Dist < Reach){
     const Over = Reach - Dist, MassA = A.Radius * A.Radius, MassB = B.Radius * B.Radius, WeightA = MassB / (MassA + MassB), WeightB = MassA / (MassA + MassB);
     A.X -= Dx / Dist * Over * WeightA; A.Y -= Dy / Dist * Over * WeightA; B.X += Dx / Dist * Over * WeightB; B.Y += Dy / Dist * Over * WeightB;
    }
   }
  }
  const Dx = Player.X - A.X, Dy = Player.Y - A.Y, Dist = Math.hypot(Dx, Dy) || 1, Reach = A.Radius + PlayerRadius;
  if(Dist < Reach + 2) HurtPlayer(A.Damage, A);
  if(Dist < Reach && Mode !== 'dying'){
   const Over = Reach - Dist, MassA = A.Radius * A.Radius, PlayerShare = MassA / (MassA + PlayerRadius * PlayerRadius * 1.5);
   MoveW(Player, Dx / Dist * Over * PlayerShare, Dy / Dist * Over * PlayerShare, PlayerRadius);
   A.X -= Dx / Dist * Over * (1 - PlayerShare); A.Y -= Dy / Dist * Over * (1 - PlayerShare);
  }
 }
 PartyContact();
 if(Mode === 'dying') return;

 /* bolts */
 for(const Bt of Bolts){
  Bt.X += Bt.Vx * Dt; Bt.Y += Bt.Vy * Dt; Bt.Life -= Dt;
  for(const En of Enemies){
   if(En.SpawnLeft > 0 || En.Hp <= 0 || Bt.Hit.includes(En) || Math.hypot(En.X - Bt.X, En.Y - Bt.Y) >= En.Radius + Bt.Size) continue;
   Bt.Hit.push(En); DamageEnemy(En, Bt.Damage, Bt.Crit, Bt.Vx, Bt.Vy, Elems[Bt.Elem].Color, Bt.Knock);
   const OR = Bt.Ow ? RemoteBy(Bt.Ow) : null, OS = OR ? OR.S : Stats, OP = OR ? OR.P : Player;
   ApplyElement(En, Bt);
   if(OS.Lifesteal) OP.Hp = Math.min(OS.MaximumHealth, OP.Hp + Bt.Damage * OS.Lifesteal);
   if(OS.BlastRadius){
    Ring(En.X, En.Y, Elems[Bt.Elem].Color, OS.BlastRadius, .25);
    for(const Other of Enemies){
     if(Other !== En && Other.Hp > 0 && Other.SpawnLeft <= 0 && Math.hypot(Other.X - En.X, Other.Y - En.Y) < OS.BlastRadius + Other.Radius) DamageEnemy(Other, Bt.Damage * .5, false, Other.X - En.X, Other.Y - En.Y, undefined, OS.Knockback);
    }
   }
   if(Bt.Pierce <= 0){Bt.Life = 0; break}
   Bt.Pierce--;
  }
 }
 for(const Eb of EnemyBolts){
  Eb.X += Eb.Vx * Dt; Eb.Y += Eb.Vy * Dt; Eb.Life -= Dt;
  if(Math.hypot(Eb.X - Player.X, Eb.Y - Player.Y) < PlayerRadius){HurtPlayer(Eb.Damage); Eb.Life = 0} else PartyBolt(Eb)
 }
 if(Mode === 'dying') return;
 Enemies = Enemies.filter(En => En.Hp > 0);
 Bolts = Bolts.filter(Bt => Bt.Life > 0 && !Solid(Bt.X, Bt.Y));
 EnemyBolts = EnemyBolts.filter(Eb => Eb.Life > 0 && !Solid(Eb.X, Eb.Y));

 /* experience orbs */
 for(const Pk of Pickups){
  Pk.X += Pk.Vx * Dt; Pk.Y += Pk.Vy * Dt; Pk.Vx *= 1 - 5 * Dt; Pk.Vy *= 1 - 5 * Dt;
  const Tg = NearT(Pk.X, Pk.Y), Dx = Tg.X - Pk.X, Dy = Tg.Y - Pk.Y, Dist = Math.hypot(Dx, Dy) || 1;
  if(Dist < Tg.S.PickupRange){Pk.X += Dx / Dist * 340 * Dt; Pk.Y += Dy / Dist * 340 * Dt}
  if(Dist < PlayerRadius + 4){PartyXp(Tg, Pk.Value); Pk.Value = 0; Burst(Tg.X, Tg.Y, '#4ff0d6', 3, 90, .3)}
 }
 Pickups = Pickups.filter(Pk => Pk.Value > 0);
 if(Pending > 0 && Mode === 'play') OpenLevel();
}

/* ---------- draw ---------- */
function Poly(X, Y, Radius, Sides, Rot){
 Context.beginPath();
 if(!Sides){Context.arc(X, Y, Radius, 0, Tau); return}
 for(let I = 0; I < Sides; I++){
  const Angle = Rot + I / Sides * Tau - Math.PI / 2;
  Context[I ? 'lineTo' : 'moveTo'](X + Math.cos(Angle) * Radius, Y + Math.sin(Angle) * Radius);
 }
 Context.closePath();
}

function Shape(X, Y, Radius, Sides, Rot, Color, Fill){
 Poly(X, Y, Radius, Sides, Rot); Context.fillStyle = Fill || Color + '44'; Context.fill();
 Context.strokeStyle = Color; Context.lineWidth = 2; Context.stroke();
}

function Draw(){
 Context.setTransform(Dpr, 0, 0, Dpr, 0, 0); Context.fillStyle = '#0d1020'; Context.fillRect(0, 0, Width, Height);
 if(!Player){DrawAttract(); return}
 const Sx = RandRange(-1, 1) * Shake * (ShakeOn ? 1 : 0), Sy = RandRange(-1, 1) * Shake * (ShakeOn ? 1 : 0);
 Context.setTransform(Dpr * Zoom, 0, 0, Dpr * Zoom, Dpr * (Width / 2 - Camera.X * Zoom + Sx), Dpr * (Height / 2 - Camera.Y * Zoom + Sy));
 DrawDungeon();

 if(Zone){
  Context.globalAlpha = .12 + .05 * Math.sin(Time * 3); Context.fillStyle = '#ffc857'; Poly(Zone.X, Zone.Y, Zone.R, 0); Context.fill();
  Context.globalAlpha = .8; Context.strokeStyle = '#ffc857'; Context.lineWidth = 3; Context.stroke(); Context.globalAlpha = 1;
 }
 for(const C of Crystals){
  if(C.Got) continue;
  Context.save(); Context.translate(C.X, C.Y + Math.sin(Time * 3 + C.Phase) * 3);
  Shape(0, 0, 11, 4, Math.PI / 4, '#4ff0d6', '#4ff0d655'); Context.restore();
 }
 for(const Pk of Pickups){
  const Spin = Math.abs(Math.cos(Time * 5 + Pk.Phase));
  Context.save(); Context.translate(Pk.X, Pk.Y + Math.sin(Time * 4 + Pk.Phase) * 2); Context.scale(.25 + .75 * Spin, 1);
  Shape(0, 0, 5, 4, Math.PI / 4, '#4ff0d6', '#4ff0d6'); Context.restore();
 }
 for(const En of Enemies){
  if(En.SpawnLeft > 0){
   const Progress = 1 - En.SpawnLeft / En.SpawnTotal;
   Context.globalAlpha = .6; Context.strokeStyle = En.Color; Context.lineWidth = 1.5; Poly(En.X, En.Y, En.Radius * (2.2 - 1.2 * Progress), 0); Context.stroke();
   Shape(En.X, En.Y, En.Radius * Progress, En.Sides, En.Rot, En.Color); Context.globalAlpha = 1; continue;
  }
  const Squash = 1 + Math.max(0, En.Flash) * 2 + (En.Kind === 0 ? Math.sin(Time * 6 + En.X) * .04 : 0);
  Shape(En.X, En.Y, En.Radius * Squash, En.Sides, En.Rot, En.Color, En.Flash > 0 ? '#ffffff' : null);
  if(En.Elite){Context.strokeStyle = '#ffc857'; Context.lineWidth = 2; Poly(En.X, En.Y, En.Radius + 7 + Math.sin(Time * 5) * 2, 0); Context.stroke()}
  if(En.Burn){Context.fillStyle = Elems.Fire.Color; Context.beginPath(); Context.arc(En.X, En.Y - En.Radius - 3, 2.5, 0, Tau); Context.fill()}
  if(En.SlowT > 0){Context.strokeStyle = Elems.Water.Color; Context.lineWidth = 1.5; Poly(En.X, En.Y, En.Radius + 3, 0); Context.stroke()}
  if(En.StunT > 0){Context.strokeStyle = Elems.Earth.Color; Context.lineWidth = 2; Poly(En.X, En.Y, En.Radius + 5, 4, Time * 6); Context.stroke()}
  if(En.Hp < En.MaxHp){
   Context.fillStyle = '#000a'; Context.fillRect(En.X - En.Radius, En.Y - En.Radius - 9, En.Radius * 2, 3);
   Context.fillStyle = '#ff5d73'; Context.fillRect(En.X - En.Radius, En.Y - En.Radius - 9, En.Radius * 2 * En.Hp / En.MaxHp, 3);
  }
 }
 for(const M of Meteor){Context.strokeStyle = '#ffc857'; Context.fillStyle = '#ffc857'; Context.lineWidth = 3; Context.globalAlpha = .75; Poly(M.X, M.Y, M.R, 0); Context.stroke(); Context.globalAlpha = .22; Context.beginPath(); Context.arc(M.X, M.Y, M.R * (1 - M.T / 1.1), 0, Tau); Context.fill(); Context.globalAlpha = 1}
 for(const En of Enemies){
  if(En.SpawnLeft > 0) continue;
  if(En.Shield > 0){Context.strokeStyle = '#4fb4ff'; Context.lineWidth = 2; Context.globalAlpha = .4 + .6 * En.Shield / En.MaxHp; Poly(En.X, En.Y, En.Radius + 4, 0); Context.stroke(); Context.globalAlpha = 1}
  if(En.Trait === 'healer'){Context.strokeStyle = '#4ade80'; Context.lineWidth = 3; Context.beginPath(); Context.moveTo(En.X - 5, En.Y); Context.lineTo(En.X + 5, En.Y); Context.moveTo(En.X, En.Y - 5); Context.lineTo(En.X, En.Y + 5); Context.stroke()}
  if(En.Tele > 0){Context.globalAlpha = .6; Context.strokeStyle = '#ff5d73'; Context.lineWidth = 2; Context.setLineDash([6, 6]); Context.beginPath(); Context.moveTo(En.X, En.Y); Context.lineTo(Player.X, Player.Y); Context.stroke(); Context.setLineDash([]); Context.globalAlpha = 1}
  if(En.Boss){Context.fillStyle = En.Color; Context.font = '700 14px "Chakra Petch",sans-serif'; Context.textAlign = 'center'; Context.fillText(En.Boss, En.X, En.Y - En.Radius - 16);
   if(En.Cast){Context.fillStyle = '#ff5d73'; Context.fillText(En.Cast, En.X, En.Y - En.Radius - 32)}
   if(En.SlamT > 0){Context.strokeStyle = '#ff5d73'; Context.lineWidth = 3; Context.globalAlpha = .7; Poly(En.X, En.Y, 110, 0); Context.stroke(); Context.globalAlpha = .25; Context.fillStyle = '#ff5d73'; Context.beginPath(); Context.arc(En.X, En.Y, 110 * (1 - En.SlamT / .9), 0, Tau); Context.fill(); Context.globalAlpha = 1}
  }
 }
 for(const Eb of EnemyBolts){
  Context.globalAlpha = .5; Context.strokeStyle = '#ff8fd0'; Context.lineWidth = 2; Context.beginPath(); Context.moveTo(Eb.X - Eb.Vx * .04, Eb.Y - Eb.Vy * .04); Context.lineTo(Eb.X, Eb.Y); Context.stroke();
  Context.globalAlpha = 1; Shape(Eb.X, Eb.Y, 4, 0, 0, '#ff8fd0', '#ff8fd0');
 }
 for(const Bt of Bolts){
  const Color = Elems[Bt.Elem].Color;
  Context.globalAlpha = .5; Context.strokeStyle = Color; Context.lineWidth = Bt.Size; Context.beginPath(); Context.moveTo(Bt.X - Bt.Vx * (Bt.Elem === 'Wind' ? .07 : .03), Bt.Y - Bt.Vy * (Bt.Elem === 'Wind' ? .07 : .03)); Context.lineTo(Bt.X, Bt.Y); Context.stroke();
  Context.globalAlpha = 1; Shape(Bt.X, Bt.Y, Bt.Crit ? Bt.Size + 1 : Bt.Size, BoltSides(Bt.Elem), 0, Color, Bt.Crit ? '#ffc857' : '#ffffff');
 }
 for(const Pt of Particles){
  const Fade = Pt.Life / Pt.MaxLife; Context.globalAlpha = Fade;
  if(Pt.Ring){Context.strokeStyle = Pt.Color; Context.lineWidth = 2; Poly(Pt.X, Pt.Y, Pt.Size * (1 - Fade) + 3, 0); Context.stroke()}
  else{Context.fillStyle = Pt.Color; Context.beginPath(); Context.arc(Pt.X, Pt.Y, Pt.Size * (.4 + .6 * Fade), 0, Tau); Context.fill()}
 }
 Context.globalAlpha = 1;
 DrawParty();
 if(Mode !== 'dying' && !Player.Down && !(Player.Inv > 0 && Math.floor(Player.Inv * 24) % 2)){
  const Pulse = Math.sin(Time * 5) * .8, Core = Elems[LastElem].Color;
  if(Mode === 'play'){
   Context.globalAlpha = .12 + .04 * Math.sin(Time * 3); Context.strokeStyle = Core; Context.lineWidth = 1; Poly(Player.X, Player.Y, Stats.Range, 0); Context.stroke();
   if(!AutoAim){Context.globalAlpha = .25; Context.setLineDash([6, 8]); Context.beginPath(); Context.moveTo(Player.X, Player.Y); Context.lineTo(Player.X + Math.cos(Aim) * Stats.Range, Player.Y + Math.sin(Aim) * Stats.Range); Context.stroke(); Context.setLineDash([])}
   Context.globalAlpha = 1;
  }
  Shape(Player.X, Player.Y, PlayerRadius + Pulse, 0, 0, Core);
  Shape(Player.X, Player.Y, 7, 6, Time * 1.5, Core, Core);
  const BarrelLen = 21 - Player.Recoil * 3;
  Context.strokeStyle = '#e8ecff'; Context.lineWidth = 3; Context.beginPath();
  Context.moveTo(Player.X + Math.cos(Aim) * 13, Player.Y + Math.sin(Aim) * 13); Context.lineTo(Player.X + Math.cos(Aim) * BarrelLen, Player.Y + Math.sin(Aim) * BarrelLen); Context.stroke();
 }
 Context.font = '700 13px "Chakra Petch",sans-serif'; Context.textAlign = 'center';
 for(const Tx of Texts){Context.globalAlpha = Math.min(1, Tx.Life * 3); Context.fillStyle = Tx.Color; Context.fillText(Tx.Text, Tx.X, Tx.Y)}
 Context.globalAlpha = 1;
 DrawHud();
}

function ObjectiveTargets(){
 const T = [];
 for(const C of Crystals) if(!C.Got) T.push(C);
 for(const En of Enemies) if(En.Elite) T.push(En);
 if(Zone) T.push(Zone);
 return T;
}

function DrawJoy(J, Hx, Hy, Label){
 const X = J ? J.Ox : Hx, Y = J ? J.Oy : Hy, Alpha = J ? .9 : .3;
 Context.globalAlpha = Alpha * .7; Context.fillStyle = '#4ff0d622'; Context.strokeStyle = '#e8ecff'; Context.lineWidth = 2;
 Context.beginPath(); Context.arc(X, Y, JoyRadius, 0, Tau); Context.fill(); Context.stroke();
 Context.globalAlpha = Alpha; Context.fillStyle = '#4ff0d6'; Context.beginPath(); Context.arc(X + (J ? J.Dx : 0), Y + (J ? J.Dy : 0), 22, 0, Tau); Context.fill();
 if(!J){Context.fillStyle = '#e8ecff'; Context.font = '700 12px "Chakra Petch",sans-serif'; Context.textAlign = 'center'; Context.fillText(Label, X, Y + JoyRadius + 16)}
 Context.globalAlpha = 1;
}

function DrawHud(){
 Context.setTransform(Dpr, 0, 0, Dpr, 0, 0);
 if(Player.Inv > .3){Context.fillStyle = '#ff5d7326'; Context.fillRect(0, 0, Width, Height)}
 const BarW = Math.min(Width - 300, 320), BarX = (Width - BarW) / 2, BarY = 12 + SafeTop;

 /* health & xp */
 Context.fillStyle = '#000a'; Context.fillRect(BarX, BarY, BarW, 14);
 Context.fillStyle = '#ffffff88'; Context.fillRect(BarX, BarY, BarW * Clamp(HpView / Stats.MaximumHealth, 0, 1), 14);
 Context.fillStyle = Player.Hp / Stats.MaximumHealth < .3 && Math.floor(Time * 6) % 2 ? '#ffffff' : '#ff5d73'; Context.fillRect(BarX, BarY, BarW * Clamp(Player.Hp / Stats.MaximumHealth, 0, 1), 14);
 Context.fillStyle = '#4ff0d6'; Context.fillRect(BarX, BarY + 16, BarW * Clamp(Player.Xp / XpNeeded(Player.Level), 0, 1), 3);
 Context.fillStyle = '#e8ecff'; Context.textAlign = 'center'; Context.font = '700 12px "Chakra Petch",sans-serif';
 Context.fillText(Math.ceil(Player.Hp) + ' / ' + Math.round(Stats.MaximumHealth), Width / 2, BarY + 11);

 /* round, objective, level */
 Context.textAlign = 'left'; Context.font = '700 17px "Chakra Petch",sans-serif'; Context.fillText('Round ' + Round + (Rounds ? '/' + Rounds : ''), 16, BarY + 14);
 Context.fillStyle = Obj.Done ? '#1eff00' : '#ffc857'; Context.font = '700 13px "Chakra Petch",sans-serif'; Context.fillText(ObjectiveText(), 16, BarY + 32);
 Context.fillStyle = '#4ff0d6'; Context.fillText('Lv ' + Player.Level, 16, BarY + 50);
 DrawPartyHud(BarY); DrawMinimap();
 const Dc = Math.max(0, Player.DashCd || 0);
 Context.fillStyle = '#ffffff22'; Context.fillRect(16, BarY + 58, 64, 4);
 Context.fillStyle = Dc > 0 ? '#8f98c8' : '#4ff0d6'; Context.fillRect(16, BarY + 58, 64 * (1 - Dc / DashMax()), 4);
 if(InputMode === 'key'){Context.fillStyle = '#8f98c8'; Context.font = '700 11px "Chakra Petch",sans-serif'; Context.fillText(Dc > 0 ? 'Dash' : 'Dash ready · Shift', 88, BarY + 63)}
 const Nc = Math.max(0, Player.NovaCd || 0);
 Context.fillStyle = '#ffffff22'; Context.fillRect(16, BarY + 68, 64, 4);
 Context.fillStyle = Nc > 0 ? '#8f98c8' : '#ffc857'; Context.fillRect(16, BarY + 68, 64 * (1 - Nc / NovaMax()), 4);
 if(InputMode === 'key'){Context.fillStyle = '#8f98c8'; Context.font = '700 11px "Chakra Petch",sans-serif'; Context.fillText(Nc > 0 ? 'Nova ' + Math.ceil(Nc) + 's' : 'Nova ready · E', 88, BarY + 73)}
 const MsK = Object.keys(RM()).filter(K => RM()[K]);
 Context.fillStyle = EventKey ? Events[EventKey].Color : RunDiff().Color; Context.font = '700 11px "Chakra Petch",sans-serif'; Context.fillText((Player.Diff || SelDiff) + (EventKey ? ' · ' + Events[EventKey].Name : ''), 16, BarY + 92);
 if(MsK.length){Context.fillStyle = '#ff9bab'; Context.font = '700 11px "Chakra Petch",sans-serif'; Context.fillText('Mutators: ' + MsK.join(', '), 16, BarY + 106)}

 /* time */
 const Cfg = Modes[ModeKey];
 Context.fillStyle = '#e8ecff'; Context.textAlign = 'right'; Context.font = '700 17px "Chakra Petch",sans-serif';
 Context.fillText(Cfg.Total ? FormatTime(Math.max(0, Cfg.Total - RunStats.Time)) : FormatTime(RunStats.Time), Width - 16, BarY + 14);
 Context.fillStyle = '#8f98c8'; Context.font = '700 12px "Chakra Petch",sans-serif'; Context.fillText('Round ends ' + FormatTime(Math.max(0, RoundTime)), Width - 16, BarY + 30);

 /* auto-aim button */
 const B = AimBtn();
 Context.fillStyle = AutoAim ? '#4ff0d6' : '#151a36'; Context.strokeStyle = '#4ff0d6'; Context.lineWidth = 2;
 Context.beginPath(); Context.roundRect(B.X, B.Y, B.W, B.H, 8); Context.fill(); Context.stroke();
 Context.fillStyle = AutoAim ? '#07131a' : '#e8ecff'; Context.textAlign = 'center'; Context.font = '700 13px "Chakra Petch",sans-serif';
 Context.fillText('Auto-aim: ' + (AutoAim ? 'ON' : 'OFF') + (InputMode === 'key' ? ' (Q)' : ''), B.X + B.W / 2, B.Y + 21);
 if(InputMode === 'touch'){
  const G = GearBtn(), Cx = G.X + G.W / 2, Cy = G.Y + G.H / 2;
  Context.fillStyle = '#151a36'; Context.strokeStyle = '#4ff0d6'; Context.lineWidth = 2; Context.beginPath(); Context.roundRect(G.X, G.Y, G.W, G.H, 8); Context.fill(); Context.stroke();
  Context.strokeStyle = '#e8ecff'; Context.beginPath(); Context.arc(Cx, Cy, 5.5, 0, Tau);
  for(let I = 0; I < 8; I++){const A = I / 8 * Tau; Context.moveTo(Cx + Math.cos(A) * 8, Cy + Math.sin(A) * 8); Context.lineTo(Cx + Math.cos(A) * 11, Cy + Math.sin(A) * 11)}
  Context.stroke();
 }

 if(!AutoAim && Mode === 'play'){
  Context.fillStyle = '#8f98c8'; Context.textAlign = 'right'; Context.font = '700 12px "Chakra Petch",sans-serif';
  Context.fillText(InputMode === 'key' ? 'Hold click / Space to fire' : 'Hold the aim stick to fire', B.X + B.W, B.Y + B.H + 16);
 }
 const OverBtn = MouseX >= B.X && MouseX <= B.X + B.W && MouseY >= B.Y && MouseY <= B.Y + B.H;
 Canvas.style.cursor = (!AutoAim && Mode === 'play' && InputMode === 'key' && !OverBtn) ? 'none' : '';
 if(!AutoAim && Mode === 'play' && InputMode === 'key' && !OverBtn){
  const Rc = Firing ? 8 : 12, Col = Firing ? '#ffffff' : Elems[LastElem].Color;
  Context.strokeStyle = Col; Context.lineWidth = 2; Context.globalAlpha = Firing ? 1 : .85;
  Poly(MouseX, MouseY, Rc, 0); Context.stroke();
  Context.beginPath();
  for(const [Ax, Ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){Context.moveTo(MouseX + Ax * (Rc + 3), MouseY + Ay * (Rc + 3)); Context.lineTo(MouseX + Ax * (Rc + 9), MouseY + Ay * (Rc + 9))}
  Context.stroke(); Context.globalAlpha = 1;
 }

 /* element levels */
 ElemNames.forEach((N, I) => {
  const X = Width / 2 - 100 + I * 52, Y = Height - 26 - SafeBottom;
  Context.globalAlpha = Elem[N] ? 1 : .3; Context.fillStyle = Elems[N].Color; Context.font = '700 14px "Chakra Petch",sans-serif'; Context.textAlign = 'left';
  Poly(X + 6, Y - 5, 7, ElemSides[N], ElemRot[N]); Context.fill(); Context.fillText(Elem[N], X + 19, Y);
 });
 Context.globalAlpha = 1;

 /* arrow to nearest objective target */
 const Targets = ObjectiveTargets();
 if(Targets.length && Mode === 'play'){
  let Near = Targets[0], ND = 1e9;
  for(const T of Targets){const D = Math.hypot(T.X - Player.X, T.Y - Player.Y); if(D < ND){ND = D; Near = T}}
  if(ND * Zoom > Math.min(Width, Height) * .42){
   const A = Math.atan2(Near.Y - Player.Y, Near.X - Player.X), R = Math.min(Width, Height) * .38;
   const Px = Width / 2 + (Player.X - Camera.X) * Zoom + Math.cos(A) * R, Py = Height / 2 + (Player.Y - Camera.Y) * Zoom + Math.sin(A) * R;
   Context.save(); Context.translate(Px, Py); Context.rotate(A); Context.fillStyle = '#ffc857'; Context.beginPath(); Context.moveTo(12, 0); Context.lineTo(-8, -8); Context.lineTo(-8, 8); Context.closePath(); Context.fill(); Context.restore();
  }
 }

 if(ActiveBanner){
  const Progress = ActiveBanner.T / ActiveBanner.Max, Fade = Math.sin(Math.PI * Math.min(1, Progress)), Scale = .85 + .15 * Math.min(1, Progress * 5);
  Context.save(); Context.translate(Width / 2, Height * .3); Context.scale(Scale, Scale); Context.globalAlpha = Math.min(1, Fade * 2.5); Context.textAlign = 'center';
  Context.fillStyle = ActiveBanner.Color; Context.font = '700 44px "Chakra Petch",sans-serif'; Context.fillText(ActiveBanner.Text, 0, 0);
  if(ActiveBanner.Sub){Context.fillStyle = '#e8ecff'; Context.font = '700 20px "Chakra Petch",sans-serif'; Context.fillText(ActiveBanner.Sub, 0, 30)}
  Context.restore(); Context.globalAlpha = 1;
 }

 if(InputMode === 'touch' && Mode === 'play'){
  DrawJoy(Joys.Move, Width * (Settings.Lefty ? .83 : .17), Height - SafeBottom - 90, 'Move'); DrawTouchBtns();
  DrawJoy(Joys.Aim, Width * (Settings.Lefty ? .17 : .83), Height - SafeBottom - 90, 'Aim');
 }
}

let LastTime = 0;
function Loop(Stamp){
 requestAnimationFrame(Loop);
 const Dt = Math.min(.05, (Stamp - LastTime) / 1000 || 0); LastTime = Stamp;
 const Blocked = InputMode === 'touch' && Height > Width;
 if(Player){
  UpdateFx(Dt); HitStop -= Dt; PerfAvg = PerfAvg * .96 + Dt * .04; ParticleCap = Settings.Reduce ? 90 : PerfAvg > .026 ? 140 : [120, 220, 350][Settings.Quality ?? 2];
  if(Party.On && Party.Ready) PartyFrame(Dt, Blocked);
  else if(Mode === 'play' && !Blocked && HitStop <= 0){Update(Dt); BoltFx(Dt); TraitTick(Dt)}
 }else AttractUpdate(Dt);
 Draw();
}

/* ---------- v3: dash, hit-stop, shard workshop, recap + share, perf guard ---------- */
let HitStop = 0, ParticleCap = 350, PerfAvg = .016, LastGain = 0, ShareText = '';
let ShakeOn = StorageGet('ShapeSwarmShake') !== '0', Meta = {Shards: 0, Up: {}};
try{const M = JSON.parse(StorageGet('ShapeSwarmMeta') || 'null'); if(M && typeof M.Shards === 'number') Meta = {Shards: M.Shards, Up: M.Up || {}, Stamp: M.Stamp || 0}}catch(Err){}
const SaveMeta = () => {Meta.Stamp = Date.now(); StorageSet('ShapeSwarmMeta', JSON.stringify(Meta))};
const Workshop = [
 {Key: 'Vigor', Name: 'Vigor', Perk: '+10 max HP', Glyph: '✚', Mult: 1},
 {Key: 'Might', Name: 'Might', Perk: '+1 damage', Glyph: '●', Mult: 1.2},
 {Key: 'Haste', Name: 'Haste', Perk: '+5% fire rate', Glyph: '▲', Mult: 1.5},
 {Key: 'Plate', Name: 'Plating', Perk: '+1 defense', Glyph: '▣', Mult: 1},
 {Key: 'Thrust', Name: 'Thrusters', Perk: '+4% move speed', Glyph: '▶', Mult: 1},
 {Key: 'Magnet', Name: 'Magnet', Perk: '+20 pickup range', Glyph: '◐', Mult: .8},
 {Key: 'Scholar', Name: 'Scholar', Perk: '+6% experience', Glyph: '★', Mult: 1},
 {Key: 'Fortune', Name: 'Fortune', Perk: '+4% luck', Glyph: '♣', Mult: 1.2},
 {Key: 'Leech', Name: 'Leech', Perk: '+0.5% lifesteal', Glyph: '◆', Mult: 1.3},
 {Key: 'Quick', Name: 'Quickstep', Perk: '-0.15s dash cooldown', Glyph: '»', Mult: 1},
 {Key: 'NovaC', Name: 'Nova Core', Perk: '-1.5s nova cooldown', Glyph: '✱', Mult: 1.2},
 {Key: 'Spare', Name: 'Reroll', Perk: '+1 reroll', Glyph: '↻', Mult: 1.5, Max: 3},
 {Key: 'Head', Name: 'Head Start', Perk: '+1 free upgrade pick at run start', Glyph: '⬆', Mult: 2, Max: 3},
 {Key: 'Regen', Name: 'Regeneration', Perk: '+0.25 HP regenerated per second', Glyph: '♥', Mult: 1.2},
 {Key: 'Dodge', Name: 'Evasion', Perk: '+1.5% chance to dodge hits', Glyph: '≋', Mult: 1.4},
 {Key: 'Blast', Name: 'Blast Core', Perk: '+8 blast and nova radius', Glyph: '✺', Mult: 1},
 {Key: 'Banker', Name: 'Banker', Perk: '+5% shards from every run', Glyph: '$', Mult: 1.3},
 {Key: 'Prime', Name: 'Prime', Perk: '+1 level in your starting element', Glyph: '◈', Mult: 2.2, Max: 3}
];
const WorkshopCost = (L, W) => Math.round(([15, 30, 50, 80, 120][L] ?? 0) * (W.Mult || 1));

const NewRunV3 = NewRun;
NewRun = function(){
 NewRunV3();
 Player.Mut = Object.assign({}, Mut); Player.Diff = SelDiff; FillStats(); EliteT = 20;
 ApplyTree();
 if(RM().Glass){Stats.MaximumHealth = Math.round(Stats.MaximumHealth * .5); Player.Hp = Stats.MaximumHealth; Stats.Damage *= 1.6}
 if(RM().NoRegen) Stats.Regeneration = 0;
 if(RM().Heavy){Stats.MovementSpeed *= .75; Stats.Damage *= 1.35}
 if(RM().Frenzy){Stats.FireRate *= 1.5; Stats.MaximumHealth = Math.round(Stats.MaximumHealth * .75); Player.Hp = Math.min(Player.Hp, Stats.MaximumHealth)}
 if(RM().Armored) Stats.ExperienceBonus += .3;
};

function Dash(){
 if(Mode !== 'play' || !Player || (Player.DashCd || 0) > 0) return;
 let Dx = (Keys['d'] || Keys['arrowright'] ? 1 : 0) - (Keys['a'] || Keys['arrowleft'] ? 1 : 0), Dy = (Keys['s'] || Keys['arrowdown'] ? 1 : 0) - (Keys['w'] || Keys['arrowup'] ? 1 : 0);
 if(Joys.Move){Dx += Joys.Move.Dx / JoyRadius; Dy += Joys.Move.Dy / JoyRadius}
 const L = Math.hypot(Dx, Dy);
 if(L < .2){Dx = Math.cos(Aim); Dy = Math.sin(Aim)}else{Dx /= L; Dy /= L}
 Player.KnockX = Dx * 950; Player.KnockY = Dy * 950; Player.Inv = Math.max(Player.Inv, .35); Player.DashCd = DashMax();
 Burst(Player.X, Player.Y, Elems[LastElem].Color, 14, 220, .4); Ring(Player.X, Player.Y, '#ffffff', 40, .3);
 PlayTone(300, .12, 'sawtooth', .08, 720);
}

const KillEnemyV3 = KillEnemy;
KillEnemy = function(En){KillEnemyV3(En);
 if(RM().Volatile){Ring(En.X, En.Y, '#ff8fd0', 90, .3); if(Math.hypot(En.X - Player.X, En.Y - Player.Y) < 90 + En.Radius) HurtPlayer(8)}
 if(RM().Blood) Player.Hp = Math.min(Stats.MaximumHealth, Player.Hp + Stats.MaximumHealth * .012);
 if(En.Kind === 4 || En.Elite){HitStop = .12; Shake = Math.max(Shake, 14)}};

const GameOverV3 = GameOver;
GameOver = function(Won){
 const Prev = Best[ModeKey] || 0, Score = Math.floor(RunStats.Time);
 LastGain = Math.max(1, Math.round((RunStats.Kills / 8 + Round * 4 + RunStats.Time / 30 + (Won ? 25 : 0)) * (1 + .2 * Object.values(RM()).filter(Boolean).length) * (1 + TreeVal('Banker')) * RunDiff().Shards));
 Meta.Shards += LastGain; SaveMeta();
 const Mk = ModeKey, Rd = Round, Lv = Player.Level, Kl = RunStats.Kills, Tm = FormatTime(RunStats.Time), El = SelElem;
 GameOverV3(Won);
 ShareText = 'Geometrical Onslaught · ' + Mk + ' · ' + (Won ? 'Victory' : 'Fell') + ' at round ' + Rd + ' · Lv ' + Lv + ' · ' + Kl + ' kills · ' + Tm + ' with ' + El;
 const Row = Ui.querySelector('.Row'); if(!Row) return;
 Row.insertAdjacentHTML('beforebegin', `<div class="Recap">+${LastGain} shards ◆ (total ${Meta.Shards})${Score > Prev ? '<br>★ New best time!' : ''}</div>`);
 Row.insertAdjacentHTML('beforeend', '<button class="Btn Alt" data-act="share">Share run</button>');
};

Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B) return;
 const D = B.dataset;
 if(D.up){
  for(let K = 0; K < (Ev.shiftKey ? 10 : 1); K++) if(!TreeBuy(D.up)) break;
  ShowMenu(); Ev.stopImmediatePropagation();
 }else if(D.act === 'shake'){
  ShakeOn = !ShakeOn; StorageSet('ShapeSwarmShake', ShakeOn ? '1' : '0'); ShowMenu(); Ev.stopImmediatePropagation();
 }else if(D.act === 'share'){
  (navigator.clipboard ? navigator.clipboard.writeText(ShareText) : Promise.reject()).then(() => {B.textContent = 'Copied!'}).catch(() => {B.textContent = 'Copy failed'});
  Ev.stopImmediatePropagation();
 }
}, true);

/* ---------- v4: settings, music, mutators, synergies, nova, traits, bosses, pause, palette ---------- */
const Settings = Object.assign({Master: .8, Music: .5, Sfx: 1, Shake: true, Reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, Cb: false, Lefty: false, View: 1, Quality: 2, Scale: 1, Fps: 0, ShowFps: false, Dmg: true, Flash: true, Bg: false}, (() => {try{return JSON.parse(StorageGet('ShapeSwarmSettings') || '{}') || {}}catch(Err){return {}}})());
let Mut = Object.assign({Glass: false, Swarm: false, Fast: false, NoRegen: false}, (() => {try{return JSON.parse(StorageGet('ShapeSwarmMut') || '{}') || {}}catch(Err){return {}}})());
let MusicStep = 0, MusicNext = 0;
const CbElem = {Fire: '#D55E00', Water: '#56B4E9', Earth: '#F0E442', Wind: '#009E73'}, CbEnemy = ['#CC79A7', '#F0E442', '#0072B2', '#E69F00', '#D55E00'];
const OrigElem = Object.fromEntries(ElemNames.map(N => [N, Elems[N].Color])), OrigEnemy = EnemyTypes.map(T => T.Color);
const BoltSides = E => Settings.Cb ? {Fire: 3, Water: 0, Earth: 4, Wind: 6}[E] : 0;
function ApplySettings(){
 SfxVol = Settings.Sfx * Settings.Master; ShakeOn = Settings.Shake && !Settings.Reduce;
 document.body.classList.toggle('Reduce', !!Settings.Reduce);
 RenderScale = Clamp(Settings.Scale || 1, .5, 1); ViewScale = Clamp(Settings.View || 1, .6, 1.5); FpsGap = Settings.Fps ? 1000 / Settings.Fps - 1 : 0; if(FpsBox) FpsBox.style.display = Settings.ShowFps ? 'block' : 'none'; Resize();
 ElemNames.forEach(N => {Elems[N].Color = Settings.Cb ? CbElem[N] : OrigElem[N]});
 EnemyTypes.forEach((T, I) => {T.Color = Settings.Cb ? CbEnemy[I] : OrigEnemy[I]});
 StorageSet('ShapeSwarmSettings', JSON.stringify(Settings));
}
ApplySettings();

/* procedural music: tempo and layers follow the round, boss rounds get a darker mix */
function MTone(F, D, T, V, At, F2){
 const A = AudioEngine, O = A.createOscillator(), G = A.createGain(), Vv = Math.max(.0001, V * Settings.Music * Settings.Master);
 O.type = T; O.frequency.setValueAtTime(F, At); O.frequency.exponentialRampToValueAtTime(Math.max(1, F2 || F), At + D);
 G.gain.setValueAtTime(.0001, At); G.gain.exponentialRampToValueAtTime(Vv, At + .01); G.gain.exponentialRampToValueAtTime(.0001, At + D);
 O.connect(G); G.connect(A.destination); O.start(At); O.stop(At + D + .02);
}
function MusicTick(){
 const A = AudioEngine;
 if(!A || A.state !== 'running' || !SoundEnabled || Settings.Music <= 0 || Mode === 'over' || Mode === 'dying') return;
 const Live = Mode === 'play', Boss = Live && Round % 5 === 0, Int = Live ? Math.min(1, Round / 10) : 0, Dur = Boss ? .15 : .22 - .04 * Int;
 if(MusicNext < A.currentTime) MusicNext = A.currentTime + .05;
 while(MusicNext < A.currentTime + .5){
  const I = MusicStep++, Root = [55, 43.65, 65.41, 49][Math.floor(I / 8) % 4], At = MusicNext;
  if(I % 4 === 0) MTone(120, .18, 'sine', .5, At, 42);
  if(I % 2 === 0) MTone(Root * 2, Dur * 1.8, 'triangle', .22, At);
  if(Live || I % 2 === 0) MTone(Root * 8 * [1, 1.2, 1.5, 2][I % 4], Dur, 'square', .05 * (.4 + Int), At);
  if(Boss && I % 8 === 0) MTone(Root * 2.83, Dur * 4, 'sawtooth', .08, At);
  MusicNext += Dur;
 }
}
setInterval(MusicTick, 200);

/* bolt trails per element */
function BoltFx(Dt){
 if(Settings.Quality < 1) return;
 for(const Bt of Bolts){
  if(Particles.length >= ParticleCap || Math.random() > Dt * 45) continue;
  const C = Elems[Bt.Elem].Color, P = {X: Bt.X, Y: Bt.Y, Vx: RandRange(-25, 25), Vy: RandRange(-25, 25), Life: .35, MaxLife: .35, Color: C, Size: 2};
  if(Bt.Elem === 'Fire'){P.Vy = RandRange(-70, -25); P.Size = 2.6; P.Life = P.MaxLife = .45}
  else if(Bt.Elem === 'Water'){P.Vy = RandRange(20, 70); P.Size = 1.8}
  else if(Bt.Elem === 'Earth'){P.Color = '#8a6a3f'; P.Size = 3.4; P.Life = P.MaxLife = .5}
  else{P.Vx = -Bt.Vx * .12; P.Vy = -Bt.Vy * .12; P.Size = 1.5; P.Life = P.MaxLife = .2}
  Particles.push(P);
 }
}

/* element synergies */
const ApplyElementV4 = ApplyElement;
ApplyElement = function(En, Bt){
 const HadBurn = !!En.Burn, HadSlow = En.SlowT > 0, Dps = HadBurn ? En.Burn.Dps : 0;
 ApplyElementV4(En, Bt);
 if(Bt.Elem === 'Wind' && HadBurn){
  for(const O of Enemies) if(O !== En && !O.Burn && O.SpawnLeft <= 0 && Math.hypot(O.X - En.X, O.Y - En.Y) < 90) O.Burn = {T: 2, Dps: Dps * .7};
  Ring(En.X, En.Y, Elems.Fire.Color, 90, .35); FloatText(En.X, En.Y - 20, 'SPREAD', Elems.Fire.Color);
 }
 if(Bt.Elem === 'Earth' && HadSlow){En.StunT = Math.max(En.StunT, 1.2); Ring(En.X, En.Y, Elems.Water.Color, En.Radius * 2.5, .35); FloatText(En.X, En.Y - 20, 'FROZEN', Elems.Water.Color)}
 if(Bt.Elem === 'Water' && HadBurn){
  En.Burn = null; Ring(En.X, En.Y, '#ffffff', 70, .35); FloatText(En.X, En.Y - 20, 'STEAM', '#ffffff');
  for(const O of Enemies) if(O !== En && O.Hp > 0 && O.SpawnLeft <= 0 && Math.hypot(O.X - En.X, O.Y - En.Y) < 70) DamageEnemy(O, Bt.Damage * .6, false, O.X - En.X, O.Y - En.Y, '#ffffff', 40);
 }
};

/* active ability: nova, powered by your strongest element */
function Nova(){
 if(Mode !== 'play' || !Player || (Player.NovaCd || 0) > 0) return;
 const Own = ElemNames.reduce((A, N) => A + Elem[N], 0), Top = ElemNames.reduce((A, N) => Elem[N] > Elem[A] ? N : A, 'Fire'), R = 200 + Stats.BlastRadius, C = Elems[Top].Color;
 Player.NovaCd = NovaMax(); Shake = Math.max(Shake, 10); HitStop = .08;
 Ring(Player.X, Player.Y, C, R, .5); Burst(Player.X, Player.Y, C, 40, 320, .7); PlayTone(160, .4, 'sawtooth', .2, 40);
 for(const En of Enemies){
  if(En.SpawnLeft > 0 || Math.hypot(En.X - Player.X, En.Y - Player.Y) > R + En.Radius) continue;
  DamageEnemy(En, Stats.Damage * (3 + Own * .5) * (1 + (Stats.NovaPower || 0)), false, En.X - Player.X, En.Y - Player.Y, C, Top === 'Wind' ? 260 : 120);
  if(Top === 'Fire') En.Burn = {T: 3, Dps: Stats.Damage};
  if(Top === 'Water'){En.SlowT = 3; En.SlowPct = .5}
  if(Top === 'Earth') En.StunT = 1.2;
 }
}
function TouchBtns(){const S = Settings.Lefty ? -1 : 1, JX = Width * (Settings.Lefty ? .17 : .83), JY = Height - SafeBottom - 90; return [['Dash', JX - S * 90, JY + 22, Player ? Player.DashCd || 0 : 0], ['Nova', JX - S * 50, JY - 84, Player ? Player.NovaCd || 0 : 0]]}
function DrawTouchBtns(){
 for(const [N, X, Y, Cd] of TouchBtns()){
  Context.globalAlpha = .8; Context.fillStyle = Cd > 0 ? '#151a36' : '#4ff0d6'; Context.strokeStyle = '#e8ecff'; Context.lineWidth = 2;
  Context.beginPath(); Context.arc(X, Y, 28, 0, Tau); Context.fill(); Context.stroke();
  Context.fillStyle = Cd > 0 ? '#8f98c8' : '#07131a'; Context.font = '700 12px "Chakra Petch",sans-serif'; Context.textAlign = 'center'; Context.fillText(Cd > 0 ? Math.ceil(Cd) : N, X, Y + 4);
 }
 Context.globalAlpha = 1;
}

/* enemy traits (shield / charger / healer) and boss types (Brute / Summoner / Spinner) */
const DamageEnemyV4 = DamageEnemy;
DamageEnemy = function(En, Amount, ...Rest){
 if(Stats && Stats.Execute && En.Hp < En.MaxHp * .3) Amount *= 1 + Stats.Execute;
 if(En.Shield > 0){
  const Ab = Math.min(En.Shield, Amount); En.Shield -= Ab; Amount -= Ab; Ring(En.X, En.Y, '#4fb4ff', En.Radius * 1.6, .2);
  if(Amount <= 0){En.Flash = .06; PlaySfx('Hit'); return}
 }
 DamageEnemyV4(En, Amount, ...Rest);
};
const SpawnEnemyV4 = SpawnEnemy;
SpawnEnemy = function(Kind, Elite){
 SpawnEnemyV4(Kind, Elite);
 const En = Enemies[Enemies.length - 1]; if(!En) return;
 if(Kind === 4 && !Elite){En.Boss = ['Brute', 'Summoner', 'Spinner'][Math.floor(Round / 5) % 3]; En.Color = {Brute: '#ff3b3b', Summoner: '#9b7bff', Spinner: '#ffc857'}[En.Boss]}
 else if(!Elite && Kind <= 2 && Round >= 3){
  const R = Math.random();
  if(R < .10 * RunDiff().Trait){En.Trait = 'shield'; En.Shield = En.MaxHp * .6}
  else if(R < .17 * RunDiff().Trait) En.Trait = 'charger';
  else if(R < .22 * RunDiff().Trait && Round >= 5) En.Trait = 'healer';
 }
 if(RM().Fast) En.Speed *= 1.25;
 { const DD = RunDiff(); En.Hp *= DD.Hp; En.MaxHp *= DD.Hp; En.Speed *= DD.Speed; En.Damage *= DD.Dmg; if(EventKey === 'BloodMoon') En.Speed *= 1.2; if(EventKey === 'Overcharge'){En.Hp *= 1.2; En.MaxHp *= 1.2} }
 if(Stats.EnemySpeed) En.Speed *= 1 + Stats.EnemySpeed;
 if(RM().Armored){En.Hp *= 1.4; En.MaxHp *= 1.4}
};
function TraitTick(Dt){
 if(RM().Blood) Player.Hp = Math.max(1, Player.Hp - Dt * (Stats.MaximumHealth * .015 + Stats.Regeneration));
 if(RM().Elite){EliteT -= Dt; if(EliteT <= 0){EliteT = 25; SpawnEnemy(2, true)}}
 for(const En of Enemies){
  if(En.SpawnLeft > 0 || En.Hp <= 0) continue;
  if(En.Trait === 'charger'){
   En.TT = (En.TT ?? RandRange(1.5, 3)) - Dt;
   if(En.TT <= 0 && !(En.Tele > 0)){En.Tele = .6; En.BaseSp = En.Speed; En.Speed = 0}
   else if(En.Tele > 0){
    En.Tele -= Dt;
    if(En.Tele <= 0){En.Speed = En.BaseSp; const Dx = Player.X - En.X, Dy = Player.Y - En.Y, L = Math.hypot(Dx, Dy) || 1; En.KnockX = Dx / L * 750; En.KnockY = Dy / L * 750; En.TT = RandRange(2.5, 4)}
   }
  }else if(En.Trait === 'healer'){
   En.TT = (En.TT ?? 1) - Dt;
   if(En.TT <= 0){
    En.TT = 1; Ring(En.X, En.Y, '#4ade80', 140, .5);
    for(const O of Enemies) if(O !== En && O.Hp > 0 && O.Hp < O.MaxHp && Math.hypot(O.X - En.X, O.Y - En.Y) < 140){O.Hp = Math.min(O.MaxHp, O.Hp + O.MaxHp * .06); FloatText(O.X, O.Y - O.Radius, '+', '#4ade80')}
   }
  }else if(false){
   En.TT = (En.TT ?? 4) - Dt;
   if(En.TT <= 0 && Enemies.length < 120){
    En.TT = 5.5; Ring(En.X, En.Y, En.Color, 120, .5);
    for(let I = 0; I < 3; I++){SpawnEnemy(1); const M = Enemies[Enemies.length - 1]; const Pp = Place(En.X + RandRange(-70, 70), En.Y + RandRange(-70, 70)); M.X = Pp.X; M.Y = Pp.Y; M.SpawnLeft = M.SpawnTotal = .4}
   }
  }else if(false){
   En.SpinA = (En.SpinA || 0) + Dt * 1.8; En.SW = (En.SW ?? 0) - Dt;
   if(En.SW <= 0){En.SW = .14; EnemyShot(En, En.SpinA * 3)}
  }
 }
}
if(typeof UpdateDifficulty === 'function'){const UpdateDifficultyV4 = UpdateDifficulty; UpdateDifficulty = function(){UpdateDifficultyV4(); Diff *= RunDiff().Pressure; if(RM().Swarm) Diff *= 1.25}}

/* pause + settings screens */
function RenderPause(){
 const Chips = ElemNames.filter(N => Elem[N]).map(N => `<span class="PChip" style="color:${Elems[N].Color}">${ElemIcon(N, 14)} ${N} Lv ${Elem[N]}</span>`).join('');
 Ui.className = 'On';
 Ui.innerHTML = `<div class="Box"><div class="Panel"><h2>Paused</h2><p>Round ${Round} · ${ObjectiveText()}</p><div class="Chips" style="margin:8px 0 14px">${Chips}</div><div class="Row"><button class="PlayBtn" style="font-size:20px;padding:10px 28px;min-height:48px;animation:none" data-act="resume">Resume</button>${Party.On ? '' : '<button class="Btn Alt" data-act="restart">Restart</button>'}<button class="Btn Alt" data-act="settings">Settings</button><button class="Btn Alt" data-act="menu">Quit to menu</button></div>${StatsHtml()}</div></div>`;
}
const PauseV4 = Pause;
Pause = function(){PauseV4(); if(Mode === 'pause') RenderPause()};
Ui.addEventListener('input', Ev => {const K = Ev.target.dataset && Ev.target.dataset.set; if(K){Settings[K] = Ev.target.value / 100; ApplySettings()}});
Ui.addEventListener('change', Ev => {if(Ev.target.dataset && Ev.target.dataset.set) PlaySfx('Pickup')});
Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B) return;
 const D = B.dataset, Stop = () => Ev.stopImmediatePropagation();
 if(D.mut){Mut[D.mut] = !Mut[D.mut]; StorageSet('ShapeSwarmMut', JSON.stringify(Mut)); ShowMenu(); Stop()}
 else if(D.tog){Settings[D.tog] = !Settings[D.tog]; ApplySettings(); RenderSettings(); Stop()}
 else if(D.act === 'settings'){RenderSettings(); Stop()}
 else if(D.act === 'back'){(Mode === 'pause' || Party.MenuOpen) ? RenderPause() : ShowMenu(); Stop()}
 else if(D.act === 'restart'){NewRun(); Stop()}

}, true);

/* ---------- v5: icons, items, fullscreen, tabs ---------- */
let MenuTab = 'rank', EliteT = 20;
const RM = () => (Player && Player.Mut) || {};
const ElemSides = {Fire: 3, Water: 0, Earth: 4, Wind: 4}, ElemRot = {Fire: 0, Water: 0, Earth: Math.PI / 4, Wind: 0};
function ElemIcon(N, Px){
 const P = {Fire: '<polygon points="12,3 21.5,19.5 2.5,19.5"/>', Water: '<circle cx="12" cy="12" r="9"/>', Earth: '<rect x="4" y="4" width="16" height="16" rx="2.5"/>', Wind: '<polygon points="12,2 22,12 12,22 2,12"/>'}[N];
 return `<svg class="ElemIco" width="${Px}" height="${Px}" viewBox="0 0 24 24" fill="currentColor" style="color:${Elems[N].Color}">${P}</svg>`;
}
const GearBtn = () => ({X: Width - 138 - 44, Y: SafeTop + 48, W: 36, H: 32});
const DashMax = () => Math.max(.4, 1.6 - TreeVal('Quick')) * (1 - Math.min(.5, (Stats && Stats.DashHaste) || 0));
const NovaMax = () => Math.max(4, 14 - TreeVal('NovaC'));
function FillStats(){if(!Stats) return; for(const K of ['DamageMult', 'Execute', 'DashHaste', 'NovaPower', 'OrbHeal', 'EnemySpeed']) if(typeof Stats[K] !== 'number') Stats[K] = 0}
Items.push(
 Item('Overdrive', '✹', 'DamageMult', .08, {IsPct: 1, Unit: 'Damage Bonus'}),
 Item('Executioner', '✖', 'Execute', .12, {IsPct: 1, Unit: 'Execute Bonus'}),
 Item('Quick Dash', '»', 'DashHaste', .08, {IsPct: 1, Unit: 'Dash Haste'}),
 Item('Nova Surge', '✺', 'NovaPower', .15, {IsPct: 1, Unit: 'Nova Power'}),
 Item('Vitality', '❖', 'OrbHeal', .4, {Unit: 'Heal per orb'})
);
StatList.push(['DamageMult', 'Damage Bonus', Percent], ['Execute', 'Execute Bonus', Percent], ['DashHaste', 'Dash Haste', Percent], ['NovaPower', 'Nova Power', Percent], ['OrbHeal', 'Orb Heal', V => Round2(V)]);
StatCaps.DashHaste = .5;
const GainXpV5 = GainXp;
GainXp = function(V){GainXpV5(EventKey === 'BloodMoon' ? V * 2 : V); if(Stats && Stats.OrbHeal && Player && Mode === 'play') Player.Hp = Math.min(Stats.MaximumHealth, Player.Hp + Stats.OrbHeal)};
const LoadRunV5 = LoadRun;
LoadRun = function(M){const Ok = LoadRunV5(M); if(Ok) FillStats(); return Ok};
Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(B && B.dataset.tab){MenuTab = B.dataset.tab; ShowMenu(); Ev.stopImmediatePropagation()}
}, true);

/* phones: go fullscreen + landscape lock as soon as the player holds the phone sideways and taps */
const TouchDevice = matchMedia('(pointer:coarse)').matches;
function TryFullscreen(){
 if(!TouchDevice || innerWidth <= innerHeight || document.fullscreenElement) return;
 try{
  const R = document.documentElement.requestFullscreen({navigationUI: 'hide'});
  if(R && R.then) R.then(() => {try{screen.orientation.lock('landscape').catch(() => {})}catch(Err){}}).catch(() => {});
 }catch(Err){}
}
matchMedia('(orientation:landscape)').addEventListener('change', () => setTimeout(TryFullscreen, 200));
addEventListener('orientationchange', () => setTimeout(TryFullscreen, 300));
addEventListener('click', TryFullscreen, true);
addEventListener('touchend', TryFullscreen, true);
TryFullscreen();

/* ---------- v6: graphics/settings, fps cap, background play, projectile clash, element abilities, fx ---------- */
FpsBox = document.createElement('div'); FpsBox.id = 'FpsBox'; document.body.appendChild(FpsBox);
const FlashEl = document.createElement('div'); FlashEl.id = 'HurtFx'; document.body.appendChild(FlashEl);
let LastFrameT = 0, FpsCount = 0, FpsAt = 0;
const LoopV6 = Loop;
Loop = function(T){
 if(FpsGap && T - LastFrameT < FpsGap){requestAnimationFrame(Loop); return}
 LastFrameT = T; FpsCount++;
 if(T - FpsAt > 500){if(Settings.ShowFps) FpsBox.textContent = Math.round(FpsCount * 1000 / (T - FpsAt)) + ' FPS'; FpsAt = T; FpsCount = 0}
 LoopV6(T);
};
const FloatTextV6 = FloatText;
FloatText = function(...A){if(Settings.Dmg) FloatTextV6(...A)};
const HurtPlayerV6 = HurtPlayer;
HurtPlayer = function(A, S){const H0 = Player ? Player.Hp : 0; HurtPlayerV6(A, S); if(Player && Player.Hp < H0 && Settings.Flash && !Settings.Reduce){FlashEl.classList.remove('On'); void FlashEl.offsetWidth; FlashEl.classList.add('On')}};

/* keep playing while the tab is hidden (browsers may slow hidden tabs) */
let BgLast = performance.now();
setInterval(() => {
 const Now = performance.now(); let D = Math.min(8, (Now - BgLast) / 1000); BgLast = Now;
 if(!document.hidden || !Settings.Bg || Mode !== 'play' || !Player || IsGuest()) return;
 while(D > 0 && Mode === 'play'){const St = Math.min(.05, D); Update(St); TraitTick(St); if(Party.On && Party.Ready) PartyHostTick(St); D -= St}
}, 250);

/* your bolts can destroy enemy shots; earth smashes them without being used up */
const TraitTickV6 = TraitTick;
TraitTick = function(Dt){
 TraitTickV6(Dt);
 for(const Bt of Bolts){
  if(Bt.Life <= 0) continue;
  for(const Eb of EnemyBolts){
   if(Eb.Life <= 0 || Math.hypot(Bt.X - Eb.X, Bt.Y - Eb.Y) > Bt.Size + 6) continue;
   Eb.Life = 0; Ring(Eb.X, Eb.Y, '#ffffff', 18, .2); Burst(Eb.X, Eb.Y, Elems[Bt.Elem].Color, 5, 130, .25);
   if(Bt.Pierce > 0) Bt.Pierce--; else if(Bt.Elem !== 'Earth') Bt.Life = 0;
   if(Bt.Life <= 0) break;
  }
 }
};
const NovaV6 = Nova;
Nova = function(){const Ready = Mode === 'play' && Player && !((Player.NovaCd || 0) > 0); NovaV6(); if(Ready) for(const Eb of EnemyBolts) if(Math.hypot(Eb.X - Player.X, Eb.Y - Player.Y) < 260) Eb.Life = 0};
const DashV6 = Dash;
Dash = function(){const Ready = Mode === 'play' && Player && !((Player.DashCd || 0) > 0); const X0 = Player ? Player.X : 0, Y0 = Player ? Player.Y : 0; DashV6(); if(Ready && Settings.Quality > 0 && Settings.Quality < 3){const Dx = Player.KnockX, Dy = Player.KnockY, L = Math.hypot(Dx, Dy) || 1; for(let I = 1; I <= 6; I++) Particles.push({X: X0 + Dx / L * I * 16, Y: Y0 + Dy / L * I * 16, Vx: 0, Vy: 0, Life: .2 + I * .04, MaxLife: .5, Color: Elems[LastElem].Color, Size: 10 - I})}};

/* level-3 element abilities */
let EmberDepth = 0;
const ApplyElementV6 = ApplyElement;
ApplyElement = function(En, Bt){
 ApplyElementV6(En, Bt);
 if((Elem[Bt.Elem] || 0) < 3) return;
 if(Bt.Elem === 'Water'){En.WH = (En.WH || 0) + 1; if(En.WH % 6 === 0){En.StunT = Math.max(En.StunT, .8); Ring(En.X, En.Y, Elems.Water.Color, En.Radius * 2, .3); FloatText(En.X, En.Y - 20, 'FREEZE', Elems.Water.Color)}}
 else if(Bt.Elem === 'Earth' && En.StunT > 0){DamageEnemy(En, Bt.Damage * .8, false, En.X - Player.X, En.Y - Player.Y, Elems.Earth.Color, 0); FloatText(En.X, En.Y - 20, 'SHATTER', Elems.Earth.Color)}
 else if(Bt.Elem === 'Wind'){
  let Best2 = null, BD = 170;
  for(const O of Enemies) if(O !== En && O.Hp > 0 && O.SpawnLeft <= 0){const D = Math.hypot(O.X - En.X, O.Y - En.Y); if(D < BD){BD = D; Best2 = O}}
  if(Best2){DamageEnemy(Best2, Bt.Damage * .5, false, Best2.X - En.X, Best2.Y - En.Y, Elems.Wind.Color, 30); Ring(Best2.X, Best2.Y, Elems.Wind.Color, 24, .2)}
 }
};
const KillEnemyV6 = KillEnemy;
KillEnemy = function(En){
 KillEnemyV6(En);
 if(En.Burn && (Elem.Fire || 0) >= 3 && EmberDepth < 2){
  EmberDepth++; Ring(En.X, En.Y, Elems.Fire.Color, 80, .35); Burst(En.X, En.Y, Elems.Fire.Color, 12, 220, .4);
  for(const O of Enemies) if(O !== En && O.Hp > 0 && O.SpawnLeft <= 0 && Math.hypot(O.X - En.X, O.Y - En.Y) < 80) DamageEnemy(O, Stats.Damage * .6, false, O.X - En.X, O.Y - En.Y, Elems.Fire.Color, 40);
  EmberDepth--;
 }
};

/* settings screen */
const CycOpts = {Quality: [0, 1, 2], Fps: [0, 30, 45, 60, 90, 120]};
function RenderSettings(){
 const Sl = (K, L, Min = 0, Max = 100) => `<label class="SetRow"><span>${L}</span><input type="range" min="${Min}" max="${Max}" value="${Math.round(Settings[K] * 100)}" data-set="${K}"></label>`;
 const Tg = (K, L, Ds) => `<button class="Pick SetTog ${Settings[K] ? 'Sel' : ''}" data-tog="${K}"><span class="PName">${L} · ${Settings[K] ? 'On' : 'Off'}</span><span class="PSub">${Ds}</span></button>`;
 const Cy = (K, L, Ds, Val) => `<button class="Pick SetTog" data-cyc="${K}"><span class="PName">${L} · ${Val}</span><span class="PSub">${Ds}</span></button>`;
 Ui.className = 'On';
 Ui.innerHTML = `<div class="Box" style="max-width:720px"><h2>Settings</h2>
 <div class="Panel"><div class="PTitle">Audio</div>${Sl('Master', 'Master volume')}${Sl('Music', 'Music')}${Sl('Sfx', 'Sound effects')}</div>
 <div class="Panel" style="margin-top:10px"><div class="PTitle">Graphics</div>${Sl('Scale', 'Render scale', 50)}${Sl('View', 'View distance (zoom out / in; mouse wheel works in game)', 60, 150)}
 <div class="PGrid2" style="margin-top:8px">${Cy('Quality', 'Quality', 'Particles and trails', ['Low', 'Medium', 'High'][Settings.Quality ?? 2])}${Cy('Fps', 'FPS limit', 'Lower saves battery', Settings.Fps || 'Unlimited')}${Tg('ShowFps', 'FPS counter', 'Shown bottom-left')}${Tg('Dmg', 'Damage numbers', 'Floating combat text')}${Tg('Flash', 'Hit flash', 'Red edge flash when hurt')}${Tg('Shake', 'Screen shake', 'Camera kick on big hits')}${Tg('Reduce', 'Reduced motion', 'Fewer animations and particles')}</div></div>
 <div class="Panel" style="margin-top:10px"><div class="PTitle">Play</div><div class="PGrid2">${Tg('Cb', 'Colorblind palette', 'Safe colors and bolt shapes')}${Tg('Lefty', 'Left-handed touch', 'Swap the sticks')}${Tg('Bg', 'Run in background', 'Keeps playing when the tab is hidden; browsers may slow it')}</div></div>
 ${DangerPanel()}<button class="Btn" style="margin-top:14px" data-act="back">Back</button></div>`;
}
Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B || !B.dataset.cyc) return;
 const L = CycOpts[B.dataset.cyc], K = B.dataset.cyc; Settings[K] = L[(L.indexOf(Settings[K]) + 1) % L.length]; ApplySettings(); RenderSettings(); Ev.stopImmediatePropagation();
}, true);
ApplySettings();

/* ---------- v7: pacts (trade-off upgrades) + multi-ability bosses ---------- */
StatList.push(['EnemySpeed', 'Enemy Speed', Percent]);
const Pacts = {
 Reckless: {Name: 'Reckless Aim', Glyph: '☄', Up: '+30% Critical Chance', Down: '-50% Critical Damage', Ok: () => Stats.CriticalChance <= StatCaps.CriticalChance - .2 && Stats.CriticalDamage > -.3, Do(){Stats.CriticalChance = Math.min(StatCaps.CriticalChance, Stats.CriticalChance + .3); Stats.CriticalDamage = Math.max(-.8, Stats.CriticalDamage - .5)}},
 GlassEdge: {Name: 'Glass Edge', Glyph: '◇', Up: '+25% Damage', Down: '-20% Max HP', Ok: () => Stats.MaximumHealth >= 60, Do(){Stats.DamageMult += .25; Stats.MaximumHealth = Math.round(Stats.MaximumHealth * .8); Player.Hp = Math.min(Player.Hp, Stats.MaximumHealth)}},
 Berserker: {Name: 'Berserker', Glyph: '⚔', Up: '+30% Fire Rate', Down: '-15% Move Speed', Ok: () => Stats.MovementSpeed > 90, Do(){Stats.FireRate *= 1.3; Stats.MovementSpeed *= .85}},
 IronHide: {Name: 'Iron Hide', Glyph: '▣', Up: '+3 Defense', Down: '-20% Move Speed', Ok: () => Stats.MovementSpeed > 90, Do(){Stats.Defense += 3; Stats.MovementSpeed *= .8}},
 Sprinter: {Name: 'Sprinter', Glyph: '»', Up: '+25% Move Speed', Down: '-15% Damage', Ok: () => Stats.DamageMult > -.4, Do(){Stats.MovementSpeed *= 1.25; Stats.DamageMult -= .15}},
 Bounty: {Name: 'Bounty Hunter', Glyph: '★', Up: '+40% Experience', Down: 'Enemies 10% faster', Ok: () => (Stats.EnemySpeed || 0) < .3, Do(){Stats.ExperienceBonus += .4; Stats.EnemySpeed += .1}},
 TwinFire: {Name: 'Twin Fire', Glyph: '⁝', Up: '+1 Projectile', Down: '-25% Damage', Ok: () => Stats.Projectile < 10 && Stats.DamageMult > -.4, Do(){Stats.Projectile++; Stats.DamageMult -= .25}},
 Vampiric: {Name: 'Vampiric Pact', Glyph: '♥', Up: '+3% Lifesteal', Down: 'Lose passive regeneration', Ok: () => Stats.Regeneration >= .4 && Stats.Lifesteal <= StatCaps.Lifesteal - .03, Do(){Stats.Lifesteal += .03; Stats.Regeneration = Math.max(0, Stats.Regeneration - .5)}},
 Deal: {Name: "Executioner's Deal", Glyph: '✖', Up: '+40% Execute damage', Down: '-10% Fire Rate', Ok: () => Stats.FireRate > 1, Do(){Stats.Execute += .4; Stats.FireRate *= .9}},
 DashMaster: {Name: 'Dash Master', Glyph: '≫', Up: '+30% Dash haste', Down: '-15% Max HP', Ok: () => Stats.MaximumHealth >= 50 && (Stats.DashHaste || 0) <= .2, Do(){Stats.DashHaste += .3; Stats.MaximumHealth = Math.round(Stats.MaximumHealth * .85); Player.Hp = Math.min(Player.Hp, Stats.MaximumHealth)}}
};
const ApplyOfferV7 = ApplyOffer;
ApplyOffer = function(O){if(O.Kind === 'Pact'){FillStats(); Pacts[O.Id].Do(); return} ApplyOfferV7(O)};
const CardHtmlV7 = CardHtml;
CardHtml = function(Offer, Index, Animate){
 if(Offer.Kind !== 'Pact') return CardHtmlV7(Offer, Index, Animate);
 const P = Pacts[Offer.Id], C = '#c77dff';
 return `<button class="Card Pact ${Animate ? 'In' : ''}" style="--Index:${Index};border-color:${C};box-shadow:0 0 16px ${C}55" data-pick="${Index}"><div class="Glyph" style="color:${C}">${P.Glyph}</div><em style="color:${C}">Pact · Trade-off</em><b>${P.Name}</b><span><span style="color:#7dffa6">▲ ${P.Up}</span><br><span style="color:#ff7d8f">▼ ${P.Down}</span></span></button>`;
};
const RollOffersV7 = RollOffers;
RollOffers = function(){
 const Out = RollOffersV7();
 if(Round >= 2 && Math.random() < .6){
  FillStats();
  const Ok = Object.keys(Pacts).filter(K => Pacts[K].Ok());
  if(Ok.length){const Pk = {Kind: 'Pact', Id: Ok[Math.floor(Math.random() * Ok.length)]}, I = Out.findIndex(O => O.Kind === 'Item'); if(I >= 0) Out[I] = Pk; else Out.push(Pk)}
 }
 return Out;
};

/* bosses: three ability sets each, faster below 50% HP */
const BossSets = {Brute: ['charge', 'slam', 'ring'], Summoner: ['summon', 'shield', 'blink'], Spinner: ['spiral', 'volley', 'burst']};
function BossShot(En, A){if(EnemyBolts.length < 170) EnemyShot(En, A)}
function BossTick(En, Dt){
 const Ph2 = En.Hp < En.MaxHp * .5, Ang = Math.atan2(Player.Y - En.Y, Player.X - En.X);
 if(En.SlamT > 0){En.SlamT -= Dt; if(En.SlamT <= 0){Ring(En.X, En.Y, '#ff5d73', 110, .4); Shake = Math.max(Shake, 12); if(Math.hypot(Player.X - En.X, Player.Y - En.Y) < 110) HurtPlayer(En.Damage, En); for(let I = 0; I < 14; I++) BossShot(En, I / 14 * Tau); En.Cast = ''}}
 if(En.Tele > 0){En.Tele -= Dt; if(En.Tele <= 0){En.Speed = En.BaseSp; const L = Math.hypot(Player.X - En.X, Player.Y - En.Y) || 1; En.KnockX = (Player.X - En.X) / L * 900; En.KnockY = (Player.Y - En.Y) / L * 900; En.Cast = ''}}
 if(En.SpinT > 0){En.SpinT -= Dt; En.SpinA = (En.SpinA || 0) + Dt * 2.2; En.SW = (En.SW ?? 0) - Dt; if(En.SW <= 0){En.SW = .12; BossShot(En, En.SpinA * 3)} if(En.SpinT <= 0) En.Cast = ''}
 if(En.CastT > 0){En.CastT -= Dt; if(En.CastT <= 0 && !(En.SlamT > 0 || En.Tele > 0 || En.SpinT > 0)) En.Cast = ''}
 En.AbT = (En.AbT ?? 3) - Dt;
 if(En.AbT > 0 || En.SlamT > 0 || En.Tele > 0 || En.SpinT > 0) return;
 const List = BossSets[En.Boss]; if(!List) return;
 En.AbI = ((En.AbI ?? -1) + 1) % List.length; const A = List[En.AbI]; En.AbT = (Ph2 ? 2.6 : 4.2) * RunDiff().Boss; En.Cast = A.toUpperCase();
 const N = Ph2 ? 22 : 14;
 if(A === 'charge'){En.Tele = .8; En.BaseSp = En.Speed; En.Speed = 0}
 else if(A === 'slam') En.SlamT = .9;
 else if(A === 'spiral') En.SpinT = Ph2 ? 3.2 : 2.4;
 else{
  if(A === 'ring' || A === 'burst') for(let I = 0; I < N; I++) BossShot(En, I / N * Tau + Ang);
  else if(A === 'volley') for(let I = -2; I <= 2; I++) BossShot(En, Ang + I * .18);
  else if(A === 'shield'){En.Shield = En.MaxHp * .2; Ring(En.X, En.Y, '#4fb4ff', En.Radius * 2.4, .4)}
  else if(A === 'summon'){Ring(En.X, En.Y, En.Color, 120, .5); for(let I = 0; I < (Ph2 ? 5 : 3) && Enemies.length < 120; I++){SpawnEnemy(1); const M = Enemies[Enemies.length - 1]; const Pp = Place(En.X + RandRange(-70, 70), En.Y + RandRange(-70, 70)); M.X = Pp.X; M.Y = Pp.Y; M.SpawnLeft = M.SpawnTotal = .4}}
  else if(A === 'blink'){Ring(En.X, En.Y, En.Color, 80, .4); const T = RandRange(0, Tau); const Bp = Place(Player.X + Math.cos(T) * 230, Player.Y + Math.sin(T) * 230); En.X = Bp.X; En.Y = Bp.Y; Ring(En.X, En.Y, En.Color, 80, .4); for(let I = 0; I < 8; I++) BossShot(En, I / 8 * Tau)}
  En.CastT = .9;
 }
}
const TraitTickV7 = TraitTick;
TraitTick = function(Dt){TraitTickV7(Dt); for(const En of Enemies) if(En.Boss && En.SpawnLeft <= 0 && En.Hp > 0) BossTick(En, Dt)};

/* ---------- v8: Firebase account (Google sign-in/sign-up) + cloud save ----------
   SETUP: Firebase console -> Project settings -> Your apps -> Web app -> copy the config here.
   Also enable Authentication -> Google, create a Firestore database, and add your site's domain
   under Authentication -> Settings -> Authorized domains. Sign-in does not work from file://        */
const FirebaseConfig = {
  apiKey: "AIzaSyDqff39vTZzH4uPl0H70LGcyHWUvWHeDoM",
  authDomain: "ex-gsfbc-750.firebaseapp.com",
  projectId: "ex-gsfbc-750",
  appId: "1:402720205290:web:e08098fb0565d927eeea93"
};
/* providers: any of google, github, password (each must be enabled in Firebase Authentication).
   appCheckSiteKey: optional reCAPTCHA v3 site key to stop other sites/bots from using your Firebase project. */
const FirebaseOptions = {providers: ['google', 'github', 'password'], appCheckSiteKey: '', turnServers: [], turnUrl: ''};
const FbReady = !!(FirebaseConfig.apiKey && FirebaseConfig.projectId);
const FbBase = 'https://www.gstatic.com/firebasejs/10.14.1/';
let Fb = null, Acct = null, CloudState = '', CloudLast = 0, CloudSnap = '', CloudBusy = false;
const HtmlEsc = T => String(T).replace(/[&<>"']/g, C => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[C]));
const CloudSig = D => H53(SealSalt + 'cloud' + D, 11);

async function FbLoad(){
 if(Fb) return Fb;
 const [A, Au, F] = await Promise.all([import(FbBase + 'firebase-app.js'), import(FbBase + 'firebase-auth.js'), import(FbBase + 'firebase-firestore.js')]);
 const App = A.initializeApp(FirebaseConfig);
 if(FirebaseOptions.appCheckSiteKey){const AC = await import(FbBase + 'firebase-app-check.js'); AC.initializeAppCheck(App, {provider: new AC.ReCaptchaV3Provider(FirebaseOptions.appCheckSiteKey), isTokenAutoRefreshEnabled: true})}
 return Fb = {Au, F, auth: Au.getAuth(App), db: F.getFirestore(App)};
}
function CloudSnapshot(){const Saves = {}; for(const K of Object.keys(Modes)){const S = SaveStore.Get(K); if(S && ValidSave(S)) Saves[K] = S} return {V: 1, Best, Saves, Meta, Parties: PartySaves()}}
function WipeLocal(){
 Best = {}; StorageSet('ShapeSwarmBest2', '{}'); Meta = {Shards: 0, Up: {}, Stamp: 0}; SaveMeta();
 for(const K of Object.keys(Modes)) SaveStore.Set(K, null);
}
async function CloudPush(Force){
 if(!Acct || CloudBusy || Wiping || !Acct.verified) return;
 const Data = JSON.stringify(CloudSnapshot());
 if(!Force && (Data === CloudSnap || Date.now() - CloudLast < 20000)) return;
 CloudBusy = true; CloudState = 'Syncing…';
 try{
  const M = await FbLoad();
  await M.F.setDoc(M.F.doc(M.db, 'players', Acct.uid), {Name: PublicName(), Nick: Acct.nick || '', Data, Sig: CloudSig(Data), Epoch: DataEpoch, Updated: Date.now()});
  CloudSnap = Data; CloudLast = Date.now(); CloudState = 'Synced ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
 }catch(Err){CloudState = 'Sync failed: ' + FbErr(Err)}
 CloudBusy = false; RefreshAcct();
}
async function CloudPull(){
 const M = await FbLoad(), Snap = await M.F.getDoc(M.F.doc(M.db, 'players', Acct.uid));
 if(!Snap.exists()){CloudSnap = ''; return CloudPush(true)}
 const D = Snap.data();
 if(D.Nick && NickOk(D.Nick)){Acct.nick = D.Nick; StorageSet('GONick_' + Acct.uid, D.Nick)}
 if((D.Epoch || 0) < DataEpoch){CloudSnap = ''; return CloudPush(true)}
 if(typeof D.Data !== 'string' || D.Sig !== CloudSig(D.Data)){CloudState = 'Cloud data failed the integrity check and was ignored.'; return}
 const C = JSON.parse(D.Data);
 for(const K in (C.Best || {})) if(C.Best[K] > (Best[K] || 0)) Best[K] = C.Best[K];
 StorageSet('ShapeSwarmBest2', JSON.stringify(Best));
 if(C.Meta && (C.Meta.Stamp || 0) > (Meta.Stamp || 0)){Meta = {Shards: C.Meta.Shards || 0, Up: C.Meta.Up || {}, Stamp: C.Meta.Stamp}; StorageSet('ShapeSwarmMeta', JSON.stringify(Meta))}
 for(const K in (C.Saves || {})){
  const L = SaveStore.Get(K), R = C.Saves[K];
  if(ValidSave(R) && (!ValidSave(L) || (R.RunStats.Time || 0) > (L.RunStats.Time || 0))) SaveStore.Set(K, R);
 }
 if(C.Parties){const Mine = PartySaves(); let Ch = false; for(const I in C.Parties) if(!Mine[I] || (C.Parties[I].Updated || 0) > (Mine[I].Updated || 0)){Mine[I] = C.Parties[I]; Ch = true} if(Ch) StorageSet('GOParties', JSON.stringify(Mine))}
 CloudSnap = ''; await CloudPush(true);
}
let Wiping = false, DiagText = '', NickMsg = '', DelMsg = '';
const NickOk = T => /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,14}[A-Za-z0-9]$/.test(T);
const PublicName = () => Acct ? (Acct.nick || 'Player' + Acct.uid.slice(0, 4).toUpperCase()) : 'Guest';
function AuthMsg(Err){
 const C = Err.code || '';
 if(/invalid-credential|wrong-password|user-not-found|invalid-login/.test(C)) return 'Wrong email or password.';
 if(C === 'auth/email-already-in-use') return 'That email already has an account. Use Sign in instead.';
 if(C === 'auth/weak-password') return 'Password is too weak (use 6+ characters).';
 if(C === 'auth/invalid-email') return 'That email address is not valid.';
 if(C === 'auth/operation-not-allowed') return 'This sign-in method is not enabled in Firebase yet.';
 if(C === 'auth/too-many-requests') return 'Too many attempts. Try again in a few minutes.';
 if(C === 'auth/account-exists-with-different-credential') return 'This email is already registered with another sign-in method.';
 return C || Err.message;
}
async function OnUser(U){
 if(!U){Acct = null; CloudState = ''; Board.Rows = null; RefreshAcct(); GateResolve(false); return}
 const Pwd = U.providerData.length > 0 && U.providerData.every(P => P.providerId === 'password');
 Acct = {uid: U.uid, name: U.displayName || U.email || 'Player', email: U.email || '', photo: /^https:/.test(U.photoURL || '') ? U.photoURL : '', verified: !Pwd || !!U.emailVerified, nick: StorageGet('GONick_' + U.uid) || ''};
 GateResolve(true);
 const Prev = StorageGet('ShapeSwarmUid'); if(Prev && Prev !== U.uid) WipeLocal(); StorageSet('ShapeSwarmUid', U.uid);
 if(!Acct.verified){CloudState = 'Verify your email to turn on cloud saves and ranking. Check your inbox, then press Refresh.'; RefreshAcct(); return}
 CloudState = 'Syncing…'; RefreshAcct();
 try{await CloudPull()}catch(Err){CloudState = 'Sync failed: ' + FbErr(Err)}
 RefreshAcct();
}
async function FbInit(){
 try{const M = await FbLoad(); M.Au.onAuthStateChanged(M.auth, OnUser)}
 catch(Err){CloudState = 'Could not load Firebase (offline?)'; RefreshAcct(); GateResolve(false, 'Could not reach the sign-in service. Check your connection, or play as guest.')}
}
async function SignIn(Prov){
 try{
  const M = await FbLoad(), P = Prov === 'github' ? new M.Au.GithubAuthProvider() : new M.Au.GoogleAuthProvider();
  if(Prov !== 'github') P.setCustomParameters({prompt: 'select_account'});
  try{await M.Au.signInWithPopup(M.auth, P)}
  catch(Err){if(Err.code === 'auth/popup-blocked' || Err.code === 'auth/operation-not-supported-in-environment') await M.Au.signInWithRedirect(M.auth, P); else throw Err}
 }catch(Err){CloudState = (Err.code === 'auth/popup-closed-by-user' || Err.code === 'auth/cancelled-popup-request') ? '' : 'Sign-in failed: ' + AuthMsg(Err); RefreshAcct()}
}
async function EmailAuth(Create){
 const Em = (document.getElementById('GEm') || {}).value || '', Pw = (document.getElementById('GPw') || {}).value || '', Back = Msg => {GateShow('email', Msg); document.getElementById('GEm').value = Em};
 if(!/^\S+@\S+\.\S+$/.test(Em.trim()) || Pw.length < 6){Back('Enter a valid email and a password of 6+ characters.'); return}
 GateShow('loading', Create ? 'Creating your account…' : 'Signing in…');
 try{
  const M = await FbLoad();
  if(Create){const Cr = await M.Au.createUserWithEmailAndPassword(M.auth, Em.trim(), Pw); try{await M.Au.sendEmailVerification(Cr.user)}catch(Err){}}
  else await M.Au.signInWithEmailAndPassword(M.auth, Em.trim(), Pw);
 }catch(Err){Back(AuthMsg(Err))}
}
async function ResetPw(){
 const Em = ((document.getElementById('GEm') || {}).value || '').trim();
 if(!Em){GateShow('email', 'Enter your email first, then press Forgot password.'); return}
 let Msg = 'If that account exists, a reset link was sent.';
 try{const M = await FbLoad(); await M.Au.sendPasswordResetEmail(M.auth, Em)}catch(Err){Msg = AuthMsg(Err)}
 GateShow('email', Msg); document.getElementById('GEm').value = Em;
}
async function SetNick(){
 const V = ((document.getElementById('NickIn') || {}).value || '').trim().replace(/\s+/g, ' ');
 if(!NickOk(V)){NickMsg = 'Use 3-16 letters, numbers, spaces or _ . -'; RenderAccount(); return}
 Acct.nick = V; StorageSet('GONick_' + Acct.uid, V); NickMsg = 'Name saved.'; await CloudPush(true);
 try{const M = await FbLoad(); for(const K of Object.keys(Modes)){const R = M.F.doc(M.db, 'boards', K, 'entries', Acct.uid), S = await M.F.getDoc(R); if(S.exists()) await M.F.updateDoc(R, {name: V})}}
 catch(Err){NickMsg = 'Name saved, but the ranking update failed: ' + FbErr(Err)}
 Board.At = 0; RenderAccount();
}
async function DeleteAllData(){
 Wiping = true;
 try{
  if(Acct && FbReady){const M = await FbLoad(); for(const K of Object.keys(Modes)) await M.F.deleteDoc(M.F.doc(M.db, 'boards', K, 'entries', Acct.uid)); await M.F.deleteDoc(M.F.doc(M.db, 'players', Acct.uid))}
 }catch(Err){Wiping = false; DelMsg = 'Could not delete your cloud data (' + FbErr(Err) + '). Nothing was deleted on this device.'; Ui.querySelector('.AcctScreen') ? RenderAccount() : RenderSettings(); return}
 for(const K of Object.keys(localStorage)) if(/^(ShapeSwarm|GO)/.test(K)) localStorage.removeItem(K);
 location.reload();
}
function DangerPanel(){
 return `<div class="Panel" style="margin-top:10px;border-color:#6b2a3a"><div class="PTitle" style="color:#ff9bab">Delete / reset my data</div><p class="PSub" style="margin:0 0 8px">${Acct ? 'Deletes your cloud save, your ranking entries and all progress on this device.' : 'Deletes all progress saved on this device.'} This cannot be undone.</p><input id="DelConf" class="TxtIn" placeholder="Type DELETE to confirm" autocomplete="off"><button class="Btn Alt" data-act="deletedata">Delete everything</button>${DelMsg ? '<div class="Note" style="color:#ff9bab">' + HtmlEsc(DelMsg) + '</div>' : ''}</div>`;
}
async function Diag(){
 const L = []; DiagText = 'Running…'; RenderAccount();
 let M = null; try{M = await FbLoad()}catch(Err){L.push('✗ Could not load Firebase: ' + (Err.message || Err))}
 L.push('Project: ' + FirebaseConfig.projectId + ' · database: (default)');
 const U = M && M.auth.currentUser;
 if(!U){L.push('✗ Not signed in')}
 else{
  L.push('Signed in · uid ' + U.uid + ' · ' + (U.providerData[0] ? U.providerData[0].providerId : '?'));
  try{const T = await U.getIdToken(true), C = JSON.parse(atob(T.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); L.push('Token project: ' + C.aud + (C.aud === FirebaseConfig.projectId ? ' ✓' : ' ✗ MISMATCH'), 'email_verified: ' + C.email_verified, 'provider claim: ' + (C.firebase && C.firebase.sign_in_provider))}catch(Err){L.push('✗ Token: ' + (Err.code || Err.message))}
  const Step = async (Label, Fn) => {try{const R = await Fn(); L.push('✓ ' + Label + (R ? ' · ' + R : ''))}catch(Err){L.push('✗ ' + Label + ' → ' + (Err.code || Err.message))}};
  await Step('read players/' + U.uid.slice(0, 6) + '…', async () => (await M.F.getDoc(M.F.doc(M.db, 'players', U.uid))).exists() ? 'document exists' : 'no document yet');
  await Step('write players/' + U.uid.slice(0, 6) + '…', async () => {CloudSnap = ''; CloudLast = 0; await CloudPush(true); if(/failed/.test(CloudState)) throw {message: CloudState}});
  await Step('read boards/Standard', async () => (await M.F.getDocs(M.F.query(M.F.collection(M.db, 'boards', 'Standard', 'entries'), M.F.limit(1)))).size + ' entries');
 }
 DiagText = L.join('\n'); RenderAccount();
}
function RenderAccount(){
 Ui.className = 'On';
 let Body;
 if(!FbReady) Body = '<p class="Lead">Cloud save is not set up yet. Paste your Firebase web config into <b>FirebaseConfig</b> in scripts.js, then reload.</p>';
 else if(!Acct) Body = `<p class="Lead">Sign in or sign up to keep your progress on every device and join the global ranking.</p><button class="PlayBtn" style="font-size:20px;padding:10px 26px;min-height:48px;animation:none" data-act="signin">Sign in / Sign up</button>${CloudState ? '<div class="Note">' + HtmlEsc(CloudState) + '</div>' : ''}`;
 else Body = `<div class="AcctCard">${Acct.photo ? '<img alt="" referrerpolicy="no-referrer" src="' + HtmlEsc(Acct.photo) + '">' : ''}<div><b>${HtmlEsc(PublicName())}</b><div class="PSub">${HtmlEsc(Acct.email)}</div></div></div>
 <div class="PTitle" style="margin-top:12px">In-game name (shown on the ranking)</div><input id="NickIn" class="TxtIn" maxlength="16" value="${HtmlEsc(Acct.nick)}" placeholder="${HtmlEsc(PublicName())}" autocomplete="off"><button class="Btn" data-act="savenick">Save name</button>${NickMsg ? '<div class="Note">' + HtmlEsc(NickMsg) + '</div>' : ''}
 <div class="Note" style="margin-top:12px">${HtmlEsc(CloudState || 'Signed in')}</div>${Acct.verified ? '' : '<div class="Row" style="margin-top:8px"><button class="Btn" data-act="refreshverify">Refresh</button><button class="Btn Alt" data-act="resend">Resend email</button></div>'}
 <div class="Row" style="margin-top:12px"><button class="Btn" data-act="syncnow">Sync now</button><button class="Btn Alt" data-act="diag">Test connection</button><button class="Btn Alt" data-act="signout">Sign out</button></div>${DiagText ? '<pre class="Diag">' + HtmlEsc(DiagText) + '</pre>' : ''}`;
 Ui.innerHTML = `<div class="Box AcctScreen" style="max-width:600px"><h2>Account</h2><div class="Panel">${Body}</div>${Acct ? DangerPanel() : ''}<button class="Btn" style="margin-top:14px" data-act="back">Back</button></div>`;
}
Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B) return; const A = B.dataset.act, Stop = () => Ev.stopImmediatePropagation();
 if(A === 'savenick'){SetNick(); Stop()}
 else if(A === 'diag'){Diag(); Stop()}
 else if(A === 'deletedata'){
  if(((document.getElementById('DelConf') || {}).value || '') !== 'DELETE'){DelMsg = 'Type DELETE (capital letters) to confirm.'; Ui.querySelector('.AcctScreen') ? RenderAccount() : RenderSettings()} else DeleteAllData();
  Stop();
 }
 else if(A === 'resend'){FbLoad().then(M => M.Au.sendEmailVerification(M.auth.currentUser)).then(() => {CloudState = 'Verification email sent again.'; RenderAccount()}).catch(Err => {CloudState = AuthMsg(Err); RenderAccount()}); Stop()}
 else if(A === 'refreshverify'){FbLoad().then(async M => {await M.auth.currentUser.reload(); await M.auth.currentUser.getIdToken(true); OnUser(M.auth.currentUser)}); Stop()}
}, true);
function RefreshAcct(){if(Mode !== 'menu') return; if(Ui.querySelector('.AcctScreen')) RenderAccount(); else if(Ui.querySelector('.MenuWrap')) ShowMenu()}
Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B) return; const A = B.dataset.act;
 if(A === 'acct'){RenderAccount(); Ev.stopImmediatePropagation()}
 else if(A === 'signin'){GateShow('login'); Ev.stopImmediatePropagation()}
 else if(A === 'syncnow'){CloudPush(true); Ev.stopImmediatePropagation()}
 else if(A === 'signout'){FbLoad().then(M => M.Au.signOut(M.auth)); Ev.stopImmediatePropagation()}
}, true);
const GameOverV8 = GameOver;
GameOver = function(W){GameOverV8(W); setTimeout(() => CloudPush(true), 800)};
document.addEventListener('visibilitychange', () => {if(document.hidden) CloudPush(false)});
setInterval(() => CloudPush(false), 20000);
if(FbReady) FbInit();

/* ---------- v9: global ranking, welcome / sign-up onboarding, profile card ---------- */
let Board = {Mode: 'Standard', Rows: null, At: 0, Loading: false, Err: '', Mine: null, Rank: 0};
const MenuOnly = () => {if(Mode === 'menu' && Ui.querySelector('.MenuWrap')) ShowMenu()};
async function BoardLoad(Force){
 if(!FbReady || Board.Loading) return;
 if(!Force && Board.Rows && Date.now() - Board.At < 30000) return;
 Board.Loading = true; Board.Err = '';
 try{
  const M = await FbLoad(), Col = M.F.collection(M.db, 'boards', Board.Mode, 'entries');
  const Snap = await M.F.getDocs(M.F.query(Col, M.F.orderBy('score', 'desc'), M.F.limit(25)));
  Board.Rows = Snap.docs.map(D => D.data()); Board.Mine = null;
  if(Acct){
   const Me = await M.F.getDoc(M.F.doc(M.db, 'boards', Board.Mode, 'entries', Acct.uid));
   if(Me.exists()){Board.Mine = Me.data(); const C = await M.F.getCountFromServer(M.F.query(Col, M.F.where('score', '>', Board.Mine.score))); Board.Rank = C.data().count + 1}
  }
  Board.At = Date.now();
 }catch(Err){Board.Err = FbErr(Err)}
 Board.Loading = false; MenuOnly();
}
function BoardEnsure(){if(FbReady && !Board.Loading && !Board.Err && (!Board.Rows || Date.now() - Board.At > 30000)) BoardLoad(false)}
function BoardHtml(){
 const Chips = Object.keys(Modes).map(K => `<button class="Pick BMode ${K === Board.Mode ? 'Sel' : ''}" style="--Chip:#4ff0d6" data-bmode="${K}"><span class="PName">${K}</span></button>`).join('');
 let Body;
 if(!FbReady) Body = '<div class="Note">Global ranking goes live once Firebase is set up. Your personal records:</div>' + Object.keys(Modes).map(K => `<div class="BRow"><span class="BRank">•</span><span class="BName">${K}</span><span class="BScore">${Best[K] ? FormatTime(Best[K]) : '—'}</span></div>`).join('');
 else if(Board.Err) Body = `<div class="Note">Ranking unavailable: ${HtmlEsc(Board.Err)}</div>`;
 else if(!Board.Rows) Body = '<div class="Note">Loading ranking…</div>';
 else if(!Board.Rows.length) Body = '<div class="Note">No scores yet. Be the first!</div>';
 else Body = Board.Rows.map((R, I) => `<div class="BRow ${Acct && R.uid === Acct.uid ? 'Me' : ''} R${I + 1}"><span class="BRank">${I + 1}</span><span class="BName">${/^https:/.test(R.photo || '') ? `<img alt="" referrerpolicy="no-referrer" src="${HtmlEsc(R.photo)}">` : ''}${HtmlEsc(R.name || 'Player')}</span><span class="BScore">${FormatTime(R.score)}${R.mult > 1 ? `<small>×${R.mult}</small>` : ''}</span></div>`).join('');
 const Foot = !FbReady ? '' : Acct ? (Board.Mine ? `<div class="BMine">You: #${Board.Rank} · ${FormatTime(Board.Mine.score)}</div>` : '<div class="BMine">Finish a run to get ranked.</div>') : '<button class="JoinBtn" data-act="signin">Sign in to get ranked</button>';
 return `<div class="PTitle">Global ranking <b style="float:right;color:var(--Amber)">time × mutators × difficulty</b></div><div class="PGrid3">${Chips}</div><div class="BList WsScroll">${Body}</div>${Foot}`;
}
async function SubmitScore(ModeName, Time, Rd, Lv, Kl, MutN, DiffName){
 if(!Acct || !Acct.verified || !FbReady || Time < 10) return null;
 const M = await FbLoad(), Mult = +((1 + .2 * MutN) * (DiffTbl[DiffName] || DiffTbl.Normal).Reward).toFixed(2), Score = Math.floor(Time * Mult);
 const Ref = M.F.doc(M.db, 'boards', ModeName, 'entries', Acct.uid), Old = await M.F.getDoc(Ref), OldScore = Old.exists() ? Old.data().score : 0;
 if(Score > OldScore) await M.F.setDoc(Ref, {uid: Acct.uid, name: PublicName(), photo: Acct.photo, score: Score, time: Math.floor(Time), mult: Mult, diff: DiffName || 'Normal', round: Rd, level: Lv, kills: Kl, Updated: Date.now()});
 const C = await M.F.getCountFromServer(M.F.query(M.F.collection(M.db, 'boards', ModeName, 'entries'), M.F.where('score', '>', Math.max(Score, OldScore))));
 Board.At = 0; return {rank: C.data().count + 1, best: Math.max(Score, OldScore)};
}
const GameOverV9 = GameOver;
GameOver = function(W){
 const T = RunStats.Time, Rd = Round, Lv = Player.Level, Kl = RunStats.Kills, MN = Object.values(RM()).filter(Boolean).length, MK = ModeKey, DK = (Player && Player.Diff) || SelDiff;
 GameOverV9(W);
 SubmitScore(MK, T, Rd, Lv, Kl, MN, DK).then(R => {if(R){const E = Ui.querySelector('.Recap'); if(E) E.insertAdjacentHTML('beforeend', '<br>🌐 Global rank #' + R.rank + ' · ' + MK)}}).catch(() => {});
};
Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B || !B.dataset.bmode) return;
 Board.Mode = B.dataset.bmode; Board.Rows = null; Board.Err = ''; BoardLoad(true); MenuOnly(); Ev.stopImmediatePropagation();
}, true);

function JoinCard(){
 if(!FbReady) return '';
 if(Acct) return `<div class="Profile Rise" style="--d:4">${/^https:/.test(Acct.photo) ? `<img alt="" referrerpolicy="no-referrer" src="${HtmlEsc(Acct.photo)}">` : ''}<div><b>${HtmlEsc(PublicName())}</b><span>${HtmlEsc(CloudState || 'Signed in')}</span></div></div>`;
 return '<div class="Join Rise" style="--d:4"><b>Create your free account</b><span>Sign up with Google to keep your progress on every device and join the global ranking.</span><button class="JoinBtn" data-act="signin">Continue with Google</button></div>';
}
/* login gate: auto sign-in when a session exists, otherwise a full-screen Google login (like Pocket Ants) */
let GateState = FbReady ? 'loading' : 'done';
const GateEl = document.createElement('div'); GateEl.id = 'Gate';
const GoogleG = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
const GithubIco = '<svg width="20" height="20" viewBox="0 0 16 16" fill="#fff"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
function GateShow(State, Msg){
 GateState = State;
 const Icons = ElemNames.map(N => ElemIcon(N, 28)).join(''), P = FirebaseOptions.providers, Err = Msg ? '<p class="GErr">' + HtmlEsc(Msg) + '</p>' : '';
 let Body;
 if(State === 'loading') Body = `<div class="GSpin"></div><p class="GMsg">${HtmlEsc(Msg || 'Signing you in…')}</p>`;
 else if(State === 'email') Body = `<input id="GEm" class="TxtIn" type="email" autocomplete="email" placeholder="Email"><input id="GPw" class="TxtIn" type="password" autocomplete="current-password" placeholder="Password (6+ characters)">${Err}<div class="GRow"><button class="GBtn Sm" data-gate="signin">Sign in</button><button class="GBtn Sm Dark" data-gate="signup">Sign up</button></div><button class="GGuest" data-gate="reset">Forgot password?</button><button class="GGuest" data-gate="back">← Other options</button>`;
 else Body = `${P.includes('google') ? '<button class="GBtn" data-gate="google">' + GoogleG + '<span>Continue with Google</span></button>' : ''}${P.includes('github') ? '<button class="GBtn Dark" data-gate="github">' + GithubIco + '<span>Continue with GitHub</span></button>' : ''}${P.includes('password') ? '<button class="GBtn Dark" data-gate="emailview"><span>✉ Email &amp; password</span></button>' : ''}${Err}<button class="GGuest" data-gate="guest">Play as guest</button><small>New here? Signing in creates your account automatically. Progress and ranking sync across devices.</small>`;
 GateEl.innerHTML = `<div class="GBox"><div class="GIcons">${Icons}</div><h1>Geometrical<br> Onslaught</h1><p class="GTag">Survive the swarm. Master four elements.</p>${Body}</div>`;
 GateEl.classList.add('On'); document.body.classList.add('GateOn');
}
function GateResolve(User, Msg){
 if(User){GateState = 'done'; GateEl.classList.remove('On'); document.body.classList.remove('GateOn'); return}
 if(GateState === 'guest') return;
 GateShow('login', Msg);
}
GateEl.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B) return; const G = B.dataset.gate;
 if(G === 'guest'){GateState = 'guest'; GateEl.classList.remove('On'); document.body.classList.remove('GateOn')}
 else if(G === 'google' || G === 'github') SignIn(G);
 else if(G === 'emailview') GateShow('email');
 else if(G === 'back') GateShow('login');
 else if(G === 'signin') EmailAuth(false);
 else if(G === 'signup') EmailAuth(true);
 else if(G === 'reset') ResetPw();
});
document.body.appendChild(GateEl);
const SignInV10 = SignIn;
SignIn = async function(Prov){
 if(GateState !== 'done' && GateState !== 'guest') GateShow('loading', 'Waiting for ' + (Prov === 'github' ? 'GitHub' : 'Google') + '…');
 await SignInV10(Prov); await new Promise(R => setTimeout(R, 400));
 if(!Acct && GateState === 'loading') GateShow('login', /failed/.test(CloudState) ? CloudState : '');
};
if(FbReady){GateShow('loading'); setTimeout(() => {if(GateState === 'loading') GateShow('login', 'Could not reach the sign-in service. Check your connection, or play as guest.')}, 9000)}

/* ---------- v10: difficulties, create-run screen, round events, loot goblins ---------- */
const DiffTbl = {
 Easy: {Pressure: .78, Hp: .85, Speed: .92, Dmg: .7, Trait: .5, Boss: 1.25, Reward: .5, Shards: .6, Color: '#7dffa6', Info: 'Relaxed. Weaker, slower enemies.'},
 Normal: {Pressure: 1, Hp: 1, Speed: 1, Dmg: 1, Trait: 1, Boss: 1, Reward: 1, Shards: 1, Color: '#4ff0d6', Info: 'The intended challenge.'},
 Hard: {Pressure: 1.2, Hp: 1.1, Speed: 1.04, Dmg: 1.3, Trait: 1.6, Boss: .8, Reward: 1.5, Shards: 1.3, Color: '#ffc857', Info: 'Bigger waves, tougher foes, faster bosses.'},
 Nightmare: {Pressure: 1.5, Hp: 1.25, Speed: 1.1, Dmg: 1.7, Trait: 2.4, Boss: .62, Reward: 2.5, Shards: 1.8, Color: '#ff5d73', Info: 'Brutal. Shields everywhere, relentless bosses.'}
};
let SelDiff = DiffTbl[StorageGet('GODiff')] ? StorageGet('GODiff') : 'Normal', SetupOpen = false;
const RunDiff = () => DiffTbl[(Player && Player.Diff) || SelDiff] || DiffTbl.Normal;
function FbErr(Err){return Err.code === 'permission-denied' ? 'permission denied. Publish the Firestore rules for this project and make sure the database is (default).' : (Err.code || Err.message)}
const MutInfo = {Glass: ['Glass Cannon', 'Half max HP, +60% damage'], Heavy: ['Heavy Core', '-25% move speed, +35% damage'], Frenzy: ['Frenzy', '+50% fire rate, -25% max HP'], Swarm: ['Swarm', 'Waves grow 25% harder'], Fast: ['Fast Foes', 'Enemies move 25% faster'], Armored: ['Armored', 'Enemies +40% HP, you +30% XP'], Volatile: ['Volatile', 'Dying enemies blast you within 90px'], Elite: ['Elite Rush', 'A tough elite spawns every 25s'], Blood: ['Blood Pact', 'Drain 1.5% HP/s, heal 1.2% per kill'], NoRegen: ['No Regen', 'All health regeneration disabled']};

function RenderSetup(){
 Ui.className = 'On';
 const MN = Object.values(Mut).filter(Boolean).length, D = DiffTbl[SelDiff], Rew = +(D.Reward * (1 + .2 * MN)).toFixed(2), MC = {Standard: '#4ff0d6', Quickplay: '#ffc857', Endless: '#9b7bff'};
 const Modes_ = Object.keys(Modes).map(K => {const M = Modes[K]; return `<button class="Pick ModeCard ${K === SelMode ? 'Sel' : ''}" style="--Chip:${MC[K] || '#4ff0d6'}" data-mode="${K}"><span class="PBig">${M.Total ? M.Info : '∞'}</span><b class="PName">${K}</b><span class="PSub">${M.Total ? M.Total / M.RoundLen + ' rounds' : 'Until you fall'}</span><span class="PBest">${Best[K] ? 'Best ' + FormatTime(Best[K]) : 'No record yet'}</span></button>`}).join('');
 const Diffs = Object.keys(DiffTbl).map(K => `<button class="Pick ${K === SelDiff ? 'Sel' : ''}" style="--Chip:${DiffTbl[K].Color}" data-diff="${K}"><span class="PName">${K}</span><span class="PSub">${DiffTbl[K].Info}</span><span class="PBest">Rewards ×${DiffTbl[K].Reward}</span></button>`).join('');
 const Elems_ = ElemNames.map(N => {const E = Elems[N], P = E.Desc.split('. '); return `<button class="Pick ElemCard ${N === SelElem ? 'Sel' : ''}" style="--Chip:${E.Color}" data-elem="${N}"><span class="EGlyph">${ElemIcon(N, 22)}</span><span class="EText"><b class="PName">${N}</b><span class="PSub">${P[0]}</span><span class="PPerk">${(P[1] || '').replace(/\.$/, '')}</span></span></button>`}).join('');
 const Muts = Object.keys(MutInfo).map(K => `<button class="Pick ${Mut[K] ? 'Sel' : ''}" style="--Chip:#ff5d73" data-mut="${K}"><span class="PName">${MutInfo[K][0]}</span><span class="PSub">${MutInfo[K][1]}</span></button>`).join('');
 Ui.innerHTML = `<div class="Setup"><div class="SHead"><button class="Ghost" data-act="setupclose">← Back</button><h2>Create Run</h2></div>
 <div class="SGrid"><div class="Panel"><div class="PTitle">1 · Mode</div><div class="PGrid3">${Modes_}</div></div>
 <div class="Panel"><div class="PTitle">2 · Difficulty</div><div class="PGrid2">${Diffs}</div></div>
 <div class="Panel SWide"><div class="PTitle">3 · Starting element</div><div class="PGrid4">${Elems_}</div></div>
 <div class="Panel SWide"><div class="PTitle">4 · Mutators <b style="float:right;color:var(--Coral)">+20% rewards each</b></div><div class="PGrid5">${Muts}</div></div></div>
 <div class="SFoot"><div class="SSum"><span><b>${SelMode}</b> · <b style="color:${D.Color}">${SelDiff}</b> · <b style="color:${Elems[SelElem].Color}">${SelElem}</b> · ${MN} mutator${MN === 1 ? '' : 's'}</span><small>Shards and ranking ×${Rew}</small></div><button class="PlayBtn" data-act="play"><span>▶</span>Start run</button></div></div>`;
}
Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B) return; const A = B.dataset.act;
 if(A === 'setup'){SetupOpen = true; ShowMenu(); Ev.stopImmediatePropagation()}
 else if(A === 'setupclose'){SetupOpen = false; ShowMenu(); Ev.stopImmediatePropagation()}
 else if(B.dataset.diff){SelDiff = B.dataset.diff; StorageSet('GODiff', SelDiff); ShowMenu(); Ev.stopImmediatePropagation()}
}, true);
const NewRunV10 = NewRun;
NewRun = function(){SetupOpen = false; NewRunV10(); EventKey = null; EventRound = 0; Meteor = []; GoblinT = 35};
Canvas.addEventListener('wheel', Ev => {if(Mode !== 'play') return; Ev.preventDefault(); Settings.View = Clamp((Settings.View || 1) - Math.sign(Ev.deltaY) * .05, .6, 1.5); ApplySettings()}, {passive: false});

/* round events + loot goblins */
const Events = {
 BloodMoon: {Name: 'Blood Moon', Sub: 'Enemies are faster, but XP is doubled', Color: '#ff5d73'},
 Meteors: {Name: 'Meteor Storm', Sub: 'Watch the glowing circles and move!', Color: '#ffc857'},
 Overcharge: {Name: 'Overcharge', Sub: '+30% fire rate, enemies +20% HP', Color: '#4ff0d6'},
 Golden: {Name: 'Golden Hour', Sub: 'Loot goblins roam. Catch them for shards!', Color: '#ffd54a'}
};
let EventKey = null, EventRound = 0, Meteor = [], MeteorT = 2, GoblinT = 35;
function SpawnGoblin(){
 SpawnEnemy(0); const G = Enemies[Enemies.length - 1]; if(!G) return;
 G.Goblin = true; G.Color = '#ffd54a'; G.MaxHp = G.Hp = G.MaxHp * 1.6 + 30; G.Damage = 0; G.Life = 14; G.BaseSpeed = G.Speed; G.Speed = 0;
 FloatText(Player.X, Player.Y - 40, 'LOOT GOBLIN!', '#ffd54a');
}
const TraitTickV10 = TraitTick;
TraitTick = function(Dt){
 TraitTickV10(Dt);
 if(EventRound !== Round){
  EventRound = Round; Meteor = []; EventKey = (Round >= 2 && Math.random() < .55) ? Object.keys(Events)[Math.floor(Math.random() * 4)] : null;
  if(EventKey) ShowBanner(Events[EventKey].Name, Events[EventKey].Sub, Events[EventKey].Color);
 }
 if(EventKey === 'Overcharge') Player.Cooldown -= Dt * .3;
 if(EventKey === 'Meteors'){
  MeteorT -= Dt;
  if(MeteorT <= 0){MeteorT = RandRange(.8, 1.5) / Math.max(1, RunDiff().Pressure * .9); const J = Math.random() < .55 ? 90 : 320; {const Mp = Place(Player.X + RandRange(-J, J), Player.Y + RandRange(-J, J)); Meteor.push({X: Mp.X, Y: Mp.Y, T: 1.1, R: 70})}}
 }
 for(const M of Meteor){
  M.T -= Dt;
  if(M.T <= 0){
   Ring(M.X, M.Y, '#ffc857', M.R * 1.3, .4); Burst(M.X, M.Y, '#ffc857', 18, 260, .5); Shake = Math.max(Shake, 6);
   if(Math.hypot(Player.X - M.X, Player.Y - M.Y) < M.R) HurtPlayer(Math.round(10 * RunDiff().Dmg + Round));
   for(const En of Enemies) if(En.Hp > 0 && En.SpawnLeft <= 0 && Math.hypot(En.X - M.X, En.Y - M.Y) < M.R + En.Radius) DamageEnemy(En, 30 + Round * 8, false, En.X - M.X, En.Y - M.Y, '#ffc857', 80);
  }
 }
 Meteor = Meteor.filter(M => M.T > 0);
 GoblinT -= Dt * (EventKey === 'Golden' ? 3 : 1);
 if(GoblinT <= 0 && Round >= 2 && !Enemies.some(E => E.Goblin)){GoblinT = RandRange(45, 70); SpawnGoblin()}
 for(const G of Enemies) if(G.Goblin && G.SpawnLeft <= 0){
  const Dx = G.X - Player.X, Dy = G.Y - Player.Y, L = Math.hypot(Dx, Dy) || 1;
  MoveW(G, Dx / L * 170 * Dt, Dy / L * 170 * Dt, 14); G.Life -= Dt;
  if(G.Life <= 0){G.Hp = -1; Enemies = Enemies.filter(E => E !== G); FloatText(G.X, G.Y, 'ESCAPED', '#8f98c8')}
 }
};
const KillEnemyV10 = KillEnemy;
KillEnemy = function(En){
 KillEnemyV10(En);
 if(En.Goblin){PartyXpAll(30 + Round * 6); Meta.Shards += 2; SaveMeta(); FloatText(En.X, En.Y - 20, '+2 ◆ LOOT!', '#ffd54a'); Burst(En.X, En.Y, '#ffd54a', 24, 300, .6); Ring(En.X, En.Y, '#ffd54a', 70, .4)}
};

/* ---------- v12: procedural dungeon (rooms, corridors, chests, minimap) ---------- */
const TS = 60, GN = Arena / TS, Dirs4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const Dg = {Seed: 0, Gen: 0, Grid: new Uint8Array(GN * GN), Rooms: [], Floors: [], Dist: new Int16Array(GN * GN).fill(-1), Chests: [], Seen: new Uint8Array(GN * GN), FlowT: 0, Q: new Int16Array(GN * GN)};
const MakeRng = Seed => {let A = Seed >>> 0; return () => {A = (A + 0x6D2B79F5) >>> 0; let T = Math.imul(A ^ (A >>> 15), 1 | A); T = (T + Math.imul(T ^ (T >>> 7), 61 | T)) ^ T; return ((T ^ (T >>> 14)) >>> 0) / 4294967296}};
const TileOf = (X, Y) => Math.floor(Y / TS) * GN + Math.floor(X / TS);
const Solid = (X, Y) => X < 0 || Y < 0 || X >= Arena || Y >= Arena || !Dg.Grid[TileOf(X, Y)];
const HitW = (X, Y, R) => Solid(X - R, Y - R) || Solid(X + R, Y - R) || Solid(X - R, Y + R) || Solid(X + R, Y + R);
function MoveW(O, Dx, Dy, R){const NX = O.X + Dx; if(!HitW(NX, O.Y, R)) O.X = NX; const NY = O.Y + Dy; if(!HitW(O.X, NY, R)) O.Y = NY}
function BuildDungeon(Seed){
 const R = MakeRng(Seed), G = new Uint8Array(GN * GN), Rooms = [], Ri = (A, B) => A + Math.floor(R() * (B - A + 1));
 for(let Try = 0; Try < 260 && Rooms.length < 12; Try++){
  const W = Ri(6, 10), H = Ri(6, 10), X = Ri(2, GN - W - 3), Y = Ri(2, GN - H - 3);
  if(Rooms.some(Q => X < Q.x + Q.w + 2 && X + W + 2 > Q.x && Y < Q.y + Q.h + 2 && Y + H + 2 > Q.y)) continue;
  Rooms.push({x: X, y: Y, w: W, h: H, cx: X + W / 2, cy: Y + H / 2});
 }
 if(Rooms.length < 6) return null;
 for(const Q of Rooms) for(let Y = Q.y; Y < Q.y + Q.h; Y++) for(let X = Q.x; X < Q.x + Q.w; X++) G[Y * GN + X] = 1;
 const Carve = (X, Y) => {for(let Dy = 0; Dy < 2; Dy++) for(let Dx = 0; Dx < 2; Dx++){const NX = X + Dx, NY = Y + Dy; if(NX > 0 && NY > 0 && NX < GN - 1 && NY < GN - 1) G[NY * GN + NX] = 1}};
 const Link = (A, B) => {
  let X = Math.floor(A.cx), Y = Math.floor(A.cy); const TX = Math.floor(B.cx), TY = Math.floor(B.cy);
  if(R() < .5){while(X !== TX){Carve(X, Y); X += Math.sign(TX - X)} while(Y !== TY){Carve(X, Y); Y += Math.sign(TY - Y)}}
  else{while(Y !== TY){Carve(X, Y); Y += Math.sign(TY - Y)} while(X !== TX){Carve(X, Y); X += Math.sign(TX - X)}}
  Carve(X, Y);
 };
 for(let I = 1; I < Rooms.length; I++){let B = 0, BD = 1e9; for(let J = 0; J < I; J++){const D = Math.abs(Rooms[I].cx - Rooms[J].cx) + Math.abs(Rooms[I].cy - Rooms[J].cy); if(D < BD){BD = D; B = J}} Link(Rooms[I], Rooms[B])}
 for(let K = 0; K < 3; K++){const A = Rooms[Ri(0, Rooms.length - 1)], B = Rooms[Ri(0, Rooms.length - 1)]; if(A !== B) Link(A, B)}
 for(let I = 1; I < Rooms.length; I++){
  const Q = Rooms[I]; if(Q.w < 8 || Q.h < 8) continue;
  for(let K = 0; K < 2; K++){
   const PX = Ri(Q.x + 2, Q.x + Q.w - 4), PY = Ri(Q.y + 2, Q.y + Q.h - 4);
   if(Math.abs(PX - Math.floor(Q.cx)) < 3 || Math.abs(PY - Math.floor(Q.cy)) < 3) continue;
   for(let Dy = 0; Dy < 2; Dy++) for(let Dx = 0; Dx < 2; Dx++) G[(PY + Dy) * GN + PX + Dx] = 0;
  }
 }
 const Chests = [];
 for(let I = 1; I < Rooms.length; I++){
  const Q = Rooms[I], N = (Q.w * Q.h >= 70 ? 2 : 1) * (R() < .7 ? 1 : 0);
  for(let K = 0; K < N; K++){const X = Ri(Q.x + 1, Q.x + Q.w - 2), Y = Ri(Q.y + 1, Q.y + Q.h - 2); if(G[Y * GN + X]) Chests.push({X: (X + .5) * TS, Y: (Y + .5) * TS, Open: false})}
 }
 return {G, Rooms, Chests};
}
function GenDungeon(Seed){
 let B = null; for(let K = 0; K < 30 && !B; K++) B = BuildDungeon((Seed + K * 977) | 0);
 if(!B) B = BuildDungeon(12345);
 Dg.Grid = B.G; Dg.Rooms = B.Rooms; Dg.Chests = B.Chests; Dg.Seed = Seed; Dg.Gen++;
 Dg.Floors = []; for(let I = 0; I < GN * GN; I++) if(Dg.Grid[I]) Dg.Floors.push(I);
}
const StartPos = I => {const Q = Dg.Rooms[0], A = I * 1.7; return {X: Q.cx * TS + Math.cos(A) * 34, Y: Q.cy * TS + Math.sin(A) * 34}};
function Place(X, Y){
 if(!HitW(X, Y, 10)) return {X, Y};
 const I = TileOf(Clamp(X, 1, Arena - 1), Clamp(Y, 1, Arena - 1)), TX = I % GN, TY = Math.floor(I / GN);
 for(let R = 1; R < 9; R++) for(let Oy = -R; Oy <= R; Oy++) for(let Ox = -R; Ox <= R; Ox++){
  if(Math.max(Math.abs(Ox), Math.abs(Oy)) !== R) continue; const NX = TX + Ox, NY = TY + Oy;
  if(NX >= 0 && NY >= 0 && NX < GN && NY < GN && Dg.Grid[NY * GN + NX]) return {X: (NX + .5) * TS, Y: (NY + .5) * TS};
 }
 return StartPos(0);
}
function RandFloor(){const Qs = Dg.Rooms.slice(1), Q = Qs.length ? Qs[Math.floor(Math.random() * Qs.length)] : Dg.Rooms[0]; return Place((Q.x + 1 + Math.random() * (Q.w - 2)) * TS, (Q.y + 1 + Math.random() * (Q.h - 2)) * TS)}
function ZonePlace(){const Qs = Dg.Rooms.slice(1), Q = Qs.length ? Qs[Math.floor(Math.random() * Qs.length)] : Dg.Rooms[0]; return {X: Q.cx * TS, Y: Q.cy * TS, R: Math.min(140, Math.min(Q.w, Q.h) * TS * .36)}}
function FlowUpdate(){
 const D = Dg.Dist, Q = Dg.Q; D.fill(-1); let H = 0, T = 0;
 const Src = []; if(Player && !Player.Down) Src.push(Player); for(const R of Party.Remotes) if(R.Alive) Src.push(R.P);
 for(const P of Src){const I = TileOf(P.X, P.Y); if(I >= 0 && I < GN * GN && Dg.Grid[I] && D[I] < 0){D[I] = 0; Q[T++] = I}}
 while(H < T){const I = Q[H++], X = I % GN, Y = (I - X) / GN, Dd = D[I] + 1; for(const [Ox, Oy] of Dirs4){const NX = X + Ox, NY = Y + Oy; if(NX < 0 || NY < 0 || NX >= GN || NY >= GN) continue; const J = NY * GN + NX; if(Dg.Grid[J] && D[J] < 0){D[J] = Dd; Q[T++] = J}}}
}
function LineClear(X0, Y0, X1, Y1){const Dx = X1 - X0, Dy = Y1 - Y0, L = Math.hypot(Dx, Dy); if(L > 900) return false; const N = Math.ceil(L / 24); for(let I = 1; I < N; I++) if(Solid(X0 + Dx * I / N, Y0 + Dy * I / N)) return false; return true}
function ChaseVec(En, Dx, Dy, Dist){
 if(Dist < 90 || LineClear(En.X, En.Y, En.X + Dx, En.Y + Dy)) return {X: Dx / Dist, Y: Dy / Dist};
 const I = TileOf(En.X, En.Y); if(I < 0 || I >= GN * GN || Dg.Dist[I] < 0) return {X: Dx / Dist, Y: Dy / Dist};
 const TX = I % GN, TY = (I - TX) / GN; let Best = Dg.Dist[I], BX = 0, BY = 0;
 for(let Oy = -1; Oy <= 1; Oy++) for(let Ox = -1; Ox <= 1; Ox++){
  if(!Ox && !Oy) continue; const NX = TX + Ox, NY = TY + Oy; if(NX < 0 || NY < 0 || NX >= GN || NY >= GN) continue;
  const Dd = Dg.Dist[NY * GN + NX]; if(Dd < 0 || Dd >= Best) continue; if(Ox && Oy && (!Dg.Grid[TY * GN + NX] || !Dg.Grid[NY * GN + TX])) continue;
  Best = Dd; BX = Ox; BY = Oy;
 }
 if(!BX && !BY) return {X: Dx / Dist, Y: Dy / Dist};
 const CX = (TX + BX + .5) * TS - En.X, CY = (TY + BY + .5) * TS - En.Y, L = Math.hypot(CX, CY) || 1; return {X: CX / L, Y: CY / L};
}
function SpawnPoint(){
 const Ts = []; if(Player && !Player.Down) Ts.push(Player); for(const R of Party.Remotes) if(R.Alive) Ts.push(R.P); if(!Ts.length && Player) Ts.push(Player);
 let Best = null, BS = -1e9;
 for(let K = 0; K < 40; K++){
  const I = Dg.Floors[Math.floor(Math.random() * Dg.Floors.length)], X = (I % GN + .5) * TS + RandRange(-22, 22), Y = (Math.floor(I / GN) + .5) * TS + RandRange(-22, 22);
  let Dm = 1e9; for(const T of Ts) Dm = Math.min(Dm, Math.hypot(X - T.X, Y - T.Y));
  const Ok = Dm > 420 && Dm < 950 && Dg.Dist[I] >= 0, Score = Ok ? 1000 - Math.abs(Dm - 600) : -Math.abs(Dm - 600);
  if(Score > BS){BS = Score; Best = {X, Y}} if(Ok && K > 8) break;
 }
 return Best || StartPos(0);
}
function NewDungeon(Seed){
 GenDungeon(Seed === undefined ? (Math.random() * 2 ** 31) | 0 : Seed); Dg.Seen.fill(0);
 if(Party.On && Party.Host) Party.DGen = (Party.DGen || 0) + 1;
 const Ps = [Player, ...Party.Remotes.map(R => R.P)]; Ps.forEach((P, I) => {if(!P) return; const S = StartPos(I); P.X = S.X; P.Y = S.Y; P.KnockX = 0; P.KnockY = 0});
 for(const R of Party.Remotes){R.In.x = R.P.X; R.In.y = R.P.Y}
 Camera.X = Player.X; Camera.Y = Player.Y; Pickups = []; Bolts = []; EnemyBolts = []; Meteor = []; FlowUpdate();
 for(const En of Enemies){const P = SpawnPoint(); En.X = P.X; En.Y = P.Y}
}
function MarkSeen(P){const TX = Math.floor(P.X / TS), TY = Math.floor(P.Y / TS); for(let Oy = -7; Oy <= 7; Oy++) for(let Ox = -7; Ox <= 7; Ox++){const X = TX + Ox, Y = TY + Oy; if(X >= 0 && Y >= 0 && X < GN && Y < GN && Ox * Ox + Oy * Oy <= 50) Dg.Seen[Y * GN + X] = 1}}
function OpenChest(C, W){
 C.Open = true; Ring(C.X, C.Y, '#ffd54a', 60, .4); Burst(C.X, C.Y, '#ffd54a', 18, 240, .6); PlaySfx('Kill');
 const Pos = W.R ? W.R.P : Player, Mh = W.R ? W.R.S.MaximumHealth : Stats.MaximumHealth, Roll = Math.random();
 if(Roll < .28){Pos.Hp = Math.min(Mh, Pos.Hp + Mh * .35); FloatText(C.X, C.Y - 20, '+35% HP', '#7dffa6')}
 else if(Roll < .58){const V = 18 + Round * 5; PartyXp(W.R ? {R: W.R} : null, V); FloatText(C.X, C.Y - 20, '+' + V + ' XP', '#4ff0d6')}
 else if(Roll < .80){if(W.R) W.R.Pending++; else Pending++; FloatText(C.X, C.Y - 20, '+1 UPGRADE', '#c77dff')}
 else{const N = 1 + Math.floor(Math.random() * 3); if(W.R) PartySend(W.R.Uid, {t: 'loot', sh: N}); else{Meta.Shards += N; SaveMeta()} FloatText(C.X, C.Y - 20, '+' + N + ' ◆', '#ffd54a')}
}
function DungeonTick(Dt){
 Dg.FlowT -= Dt; if(Dg.FlowT <= 0){Dg.FlowT = .2; FlowUpdate(); MarkSeen(Player)}
 for(const En of Enemies) if(HitW(En.X, En.Y, 2)){const P = Place(En.X, En.Y); En.X = P.X; En.Y = P.Y}
 if(HitW(Player.X, Player.Y, 2)){const P = Place(Player.X, Player.Y); Player.X = P.X; Player.Y = P.Y}
 for(const C of Dg.Chests){
  if(C.Open) continue; let W = null;
  if(!Player.Down && Math.hypot(C.X - Player.X, C.Y - Player.Y) < 32) W = {};
  else for(const R of Party.Remotes) if(R.Alive && Math.hypot(C.X - R.P.X, C.Y - R.P.Y) < 32){W = {R}; break}
  if(W) OpenChest(C, W);
 }
}
function DrawDungeon(){
 const HW = Width / 2 / Zoom + TS, HH = Height / 2 / Zoom + TS;
 Context.fillStyle = '#070918'; Context.fillRect(Camera.X - HW, Camera.Y - HH, HW * 2, HH * 2);
 const X0 = Math.max(0, Math.floor((Camera.X - HW) / TS)), X1 = Math.min(GN - 1, Math.ceil((Camera.X + HW) / TS)), Y0 = Math.max(0, Math.floor((Camera.Y - HH) / TS)), Y1 = Math.min(GN - 1, Math.ceil((Camera.Y + HH) / TS));
 const Gd = Dg.Grid, At = (X, Y) => X >= 0 && Y >= 0 && X < GN && Y < GN && Gd[Y * GN + X];
 for(let Y = Y0; Y <= Y1; Y++) for(let X = X0; X <= X1; X++){
  if(Gd[Y * GN + X]){Context.fillStyle = (X + Y) & 1 ? '#141a3a' : '#111638'; Context.fillRect(X * TS, Y * TS, TS, TS)}
  else if(At(X - 1, Y) || At(X + 1, Y) || At(X, Y - 1) || At(X, Y + 1) || At(X - 1, Y - 1) || At(X + 1, Y - 1) || At(X - 1, Y + 1) || At(X + 1, Y + 1)){
   Context.fillStyle = '#232b5c'; Context.fillRect(X * TS, Y * TS, TS, TS); Context.fillStyle = '#323d80'; Context.fillRect(X * TS, Y * TS, TS, 5);
  }
 }
 Context.strokeStyle = '#1b2250'; Context.lineWidth = 1; Context.beginPath();
 for(let Y = Y0; Y <= Y1; Y++) for(let X = X0; X <= X1; X++) if(Gd[Y * GN + X]){Context.moveTo(X * TS, Y * TS); Context.lineTo((X + 1) * TS, Y * TS); Context.moveTo(X * TS, Y * TS); Context.lineTo(X * TS, (Y + 1) * TS)}
 Context.stroke();
 for(const C of Dg.Chests){
  if(Math.abs(C.X - Camera.X) > HW || Math.abs(C.Y - Camera.Y) > HH) continue;
  if(!C.Open){Context.globalAlpha = .22 + .12 * Math.sin(Time * 3); Context.fillStyle = '#ffd54a'; Poly(C.X, C.Y, 28, 0); Context.fill(); Context.globalAlpha = 1}
  Context.fillStyle = C.Open ? '#5a4a1a' : '#ffd54a'; Context.fillRect(C.X - 13, C.Y - 9, 26, 18); Context.fillStyle = C.Open ? '#3a2f10' : '#b8870a'; Context.fillRect(C.X - 13, C.Y - 9, 26, 6);
  if(!C.Open){Context.fillStyle = '#fff8'; Context.fillRect(C.X - 2, C.Y - 3, 4, 7)}
 }
}
function DrawMinimap(){
 if(!Player || Mode === 'dying') return;
 const S = 3, X0 = Width - GN * S - 12, Y0 = SafeTop + 120;
 Context.globalAlpha = .8; Context.fillStyle = '#080a18'; Context.fillRect(X0 - 3, Y0 - 3, GN * S + 6, GN * S + 6);
 Context.fillStyle = '#2a3370'; for(let Y = 0; Y < GN; Y++) for(let X = 0; X < GN; X++){const I = Y * GN + X; if(Dg.Seen[I] && Dg.Grid[I]) Context.fillRect(X0 + X * S, Y0 + Y * S, S, S)}
 const Dot = (X, Y, C, R) => {Context.fillStyle = C; Context.fillRect(X0 + X / TS * S - R, Y0 + Y / TS * S - R, R * 2, R * 2)};
 for(const C of Dg.Chests) if(!C.Open && Dg.Seen[TileOf(C.X, C.Y)]) Dot(C.X, C.Y, '#ffd54a', 1.5);
 for(const C of Crystals) if(!C.Got) Dot(C.X, C.Y, '#ffc857', 1.5);
 if(Zone) Dot(Zone.X, Zone.Y, '#ffc857', 3);
 for(const O of (Party.Host ? Party.Remotes.map(R => R.P) : Party.Others)) Dot(O.X, O.Y, '#ffffff', 1.5);
 Dot(Player.X, Player.Y, '#4ff0d6', 2); Context.globalAlpha = 1; Context.strokeStyle = '#2a3370'; Context.lineWidth = 1; Context.strokeRect(X0 - 3, Y0 - 3, GN * S + 6, GN * S + 6);
}
const TraitTickDG = TraitTick;
TraitTick = function(Dt){TraitTickDG(Dt); if(Player && Mode === 'play') DungeonTick(Dt)};
GenDungeon(1);

/* ---------- v12: infinite upgrade tree (replaces the Workshop) ---------- */
const Tree = [
 {K: 'Vigor', N: 'Vigor', B: 'Survival', Per: 10, U: ' max HP', Base: 12, Req: null},
 {K: 'Plate', N: 'Plating', B: 'Survival', Per: .6, U: ' defense', Base: 14, Req: ['Vigor', 3]},
 {K: 'Regen', N: 'Regeneration', B: 'Survival', Per: .2, U: ' HP/s', Base: 16, Req: ['Plate', 3], Cap: 4},
 {K: 'Dodge', N: 'Evasion', B: 'Survival', Per: .012, P: 1, Base: 20, Req: ['Regen', 3], Cap: .4},
 {K: 'Leech', N: 'Leech', B: 'Survival', Per: .004, P: 1, Base: 18, Req: ['Vigor', 5], Cap: .12},
 {K: 'Might', N: 'Might', B: 'Offense', Per: .5, U: ' damage', Base: 14, Req: null},
 {K: 'Haste', N: 'Haste', B: 'Offense', Per: .03, P: 1, Base: 18, Req: ['Might', 3], Cap: .9},
 {K: 'Blast', N: 'Blast Core', B: 'Offense', Per: 6, U: ' blast radius', Base: 16, Req: ['Haste', 3], Cap: 140},
 {K: 'Prime', N: 'Prime', B: 'Offense', Per: .25, U: ' start element levels', Base: 30, Req: ['Might', 6], Int: 1},
 {K: 'Thrust', N: 'Thrusters', B: 'Utility', Per: .025, P: 1, Base: 12, Req: null, Cap: .7},
 {K: 'Magnet', N: 'Magnet', B: 'Utility', Per: 15, U: ' pickup range', Base: 10, Req: ['Thrust', 3], Cap: 300},
 {K: 'Scholar', N: 'Scholar', B: 'Utility', Per: .04, P: 1, Base: 14, Req: ['Magnet', 3], Cap: 1},
 {K: 'Fortune', N: 'Fortune', B: 'Utility', Per: .03, P: 1, Base: 16, Req: ['Scholar', 3], Cap: .6},
 {K: 'Banker', N: 'Banker', B: 'Utility', Per: .04, P: 1, Base: 18, Req: ['Fortune', 3], Cap: 1},
 {K: 'Quick', N: 'Quickstep', B: 'Skills', Per: .1, U: 's dash cooldown', Base: 12, Req: null, Cap: 1.1},
 {K: 'NovaC', N: 'Nova Core', B: 'Skills', Per: 1, U: 's nova cooldown', Base: 14, Req: ['Quick', 3], Cap: 9},
 {K: 'Spare', N: 'Rerolls', B: 'Skills', Per: .34, U: ' extra rerolls', Base: 22, Req: ['Quick', 4], Int: 1},
 {K: 'Head', N: 'Head Start', B: 'Skills', Per: .25, U: ' upgrade at run start', Base: 40, Req: ['NovaC', 3], Int: 1}
];
const TreeBy = Object.fromEntries(Tree.map(N => [N.K, N]));
const EffLv = L => L <= 10 ? L : 10 + 6 * Math.log2(1 + (L - 10) / 6);
const TreeAt = (N, L) => {let V = N.Per * EffLv(L); if(N.Int) V = Math.floor(V + 1e-9); if(N.Cap !== undefined) V = Math.min(N.Cap, V); return V};
const TreeVal = K => TreeAt(TreeBy[K], (Meta.Up && Meta.Up[K]) || 0);
const TreeCost = (N, L) => Math.round(N.Base * Math.pow(1.24, L));
const TreeOpen = N => !N.Req || ((Meta.Up[N.Req[0]] || 0) >= N.Req[1]);
function TreeBuy(K){const N = TreeBy[K]; if(!N) return false; const L = Meta.Up[K] || 0, C = TreeCost(N, L); if(!TreeOpen(N) || Meta.Shards < C) return false; Meta.Shards -= C; Meta.Up[K] = L + 1; SaveMeta(); return true}
function ApplyTree(){
 const V = K => TreeVal(K);
 Stats.MaximumHealth += V('Vigor'); Player.Hp = Stats.MaximumHealth; Stats.Defense += V('Plate'); Stats.Regeneration += V('Regen');
 Stats.Evasion = Math.min(StatCaps.Evasion, Stats.Evasion + V('Dodge')); Stats.Lifesteal = Math.min(StatCaps.Lifesteal, Stats.Lifesteal + V('Leech'));
 Stats.Damage += V('Might'); Stats.FireRate *= 1 + V('Haste'); Stats.BlastRadius += V('Blast'); Elem[SelElem] += V('Prime');
 Stats.MovementSpeed *= 1 + V('Thrust'); Stats.PickupRange += V('Magnet'); Stats.ExperienceBonus += V('Scholar'); Stats.Luck += V('Fortune');
 Rerolls += V('Spare'); Pending += V('Head');
}
function TreeNode(N){
 const L = Meta.Up[N.K] || 0, Open = TreeOpen(N), C = TreeCost(N, L), Can = Open && Meta.Shards >= C;
 const Fmt = V => N.P ? '+' + (V * 100).toFixed(V * 100 < 10 ? 1 : 0) + '%' : '+' + (N.Int ? V : +V.toFixed(2)) + (N.U || '');
 return `<button class="TNode ${N.Req ? 'Child' : ''} ${Open ? '' : 'Lock'} ${Can ? 'Can' : ''}" data-up="${N.K}" title="${N.N} · Shift-click buys 10"><span class="TName">${N.N}<b>Lv ${L}</b></span><span class="TEff">${Fmt(TreeAt(N, L))} → ${Fmt(TreeAt(N, L + 1))}</span><span class="TCost">${Open ? '◆ ' + C : 'Needs ' + TreeBy[N.Req[0]].N + ' ' + N.Req[1]}</span></button>`;
}
function TreeHtml(){return `<div class="TreeGrid">${['Survival', 'Offense', 'Utility', 'Skills'].map(B => `<div class="TreeCol"><div class="TreeHead">${B}</div>${Tree.filter(N => N.B === B).map(TreeNode).join('')}</div>`).join('')}</div>`}

/* ---------- v11: multiplayer — party-based online co-op (host-authoritative, WebRTC) ----------
   The host runs the whole game for up to 4 players; guests send inputs and draw what the host sends.
   Lobby + connection handshake go through Firestore (parties/{code} and parties/{code}/peers/{uid}).        */
const Party = {On: false, Host: false, Ready: false, View: '', Code: '', Id: '', Cfg: null, State: 'idle', Members: [], Remotes: [], Conns: {}, Guest: null, Msg: '', List: [], Unsub: [], Handled: {}, Reserved: null, Save: null, Names: {}, Others: [], Evs: [], MenuOpen: false, SnapT: 0, InT: 0, EnId: 1, NovaReq: 0, Wait: false, Timer: null, Locks: [], Answered: false, Lobby: null};
const IsGuest = () => Party.On && !Party.Host;
const SafeName = T => String(T || '').replace(/[^A-Za-z0-9 _.\-]/g, '').trim().slice(0, 16) || 'Player';
const CodeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MakeCode = () => Array.from({length: 6}, () => CodeChars[Math.floor(Math.random() * CodeChars.length)]).join('');
let IceCache = null, IceAt = 0;
async function GetIce(){
 if(window.__ICE) return {iceServers: window.__ICE};
 const Base = {iceServers: [{urls: 'stun:stun.cloudflare.com:3478'}].concat(FirebaseOptions.turnServers || [])};
 if(!FirebaseOptions.turnUrl) return Base;
 if(IceCache && Date.now() - IceAt < 3600e3) return IceCache;
 try{const R = await fetch(FirebaseOptions.turnUrl, {method: 'POST'}), J = await R.json(); if(J && Array.isArray(J.iceServers) && J.iceServers.length){IceCache = {iceServers: J.iceServers}; IceAt = Date.now(); return IceCache}}catch(Err){}
 return Base;
}
const CleanUp = U => {const O = {}; for(const N of Tree){const V = U && Number.isFinite(U[N.K]) ? Math.floor(U[N.K]) : 0; if(V > 0) O[N.K] = Math.min(300, V)} return O};
const FreshCfg = () => ({name: (Acct ? PublicName() : 'My') + ' party', public: false, max: 4, mode: SelMode, diff: SelDiff, mut: Object.assign({}, Mut)});

/* ----- multi-target helpers used by the patched simulation ----- */
function NearT(X, Y){
 let B = null, BD = 1e12;
 if(!Player.Down){B = {X: Player.X, Y: Player.Y, S: Stats, Host: true}; BD = (Player.X - X) ** 2 + (Player.Y - Y) ** 2}
 for(const R of Party.Remotes){if(!R.Alive) continue; const D = (R.P.X - X) ** 2 + (R.P.Y - Y) ** 2; if(D < BD){BD = D; B = {X: R.P.X, Y: R.P.Y, S: R.S, R}}}
 return B || {X: Player.X, Y: Player.Y, S: Stats, Host: true};
}
const PartyNear = (X, Y, Rad) => (!Player.Down && Math.hypot(X - Player.X, Y - Player.Y) < Rad) || Party.Remotes.some(Q => Q.Alive && Math.hypot(X - Q.P.X, Y - Q.P.Y) < Rad);
const RemoteBy = U => Party.Remotes.find(R => R.Uid === U) || null;
const CamT = () => Player.Down ? ((Party.Host ? (Party.Remotes.find(R => R.Alive) || {}).P : Party.Others.find(O => O.Al)) || Player) : Player;
var CurOwner = null;
function AsPlayer(R, Fn){
 const sP = Player, sS = Stats, sE = Elem, sL = LastElem, sA = Aim, sO = CurOwner, sM = Muting, sU = Meta.Up;
 Player = R.P; Stats = R.S; Elem = R.E; LastElem = R.Last || LastElem; Aim = R.In.a || 0; CurOwner = R.Uid; Muting = true; if(R.Up) Meta.Up = R.Up;
 try{return Fn()}finally{R.Last = LastElem; Player = sP; Stats = sS; Elem = sE; LastElem = sL; Aim = sA; CurOwner = sO; Muting = sM; Meta.Up = sU}
}
function HurtRemote(R, Amount, Src){
 if(!R.Alive || R.P.Inv > 0 || Mode !== 'play') return;
 if(Math.random() < R.S.Evasion){R.P.Inv = .25; return}
 const Def = AsPlayer(R, EffDefense), Taken = Math.max(1, Amount * (1 - Def / (Def + 25)));
 R.P.Hp -= Taken; R.P.Inv = .5; Burst(R.P.X, R.P.Y, '#ff5d73', 6, 140, .35);
 if(R.P.Hp <= 0){R.Alive = false; R.P.Hp = 0; Burst(R.P.X, R.P.Y, '#ff5d73', 30, 240, .7); Ring(R.P.X, R.P.Y, '#ff5d73', 80, .5); FloatText(R.P.X, R.P.Y - 30, R.Name + ' is down', '#ff5d73'); PartyCheckWipe()}
}
function PartyContact(){
 if(!Party.Remotes.length) return;
 for(const A of Enemies){if(A.SpawnLeft > 0) continue; for(const R of Party.Remotes) if(R.Alive && Math.hypot(R.P.X - A.X, R.P.Y - A.Y) < A.Radius + PlayerRadius + 2) HurtRemote(R, A.Damage, A)}
}
function PartyBolt(Eb){for(const R of Party.Remotes) if(R.Alive && Math.hypot(Eb.X - R.P.X, Eb.Y - R.P.Y) < PlayerRadius){HurtRemote(R, Eb.Damage); Eb.Life = 0; return}}
function PartyBonus(){for(const R of Party.Remotes){R.Pending++; R.P.Hp = Math.min(R.S.MaximumHealth, R.P.Hp + R.S.MaximumHealth * .25)}}
function PartyCheckWipe(){if(Party.On && Party.Host && Player.Down && !Party.Remotes.some(R => R.Alive)){Player.Down = false; Player.Hp = 1; PlayerDiePM()}}
function ReviveAll(){
 if(!(Party.On && Party.Host)) return;
 if(Player.Down){Player.Down = false; Player.Hp = Stats.MaximumHealth * .5; Player.Inv = 2}
 for(const R of Party.Remotes) if(!R.Alive){R.Alive = true; R.P.Hp = R.S.MaximumHealth * .5; R.P.Inv = 2}
}
const HurtPlayerPM = HurtPlayer;
HurtPlayer = function(A, S){if(Player.Down) return false; return HurtPlayerPM(A, S)};
const PlayerDiePM = PlayerDie;
PlayerDie = function(){
 if(Party.On && Party.Host && Party.Remotes.some(R => R.Alive)){Player.Down = true; Player.Hp = 0; Player.Inv = 99; Burst(Player.X, Player.Y, '#ff5d73', 30, 240, .7); Ring(Player.X, Player.Y, '#ff5d73', 80, .5); FloatText(Player.X, Player.Y - 30, 'DOWN', '#ff5d73'); return}
 PlayerDiePM();
};
const OpenLevelPM = OpenLevel;
OpenLevel = function(){if(Party.On){PartyUpgradeAuto(); return} OpenLevelPM()};
const StartRoundPM = StartRound;
StartRound = function(){StartRoundPM(); if(Party.Ready){ReviveAll(); PartySaveNow()}};
const ShowBannerPM = ShowBanner;
ShowBanner = function(T, S, C){ShowBannerPM(T, S, C); if(Party.On && Party.Host && Party.Ready) PartyBroadcast({t: 'bn', a: [T, S, C]})};
const KillEnemyPM = KillEnemy;
KillEnemy = function(En){KillEnemyPM(En); if(Party.On && Party.Host && Party.Evs.length < 30) Party.Evs.push([Math.round(En.X), Math.round(En.Y), En.Color])};
const ApplyElementPM = ApplyElement;
ApplyElement = function(En, Bt){const R = Bt.Ow ? RemoteBy(Bt.Ow) : null; if(R) AsPlayer(R, () => ApplyElementPM(En, Bt)); else ApplyElementPM(En, Bt)};
const UpdateDifficultyPM = UpdateDifficulty;
UpdateDifficulty = function(){UpdateDifficultyPM(); if(Party.On && Party.Host) Diff *= 1 + .3 * Party.Remotes.length};
const NovaCore = Nova;
Nova = function(){
 if(IsGuest()){
  if(Mode !== 'play' || !Player || (Player.NovaCd || 0) > 0 || Player.Down) return;
  Player.NovaCd = NovaMax(); Party.NovaReq++; Ring(Player.X, Player.Y, Elems[LastElem].Color, 200, .5); Shake = Math.max(Shake, 6); return;
 }
 NovaCore();
};
const PausePM = Pause;
Pause = function(){
 if(!Party.On) return PausePM();
 if(Party.MenuOpen){Party.MenuOpen = false; Ui.className = ''} else if(Mode === 'play'){Party.MenuOpen = true; Party.UpOpen = false; RenderPause()}
};

/* ----- upgrades: every player levels on their own and picks when they like; the game never pauses ----- */
const RemoteXp = (R, V) => {const sP = Pending; Pending = R.Pending; try{AsPlayer(R, () => GainXp(V))}finally{R.Pending = Pending; Pending = sP}};
function PartyXp(Tg, V){if(Tg && Tg.R) RemoteXp(Tg.R, V); else GainXp(V)}
function PartyXpAll(V){GainXp(V); for(const R of Party.Remotes) RemoteXp(R, V)}
function HostLevelDone(){Mode = 'play'; Ui.className = ''}
function PartyOffersFor(R){
 if(R.Pending > 0){R.Offers = AsPlayer(R, RollOffers); PartySend(R.Uid, {t: 'offers', o: R.Offers, p: R.Pending, rr: R.Rerolls})}
 else{R.Offers = null; PartySend(R.Uid, {t: 'offers', o: [], p: 0, rr: R.Rerolls})}
}
function HostPick(U, I){
 const R = RemoteBy(U); if(!R || !R.Offers || !R.Offers[I] || R.Pending <= 0) return;
 AsPlayer(R, () => ApplyOffer(R.Offers[I])); R.Pending--; R.Offers = null;
 PartySend(U, {t: 'self', S: R.S, E: R.E, L: R.Last}); PartyOffersFor(R);
}
function HostReroll(U){const R = RemoteBy(U); if(R && R.Offers && R.Rerolls > 0){R.Rerolls--; R.Offers = AsPlayer(R, RollOffers); PartySend(U, {t: 'offers', o: R.Offers, p: R.Pending, rr: R.Rerolls})}}
function PartyUpgradeOpen(){
 if(Pending <= 0 || Mode !== 'play') return;
 if(!Offers || !Offers.length){if(Party.Host) Offers = RollOffers(); else return}
 Party.UpOpen = true; Joys.Move = null; Joys.Aim = null; Ui.className = 'On Light';
 Ui.innerHTML = `<div class="Box Wide UpPanel"><h2>Level ${Player.Level}</h2><p>${Pending} upgrade${Pending > 1 ? 's' : ''} ready. The game keeps running.</p><div class="Cards">${Offers.map((O, I) => CardHtml(O, I, false)).join('')}</div><div class="Row"><button class="Btn Alt" data-act="reroll" ${Rerolls <= 0 ? 'disabled' : ''}>Reroll (${Rerolls} left)</button><button class="Btn Alt" data-act="upclose">Later</button></div></div>`;
}
function PartyUpgradeClose(Snooze){Party.UpOpen = false; if(Snooze) Party.UpSnooze = performance.now() + 15000; if(!Party.MenuOpen && Mode === 'play') Ui.className = ''}
function PartyUpgradeToggle(){if(Party.UpOpen) PartyUpgradeClose(true); else{Party.UpSnooze = 0; PartyUpgradeOpen()}}
function PartyUpgradeAuto(){
 if(Pending <= 0 || Party.UpOpen || Party.MenuOpen || Mode !== 'play' || Ui.className.indexOf('On') >= 0 || performance.now() < (Party.UpSnooze || 0)) return;
 if(Party.Host && (!Offers || !Offers.length)) Offers = RollOffers();
 if(!Offers || !Offers.length) return;
 if(!Enemies.some(E => !(E.SpawnLeft > 0) && Math.hypot(E.X - Player.X, E.Y - Player.Y) < 280)) PartyUpgradeOpen();
}
function PartyPick(I){
 if(Party.Host){if(Offers[I]){ApplyOffer(Offers[I]); Pending--; Offers = []; if(Pending > 0){Offers = RollOffers(); PartyUpgradeOpen()} else PartyUpgradeClose()}}
 else{Party.Chain = true; PartyGuestSend({t: 'pick', i: I}); Offers = []; PartyUpgradeClose()}
}
function PartyReroll(){
 if(Party.Host){if(Rerolls > 0 && Offers.length){Rerolls--; Offers = RollOffers(); PartyUpgradeOpen()}}
 else PartyGuestSend({t: 'reroll'});
}
const UpBadge = document.createElement('button'); UpBadge.id = 'UpBadge'; document.body.appendChild(UpBadge);
UpBadge.addEventListener('click', () => {Party.UpSnooze = 0; PartyUpgradeOpen()});
function PartyBadge(){
 const Show = Party.On && Party.Ready && Pending > 0 && !Party.UpOpen && !Party.MenuOpen && Mode === 'play' && Ui.className === '';
 UpBadge.style.display = Show ? 'block' : 'none'; if(Show) UpBadge.textContent = '⬆ Upgrade ready' + (Pending > 1 ? ' ×' + Pending : '') + ' · U';
}
const DashPM2 = Dash;
Dash = function(){const Ready = IsGuest() && Mode === 'play' && Player && !((Player.DashCd || 0) > 0) && !Player.Down; DashPM2(); if(Ready && (Player.DashCd || 0) > 0) Party.DashT = .35};

/* ----- networking: connections, messages ----- */
function WaitIce(pc){return new Promise(Res => {if(pc.iceGatheringState === 'complete') return Res(); const T = setTimeout(Res, 3500); pc.addEventListener('icegatheringstatechange', () => {if(pc.iceGatheringState === 'complete'){clearTimeout(T); Res()}})})}
function MakeConn(pc, Uid){
 const C = {pc, Uid, ctl: null, dat: null, Known: new Set(), Last: performance.now(), Hello: false, Up: {}, Name: 'Player'};
 C.Send = (O, Fast) => {const Ch = Fast && C.dat && C.dat.readyState === 'open' ? C.dat : C.ctl; if(!Ch || Ch.readyState !== 'open') return; if(Fast && Ch.bufferedAmount > 65536) return; try{Ch.send(JSON.stringify(O))}catch(Err){}};
 return C;
}
function WireChannel(C, Ch, IsHost){
 if(Ch.label === 'ctl') C.ctl = Ch; else C.dat = Ch;
 Ch.onmessage = E => {C.Last = performance.now(); let M; try{M = JSON.parse(E.data)}catch(Err){return} IsHost ? HostMsg(C.Uid, M) : GuestMsg(M)};
 Ch.onopen = () => {if(!IsHost && Ch.label === 'ctl') C.Send({t: 'hello', n: PublicName(), up: Meta.Up})};
 Ch.onclose = () => {if(Ch.label === 'ctl'){if(IsHost) HostDrop(C.Uid); else if(Party.Guest === C) GuestLost('The host closed the connection.')}};
}
function PartySend(U, O, Fast){const C = Party.Conns[U]; if(C) C.Send(O, Fast)}
function PartyBroadcast(O, Fast){for(const U in Party.Conns) Party.Conns[U].Send(O, Fast)}
function PartyGuestSend(O, Fast){if(Party.Guest) Party.Guest.Send(O, Fast)}

async function HostWatchPeers(){
 const M = await FbLoad(), Col = M.F.collection(M.db, 'parties', Party.Code, 'peers');
 Party.Unsub.push(M.F.onSnapshot(Col, Snap => {
  for(const D of Snap.docs){
   const X = D.data(), Key = D.id + ':' + (X.Updated || 0);
   if(!X.offer || X.answer || Party.Handled[Key]) continue;
   Party.Handled[Key] = true; HostAccept(D.id, X).catch(Err => {Party.Msg = 'Join failed: ' + (Err.message || Err); RenderParty()});
  }
 }));
}
async function HostAccept(Uid, X){
 const M = await FbLoad(); if(Party.Conns[Uid]){try{Party.Conns[Uid].pc.close()}catch(Err){}}
 const pc = new RTCPeerConnection(await GetIce()), C = MakeConn(pc, Uid); C.Name = SafeName(X.name); Party.Conns[Uid] = C;
 pc.ondatachannel = E => WireChannel(C, E.channel, true);
 pc.onconnectionstatechange = () => {if(pc.connectionState === 'failed') HostDrop(Uid)};
 await pc.setRemoteDescription({type: 'offer', sdp: X.offer}); await pc.setLocalDescription(await pc.createAnswer()); await WaitIce(pc);
 await M.F.updateDoc(M.F.doc(M.db, 'parties', Party.Code, 'peers', Uid), {answer: pc.localDescription.sdp, Updated: Date.now()});
}
const LockedElems = Except => {const S = new Set(Party.Members.filter(M => M.Uid !== Except).map(M => M.Elem)); if(Party.Reserved) for(const [U, E] of Party.Reserved) if(U !== Except && !Party.Members.some(M => M.Uid === U)) S.add(E); return S};
const FreeElem = Uid => ElemNames.find(N => !LockedElems(Uid).has(N)) || null;
function HostMsg(U, m){
 const C = Party.Conns[U]; if(!C || !m) return;
 if(m.t === 'hello'){
  if(C.Hello) return; C.Hello = true; if(Fb && Party.Code){try{Fb.F.deleteDoc(Fb.F.doc(Fb.db, 'parties', Party.Code, 'peers', U)).catch(() => {})}catch(Err){}} C.Up = CleanUp(m.up); C.Name = SafeName(m.n || C.Name);
  const Res = Party.Reserved, Mem = Party.Members, Already = Mem.some(x => x.Uid === U);
  let Why = '';
  if(Party.State !== 'lobby') Why = 'This party already started.';
  else if(!Already && Mem.length >= Party.Cfg.max) Why = 'This party is full.';
  else if(!Already && Res && !Res.has(U) && Mem.filter(x => !Res.has(x.Uid)).length >= Party.Cfg.max - Res.size) Why = 'This saved party only has room for its original players.';
  const El = Res && Res.has(U) ? Res.get(U) : FreeElem(U);
  if(!Why && !El) Why = 'No elements are left.';
  if(Why){C.Send({t: 'reject', why: Why}); setTimeout(() => HostDrop(U, true), 400); return}
  if(!Already) Mem.push({Uid: U, Name: C.Name, Elem: El, Ready: false});
  PartyLobbyChanged();
 }
 else if(m.t === 'elem'){const Mm = Party.Members.find(x => x.Uid === U); if(Mm && Party.State === 'lobby' && ElemNames.includes(m.e) && !(Party.Reserved && Party.Reserved.has(U)) && !LockedElems(U).has(m.e)){Mm.Elem = m.e; Mm.Ready = false; PartyLobbyChanged()}}
 else if(m.t === 'ready'){const Mm = Party.Members.find(x => x.Uid === U); if(Mm && Party.State === 'lobby'){Mm.Ready = !!m.v; PartyLobbyChanged()}}
 else if(m.t === 'leave') HostDrop(U);
 else if(m.t === 'in'){const R = RemoteBy(U); if(R && Number.isFinite(m.x) && Number.isFinite(m.y)){const I = R.In; I.g = m.g; I.x = m.x; I.y = m.y; I.a = Number.isFinite(m.a) ? m.a : I.a; I.f = m.f ? 1 : 0; I.i = m.i ? 1 : 0; I.n = Number.isFinite(m.n) ? m.n : I.n}}
 else if(m.t === 'pick') HostPick(U, m.i);
 else if(m.t === 'reroll') HostReroll(U);
}
function HostDrop(U, Silent){
 const C = Party.Conns[U]; if(C){try{C.pc.close()}catch(Err){} delete Party.Conns[U]}
 const I = Party.Members.findIndex(x => x.Uid === U);
 if(I >= 0 && !Silent){
  Party.Members.splice(I, 1);
  if(Party.State === 'play'){const R = RemoteBy(U); if(R){Party.Remotes = Party.Remotes.filter(x => x !== R); FloatText(Player.X, Player.Y - 40, R.Name + ' left', '#8f98c8'); if(Party.Wait && Pending <= 0) HostLevelDone()}}
  else PartyLobbyChanged();
 }
}
function PartyCfgPublic(){return {name: Party.Cfg.name, mode: Party.Cfg.mode, diff: Party.Cfg.diff, mut: Party.Cfg.mut, max: Party.Cfg.max, pub: Party.Cfg.public ? 1 : 0}}
function PartyLobbyChanged(){
 const Locks = Party.Reserved ? [...Party.Reserved].filter(([U]) => !Party.Members.some(M => M.Uid === U)).map(([U, E]) => E) : [];
 Party.Lobby = {t: 'lobby', code: Party.Code, m: Party.Members.map(x => ({u: x.Uid, n: x.Name, e: x.Elem, r: x.Ready ? 1 : 0})), cfg: PartyCfgPublic(), lk: Locks, res: Party.Reserved ? 1 : 0};
 PartyBroadcast(Party.Lobby); Party.Locks = Locks; RenderParty(); PartyDocPatch({count: Party.Members.length, expiresAt: Date.now() + 30 * 60e3});
}
async function PartyDocPatch(P){if(!Party.Host || !Party.Code || !Fb) return; try{await Fb.F.updateDoc(Fb.F.doc(Fb.db, 'parties', Party.Code), P)}catch(Err){}}
const PartyDoc = () => ({code: Party.Code, hostUid: Acct.uid, hostName: PublicName(), name: Party.Cfg.name, public: !!Party.Cfg.public, mode: Party.Cfg.mode, diff: Party.Cfg.diff, mutN: Object.values(Party.Cfg.mut).filter(Boolean).length, max: Party.Cfg.max, count: Party.Members.length, state: 'lobby', resume: Party.Reserved ? 1 : 0, createdAt: Date.now(), expiresAt: Date.now() + 30 * 60e3});

function PartyReady(){
 if(!FbReady){Party.Msg = 'Online features are not set up yet.'; return false}
 if(!Acct){Party.Msg = 'Sign in to play multiplayer.'; return false}
 if(!Acct.verified){Party.Msg = 'Verify your email first (Account screen).'; return false}
 return true;
}
async function PartyCreate(Save){
 if(!PartyReady()){RenderParty(); return}
 Party.Msg = 'Creating party…'; RenderParty();
 try{
  const M = await FbLoad();
  try{const Old = await M.F.getDocs(M.F.query(M.F.collection(M.db, 'parties'), M.F.where('hostUid', '==', Acct.uid))); for(const D of Old.docs) await M.F.deleteDoc(M.F.doc(M.db, 'parties', D.id))}catch(Err){}
  let Code = MakeCode(), T = 0; while(T++ < 5){const S = await M.F.getDoc(M.F.doc(M.db, 'parties', Code)); if(!S.exists()) break; Code = MakeCode()}
  Party.Cfg = Party.Cfg || FreshCfg(); Party.Code = Code; Party.On = true; Party.Host = true; Party.State = 'lobby'; Party.Ready = false; Party.Handled = {}; Party.Conns = {}; Party.Remotes = []; Party.Save = Save || null;
  Party.Id = Save ? Save.Id : 'P' + Date.now().toString(36); Party.Reserved = Save ? new Map(Save.Members.map(Mm => [Mm.Uid, Mm.Elem0])) : null;
  const HostEl = Save && Party.Reserved.get(Acct.uid) ? Party.Reserved.get(Acct.uid) : SelElem;
  Party.Members = [{Uid: Acct.uid, Name: PublicName(), Elem: HostEl, Ready: true, Host: true}];
  await M.F.setDoc(M.F.doc(M.db, 'parties', Code), PartyDoc());
  await HostWatchPeers(); Party.View = 'lobby'; Party.Msg = '';
  clearInterval(Party.Timer); Party.Timer = setInterval(PartyWatch, 3000);
  PartyLobbyChanged();
 }catch(Err){Party.On = false; Party.Host = false; Party.Msg = 'Could not create the party: ' + FbErr(Err); Party.View = 'host'; RenderParty()}
}
async function GuestJoin(Code){
 Code = String(Code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
 if(!PartyReady()){RenderParty(); return}
 if(Code.length !== 6){Party.Msg = 'Enter the 6-character party code.'; RenderParty(); return}
 Party.View = 'connecting'; Party.Msg = 'Connecting…'; RenderParty();
 try{
  const M = await FbLoad(), PS = await M.F.getDoc(M.F.doc(M.db, 'parties', Code));
  if(!PS.exists()){Party.View = 'hub'; Party.Msg = 'No party with that code.'; RenderParty(); return}
  const D = PS.data(); if(D.state !== 'lobby' || D.expiresAt < Date.now()){Party.View = 'hub'; Party.Msg = 'That party is not open.'; RenderParty(); return}
  const pc = new RTCPeerConnection(await GetIce()), C = MakeConn(pc, D.hostUid);
  Party.On = true; Party.Host = false; Party.Code = Code; Party.Guest = C; Party.Answered = false; Party.Names = {}; Party.Cfg = {name: D.name, mode: D.mode, diff: D.diff, mut: {}, max: D.max};
  WireChannel(C, pc.createDataChannel('ctl'), false); WireChannel(C, pc.createDataChannel('dat', {ordered: false, maxRetransmits: 0}), false);
  pc.onconnectionstatechange = () => {if(pc.connectionState === 'failed') GuestLost('Could not connect to the host.')};
  await pc.setLocalDescription(await pc.createOffer()); await WaitIce(pc);
  const Ref = M.F.doc(M.db, 'parties', Code, 'peers', Acct.uid);
  await M.F.setDoc(Ref, {offer: pc.localDescription.sdp, name: PublicName(), Updated: Date.now()});
  Party.Unsub.push(M.F.onSnapshot(Ref, async S => {if(S.exists() && S.data().answer && !Party.Answered){Party.Answered = true; try{await pc.setRemoteDescription({type: 'answer', sdp: S.data().answer})}catch(Err){}}}));
  clearInterval(Party.Timer); Party.Timer = setInterval(PartyWatch, 3000);
  setTimeout(() => {if(Party.Guest === C && !(C.ctl && C.ctl.readyState === 'open')) GuestLost('Could not connect. The host may be behind a strict network (a TURN relay would help).')}, 25000);
 }catch(Err){GuestLost('Could not join: ' + FbErr(Err))}
}
function GuestLost(Why){
 const Playing = Party.State === 'play'; PartyLeave(); Mode = 'menu'; Player = null; Party.View = 'hub'; Party.Msg = Why;
 if(Playing) Ui.className = 'On'; ShowMenu();
}
function PartyWatch(){
 const Now = performance.now();
 if(Party.Host){for(const U in Party.Conns) if(Now - Party.Conns[U].Last > 14000) HostDrop(U); PartyBroadcast({t: 'ping'}); if(Party.Code && Date.now() - (Party.Beat || 0) > 480000){Party.Beat = Date.now(); PartyDocPatch({expiresAt: Date.now() + 30 * 60e3})}}
 else if(Party.Guest){PartyGuestSend({t: 'ping'}); if(Now - Party.Guest.Last > 15000) GuestLost('Lost the connection to the host.')}
}
function PartyReset(){
 clearInterval(Party.Timer);
 Object.assign(Party, {UpOpen: false, Chain: false, GDG: undefined, DashT: 0, On: false, Host: false, Ready: false, View: '', Code: '', Id: '', Cfg: null, State: 'idle', Members: [], Remotes: [], Conns: {}, Guest: null, Handled: {}, Unsub: [], Reserved: null, Save: null, Names: {}, Others: [], Evs: [], MenuOpen: false, Wait: false, Locks: [], Lobby: null, Answered: false, SnapT: 0, InT: 0});
 if(Player) Player.Down = false;
}
function PartyLeave(){
 const WasHost = Party.Host, Code = Party.Code;
 for(const U in Party.Conns){try{Party.Conns[U].Send({t: 'reject', why: 'The host left the party.'}); Party.Conns[U].pc.close()}catch(Err){}}
 if(Party.Guest){try{Party.Guest.Send({t: 'leave'}); Party.Guest.pc.close()}catch(Err){}}
 for(const F of Party.Unsub){try{F()}catch(Err){}}
 if(Fb && Code && Acct){try{if(WasHost) Fb.F.deleteDoc(Fb.F.doc(Fb.db, 'parties', Code)); else Fb.F.deleteDoc(Fb.F.doc(Fb.db, 'parties', Code, 'peers', Acct.uid))}catch(Err){}}
 PartyReset();
}
addEventListener('pagehide', () => {if(Party.On && Party.Host && Fb && Party.Code){try{Fb.F.deleteDoc(Fb.F.doc(Fb.db, 'parties', Party.Code))}catch(Err){}}});

/* ----- guest messages ----- */
const GEn = new Map(), GStatic = new Map();
function GuestMsg(m){
 if(!m) return;
 if(m.t === 'lobby'){Party.Lobby = m; Party.Members = m.m.map(x => ({Uid: x.u, Name: x.n, Elem: x.e, Ready: !!x.r})); Party.Cfg = Object.assign(Party.Cfg || {}, m.cfg, {public: !!m.cfg.pub}); Party.Locks = m.lk || []; Party.Names = Object.fromEntries(m.m.map(x => [x.u, x.n])); Party.State = 'lobby'; if(Mode === 'menu'){Party.View = 'lobby'; RenderParty()}}
 else if(m.t === 'reject'){const W = m.why; PartyLeave(); Mode = 'menu'; Player = null; Party.View = 'hub'; Party.Msg = W || 'The host removed you.'; ShowMenu()}
 else if(m.t === 'start') GuestBegin(m);
 else if(m.t === 'ne'){for(const S of m.a) GStatic.set(S.i, {Radius: S.r, Kind: S.k, Color: S.c, Sides: S.s, MaxHp: S.mh, Elite: !!S.el, Boss: S.bs || undefined, Trait: S.tr || undefined, Goblin: !!S.gb, SpawnTotal: S.st})}
 else if(m.t === 's') GuestSnap(m);
 else if(m.t === 'offers'){Offers = m.o; Pending = m.p; Rerolls = m.rr; if(m.p <= 0) PartyUpgradeClose(); else if(Party.UpOpen || Party.Chain){Party.Chain = false; PartyUpgradeOpen()}}
 else if(m.t === 'loot'){const N = Math.min(5, Math.max(0, m.sh | 0)); Meta.Shards += N; SaveMeta(); if(Player) FloatText(Player.X, Player.Y - 30, '+' + N + ' ◆', '#ffd54a')}
 else if(m.t === 'self'){Stats = m.S; Elem = m.E; if(m.L) LastElem = m.L}
 else if(m.t === 'bn') ShowBannerPM(m.a[0], m.a[1], m.a[2]);
 else if(m.t === 'over') PartyShowOver(m.i);
}
function GuestBegin(m){
 GEn.clear(); GStatic.clear(); Party.GDG = undefined; Party.UpOpen = false; Party.Chain = false; Party.DashT = 0; Party.State = 'play'; Party.Ready = true; Party.View = ''; Party.Names = m.names || {}; Party.MenuOpen = false;
 SelMode = ModeKey = m.cfg.mode; const Cfg = Modes[ModeKey]; Rounds = Cfg.Total ? Cfg.Total / Cfg.RoundLen : 0;
 Stats = m.you.S; Elem = m.you.E; LastElem = m.you.L || 'Fire'; Round = m.round; Pending = 0; Rerolls = 3; Shots = 0; Time = 0;
 Player = {X: m.you.x, Y: m.you.y, Hp: Stats.MaximumHealth, Inv: 0, Cooldown: 0, KnockX: 0, KnockY: 0, Xp: 0, Level: 1, Recoil: 0, Diff: m.cfg.diff, Mut: m.cfg.mut || {}, Down: false, DashCd: 0, NovaCd: 0};
 RunStats = {Kills: 0, Damage: 0, Time: 0}; Obj = {Type: 'slay', Have: 0, Need: 1, Done: false}; HpView = Player.Hp; Camera.X = Player.X; Camera.Y = Player.Y;
 Enemies = []; Bolts = []; EnemyBolts = []; Pickups = []; Crystals = []; Zone = null; Particles = []; Texts = []; Meteor = []; EventKey = null; Party.Others = [];
 Mode = 'play'; Ui.className = '';
}
function GuestSnap(m){
 if(!Player || Party.State !== 'play') return;
 if(m.dg !== Party.GDG){Party.GDG = m.dg; GenDungeon(m.sd); Dg.Seen.fill(0); GEn.clear(); const Me = m.pl.find(p => p[0] === Acct.uid); if(Me){Player.X = Me[1]; Player.Y = Me[2]; Camera.X = Player.X; Camera.Y = Player.Y}}
 if(m.ch) m.ch.forEach((V, I) => {if(Dg.Chests[I]) Dg.Chests[I].Open = !!V});
 Round = m.r; RoundTime = m.rt; Diff = m.df; Obj = {Type: m.ob[0], Have: m.ob[1], Need: m.ob[2], Done: !!m.ob[3]}; Player.Level = m.lv; Player.Xp = m.xp; RunStats.Kills = m.k; RunStats.Time = m.tm; EventKey = m.ev || null;
 Zone = m.z ? {X: m.z[0], Y: m.z[1], R: m.z[2]} : null; Crystals = (m.cr || []).map(a => ({X: a[0], Y: a[1], Phase: a[0] % 6, Got: !!a[2]}));
 Meteor = (m.mt || []).map(a => ({X: a[0], Y: a[1], T: a[2], R: a[3]}));
 Party.Others = [];
 for(const p of m.pl){
  if(p[0] === Acct.uid){Player.Hp = p[3]; Player.Down = !p[5]; Player.Inv = p[8] ? .5 : 0; if(Player.Down) Player.Hp = 0}
  else Party.Others.push({Uid: p[0], N: Party.Names[p[0]] || 'Player', X: p[1], Y: p[2], Hp: p[3], Mh: p[4], Al: !!p[5], Aim: p[6], El: p[7], Inv: p[8], Lv: p[9]});
 }
 const Seen = new Set(), Next = [];
 for(const a of m.en){
  const S = GStatic.get(a[0]); if(!S) continue; Seen.add(a[0]);
  let E = GEn.get(a[0]); if(!E){E = Object.assign({X: a[1], Y: a[2], KnockX: 0, KnockY: 0, SlowT: 0, StunT: 0, Flash: 0, Id: a[0]}, S); GEn.set(a[0], E)}
  const F = a[5]; E.tx = a[1]; E.ty = a[2]; E.Rot = a[3]; E.Hp = a[4]; E.Burn = F & 1 ? {T: 1} : null; E.SlowT = F & 2 ? 1 : 0; E.StunT = F & 4 ? 1 : 0; E.Shield = F & 8 ? E.MaxHp * .5 : 0; E.Tele = F & 16 ? 1 : 0; if(F & 32) E.Flash = .1;
  E.SpawnLeft = F & 64 ? a[6] / 100 : 0; if(E.Boss){E.Cast = a[7] || ''; E.SlamT = (a[8] || 0) / 100}
  Next.push(E);
 }
 for(const K of [...GEn.keys()]) if(!Seen.has(K)) GEn.delete(K);
 if(GStatic.size > 700) for(const K of [...GStatic.keys()]) if(!Seen.has(K)) GStatic.delete(K);
 Enemies = Next;
 Bolts = m.bl.map(b => ({X: b[0], Y: b[1], Vx: b[2], Vy: b[3], Elem: ElemNames[b[4]], Size: b[5], Crit: !!b[6], Hit: []}));
 EnemyBolts = m.eb.map(b => ({X: b[0], Y: b[1], Vx: b[2], Vy: b[3]}));
 Pickups = m.pk.map(b => ({X: b[0], Y: b[1], Phase: b[0] % 6, Value: 1}));
 for(const e of (m.kv || [])){Burst(e[0], e[1], e[2], 10, 160, .5); Ring(e[0], e[1], e[2], 30, .3)}
 if(m.kv && m.kv.length) PlaySfx('Kill');
}
function GuestUpdate(Dt){
 Time += Dt;
 const Down = Player.Down;
 let Mx = (Keys['d'] || Keys['arrowright'] ? 1 : 0) - (Keys['a'] || Keys['arrowleft'] ? 1 : 0), My = (Keys['s'] || Keys['arrowdown'] ? 1 : 0) - (Keys['w'] || Keys['arrowup'] ? 1 : 0);
 if(Joys.Move){Mx += Joys.Move.Dx / JoyRadius; My += Joys.Move.Dy / JoyRadius}
 let Len = Math.hypot(Mx, My); if(Len > 1){Mx /= Len; My /= Len}
 const Speed = Down ? 0 : EffSpeed();
 MoveW(Player, (Mx * Speed + Player.KnockX) * Dt, (My * Speed + Player.KnockY) * Dt, PlayerRadius);
 Player.KnockX *= Math.max(0, 1 - 9 * Dt); Player.KnockY *= Math.max(0, 1 - 9 * Dt); Player.Recoil = Math.max(0, Player.Recoil - Dt * 8);
 Player.DashCd = Math.max(0, (Player.DashCd || 0) - Dt); Player.NovaCd = Math.max(0, (Player.NovaCd || 0) - Dt); Player.Cooldown -= Dt; Party.DashT = Math.max(0, (Party.DashT || 0) - Dt);
 let Target = null, ND = Stats.Range;
 for(const En of Enemies){if(En.SpawnLeft > 0) continue; const D = Math.hypot(En.X - Player.X, En.Y - Player.Y) - En.Radius; if(D < ND){ND = D; Target = En}}
 if(AutoAim){if(Target) Aim = Math.atan2(Target.Y - Player.Y, Target.X - Player.X)}
 else if(InputMode === 'touch'){const J = Joys.Aim; if(J && Math.hypot(J.Dx, J.Dy) > 10) Aim = Math.atan2(J.Dy, J.Dx)}
 else Aim = Math.atan2(MouseY - (Height / 2 + (Player.Y - Camera.Y) * Zoom), MouseX - (Width / 2 + (Player.X - Camera.X) * Zoom));
 const Holding = InputMode === 'touch' ? !!(Joys.Aim && Math.hypot(Joys.Aim.Dx, Joys.Aim.Dy) > 10) : (Trigger || !!Keys[' ']);
 Firing = !Down && (AutoAim ? !!Target : Holding);
 if(Firing && Player.Cooldown <= 0){Player.Cooldown = 1 / EffFireRate(); Player.Recoil = 1}
 const K = Math.min(1, Dt * 14);
 for(const E of Enemies){if(E.tx !== undefined){E.X += (E.tx - E.X) * K; E.Y += (E.ty - E.Y) * K} E.Flash -= Dt; E.Rot = E.Rot}
 for(const B of Bolts){B.X += B.Vx * Dt; B.Y += B.Vy * Dt}
 for(const B of EnemyBolts){B.X += B.Vx * Dt; B.Y += B.Vy * Dt}
 Party.InT += Dt;
 if(Party.InT >= 1 / 30){Party.InT = 0; PartyGuestSend({t: 'in', g: Party.GDG, x: +Player.X.toFixed(1), y: +Player.Y.toFixed(1), a: +Aim.toFixed(3), f: Firing ? 1 : 0, i: Party.DashT > 0 ? 1 : 0, n: Party.NovaReq}, true)}
 if(Pending > 0) PartyUpgradeAuto();
 Party.SeenT = (Party.SeenT || 0) - Dt; if(Party.SeenT <= 0){Party.SeenT = .3; MarkSeen(Player)}
}
function GuestFrame(Dt, Blocked){PartyBadge(); if(Mode === 'play' && !Blocked) GuestUpdate(Dt); else if(Player) Time += Dt}

/* ----- host: remotes, snapshots ----- */
function PartyFrame(Dt, Blocked){
 PartyBadge();
 if(!Party.Host){GuestFrame(Dt, Blocked); return}
 if(Mode === 'play' && !Blocked && HitStop <= 0){Update(Dt); BoltFx(Dt); TraitTick(Dt)}
 PartyHostTick(Dt);
}
function PartyHostTick(Dt){
 if(Mode !== 'play' || !Party.Ready) return;
 for(const R of Party.Remotes){
  const I = R.In; R.P.Inv -= Dt; R.P.Cooldown -= Dt; R.P.NovaCd = Math.max(0, (R.P.NovaCd || 0) - Dt);
  if(R.Pending > 0 && !R.Offers) PartyOffersFor(R);
  if(!R.Alive) continue;
  if(I.g === Party.DGen && !HitW(I.x, I.y, PlayerRadius)){R.P.X = Clamp(I.x, PlayerRadius, Arena - PlayerRadius); R.P.Y = Clamp(I.y, PlayerRadius, Arena - PlayerRadius)}
  if(I.i) R.P.Inv = Math.max(R.P.Inv, .15);
  R.P.Hp = Math.min(R.S.MaximumHealth, R.P.Hp + R.S.Regeneration * Dt);
  if(I.f && R.P.Cooldown <= 0) AsPlayer(R, () => Volley(null));
  if(I.n !== R.NovaSeen){R.NovaSeen = I.n; if(!(R.P.NovaCd > 0)) AsPlayer(R, NovaCore)}
 }
 Party.SnapT += Dt;
 if(Party.SnapT >= 1 / 20){Party.SnapT = 0; PartySnapshots()}
}
function PartySnapshots(){
 const Evs = Party.Evs; Party.Evs = [];
 const Pl = [[Acct.uid, Math.round(Player.X), Math.round(Player.Y), Math.round(Player.Hp), Math.round(Stats.MaximumHealth), Player.Down ? 0 : 1, +Aim.toFixed(2), Math.max(0, ElemNames.indexOf(LastElem)), Player.Inv > 0 ? 1 : 0, Player.Level]];
 for(const R of Party.Remotes) Pl.push([R.Uid, Math.round(R.P.X), Math.round(R.P.Y), Math.round(R.P.Hp), Math.round(R.S.MaximumHealth), R.Alive ? 1 : 0, +(R.In.a || 0).toFixed(2), Math.max(0, ElemNames.indexOf(R.Last || 'Fire')), R.P.Inv > 0 ? 1 : 0, R.P.Level]);
 for(const R of Party.Remotes){
  const C = Party.Conns[R.Uid]; if(!C) continue; const cx = R.P.X, cy = R.P.Y, en = [], ns = [];
  for(const E of Enemies){
   if(E.Dead) continue; if(E.Id === undefined) E.Id = Party.EnId++;
   if(!E.Boss && Math.hypot(E.X - cx, E.Y - cy) > 1000) continue;
   if(!C.Known.has(E.Id)){C.Known.add(E.Id); ns.push({i: E.Id, r: E.Radius, k: E.Kind, c: E.Color, s: E.Sides, mh: E.MaxHp, el: E.Elite ? 1 : 0, bs: E.Boss || '', tr: E.Trait || '', gb: E.Goblin ? 1 : 0, st: E.SpawnTotal || 1})}
   const F = (E.Burn ? 1 : 0) | (E.SlowT > 0 ? 2 : 0) | (E.StunT > 0 ? 4 : 0) | (E.Shield > 0 ? 8 : 0) | (E.Tele > 0 ? 16 : 0) | (E.Flash > 0 ? 32 : 0) | (E.SpawnLeft > 0 ? 64 : 0);
   const Row = [E.Id, Math.round(E.X), Math.round(E.Y), +E.Rot.toFixed(2), Math.round(E.Hp), F, F & 64 ? Math.round(E.SpawnLeft * 100) : 0];
   if(E.Boss) Row.push(E.Cast || '', Math.round((E.SlamT || 0) * 100));
   en.push(Row); if(en.length >= 160) break;
  }
  if(ns.length) C.Send({t: 'ne', a: ns});
  const Near = (X, Y, Rd) => Math.abs(X - cx) < Rd && Math.abs(Y - cy) < Rd;
  C.Send({t: 's', sd: Dg.Seed, dg: Party.DGen || 0, ch: Dg.Chests.map(c => c.Open ? 1 : 0), r: Round, rt: Math.round(RoundTime * 10) / 10, df: +Diff.toFixed(2), ob: [Obj.Type, Math.round(Obj.Have * 10) / 10, Obj.Need, Obj.Done ? 1 : 0], lv: R.P.Level, xp: Math.round(R.P.Xp), k: RunStats.Kills, tm: Math.round(RunStats.Time), ev: EventKey, z: Zone ? [Math.round(Zone.X), Math.round(Zone.Y), Zone.R] : null,
   cr: Crystals.map(c => [Math.round(c.X), Math.round(c.Y), c.Got ? 1 : 0]), mt: Meteor.map(m => [Math.round(m.X), Math.round(m.Y), +m.T.toFixed(2), m.R]), pl: Pl, en,
   bl: Bolts.filter(b => Near(b.X, b.Y, 900)).slice(0, 150).map(b => [Math.round(b.X), Math.round(b.Y), Math.round(b.Vx), Math.round(b.Vy), Math.max(0, ElemNames.indexOf(b.Elem)), +b.Size.toFixed(1), b.Crit ? 1 : 0]),
   eb: EnemyBolts.filter(b => Near(b.X, b.Y, 900)).slice(0, 120).map(b => [Math.round(b.X), Math.round(b.Y), Math.round(b.Vx), Math.round(b.Vy)]),
   pk: Pickups.filter(p => Near(p.X, p.Y, 700)).slice(0, 120).map(p => [Math.round(p.X), Math.round(p.Y)]), kv: Evs}, true);
 }
}

/* ----- start / save / resume / finish ----- */
function PartyStart(){
 if(Party.State !== 'lobby' || Party.Members.length < 2 || !Party.Members.every(M => M.Ready)) return;
 Party.State = 'play'; Party.Ready = false;
 const Cfg = Party.Cfg, sv = {Up: Meta.Up, SelElem, SelMode, SelDiff, Mut}, Sav = Party.Save;
 SelMode = Cfg.mode; SelDiff = Cfg.diff; Mut = Object.assign({}, Cfg.mut); Party.Remotes = []; Party.Names = {}; GEn.clear();
 for(const Mm of Party.Members) Party.Names[Mm.Uid] = Mm.Name;
 for(const Mm of Party.Members.filter(x => !x.Host)){
  const C = Party.Conns[Mm.Uid]; Meta.Up = C ? C.Up : {}; SelElem = Mm.Elem; NewRun();
  const R = {Uid: Mm.Uid, Name: Mm.Name, P: Player, S: Stats, E: Elem, Last: LastElem, In: {x: Player.X, y: Player.Y, a: 0, f: 0, i: 0, n: 0}, Alive: true, Pending: Pending, Rerolls: Rerolls, Offers: null, WaitT: 0, NovaSeen: 0, Elem0: Mm.Elem, Up: C ? C.Up : {}};
  const Sv = Sav && Sav.Members.find(x => x.Uid === Mm.Uid); if(Sv){Object.assign(R.S, Sv.S); R.E = Object.assign({}, Sv.E); R.P.Hp = R.S.MaximumHealth}
  Party.Remotes.push(R);
 }
 Meta.Up = sv.Up; SelElem = Party.Members[0].Elem; NewRun();
 if(Sav){const H = Sav.Members.find(x => x.Uid === Acct.uid); if(H){Object.assign(Stats, H.S); Elem = Object.assign({}, H.E); Player.Hp = Stats.MaximumHealth} Player.Level = Sav.Level; Player.Xp = Sav.Xp; Round = Sav.Round; StartRound()}
 SelMode = sv.SelMode; SelDiff = sv.SelDiff; Mut = sv.Mut; SelElem = sv.SelElem;
 for(const R of Party.Remotes){R.In.x = R.P.X; R.In.y = R.P.Y; R.In.g = Party.DGen}
 Camera.X = Player.X; Camera.Y = Player.Y; Party.View = ''; Party.MenuOpen = false; Party.UpOpen = false; Mode = 'play'; Ui.className = '';
 for(const R of Party.Remotes) PartySend(R.Uid, {t: 'start', cfg: {mode: Cfg.mode, diff: Cfg.diff, mut: Cfg.mut}, names: Party.Names, round: Round, you: {S: R.S, E: R.E, L: R.Last, x: R.P.X, y: R.P.Y}});
 Party.Ready = true; PartyDocPatch({state: 'play', public: false}); PartySaveNow();
}
function PartySaves(){try{return JSON.parse(StorageGet('GOParties') || '{}') || {}}catch(Err){return {}}}
function PartySaveNow(){
 if(!Party.Ready || !Party.Host || !Acct) return;
 const All = PartySaves(), Prev = All[Party.Id] || Party.Save || {Members: []};
 const Cur = [{Uid: Acct.uid, Name: PublicName(), Elem0: Party.Members[0] ? Party.Members[0].Elem : SelElem, S: Stats, E: Elem}, ...Party.Remotes.map(R => ({Uid: R.Uid, Name: R.Name, Elem0: R.Elem0, S: R.S, E: R.E}))];
 All[Party.Id] = {Id: Party.Id, Name: Party.Cfg.name, HostUid: Acct.uid, Cfg: {mode: Party.Cfg.mode, diff: Party.Cfg.diff, mut: Party.Cfg.mut, max: Party.Cfg.max, public: Party.Cfg.public}, Max: Party.Cfg.max, Round, Level: Player.Level, Xp: Player.Xp, Members: Cur.concat(Prev.Members.filter(M => !Cur.some(C => C.Uid === M.Uid))), Updated: Date.now()};
 const Out = {}; for(const I of Object.keys(All).sort((a, b) => All[b].Updated - All[a].Updated).slice(0, 5)) Out[I] = All[I];
 StorageSet('GOParties', JSON.stringify(Out)); Party.Save = Out[Party.Id];
}
function PartyFinishSave(){const A = PartySaves(); delete A[Party.Id]; StorageSet('GOParties', JSON.stringify(A))}
function PartyOver(Won){
 const I = {w: Won ? 1 : 0, r: Round, k: RunStats.Kills, t: Math.floor(RunStats.Time), d: Math.round(RunStats.Damage), df: Player.Diff || SelDiff};
 PartyBroadcast({t: 'over', i: I}); PartyFinishSave(); PartyShowOver(I);
}
function PartyShowOver(I){
 PlaySfx(I.w ? 'Victory' : 'GameOver'); Mode = 'over';
 const Gain = Math.min(40, Math.round((I.r * 3 + I.k / 12) * (DiffTbl[I.df] || DiffTbl.Normal).Shards));
 Meta.Shards += Gain; SaveMeta(); Party.MenuOpen = false;
 Ui.className = 'On';
 Ui.innerHTML = `<div class="Box"><h1>${I.w ? 'Victory' : 'Party down'}</h1><p>Co-op · ${HtmlEsc(I.df)}</p><div class="Summary"><div>Round<b>${I.r}</b></div><div>Kills<b>${I.k}</b></div><div>Damage<b>${I.d}</b></div><div>Time<b>${FormatTime(I.t)}</b></div></div><div class="Recap">+${Gain} shards ◆ (co-op is capped at 40 per run)</div><div class="Row"><button class="Btn" data-act="menu">Back to menu</button></div></div>`;
}
const GameOverPM = GameOver;
GameOver = function(W){if(Party.On && Party.Host){PartyOver(W); return} GameOverPM(W)};

/* ----- drawing ----- */
const PDisp = {};
function SmoothPos(Id, X, Y, Dt){let D = PDisp[Id]; if(!D || Math.hypot(D.x - X, D.y - Y) > 300) D = PDisp[Id] = {x: X, y: Y}; const K = 1 - Math.exp(-Dt * 18); D.x += (X - D.x) * K; D.y += (Y - D.y) * K; return D}
function DrawParty(){
 if(!Party.On || !Player) return;
 const Now = performance.now(), Dt = Math.min(.05, (Now - (Party.LastDraw || Now)) / 1000); Party.LastDraw = Now;
 const L = Party.Host ? Party.Remotes.map(R => ({Uid: R.Uid, N: R.Name, X: R.P.X, Y: R.P.Y, Hp: R.P.Hp, Mh: R.S.MaximumHealth, Al: R.Alive, Aim: R.In.a || 0, El: R.Last || 'Fire'})) : Party.Others.map(O => ({Uid: O.Uid, N: O.N, X: O.X, Y: O.Y, Hp: O.Hp, Mh: O.Mh, Al: O.Al, Aim: O.Aim, El: ElemNames[O.El] || 'Fire'}));
 for(const O of L){
  const C = Elems[O.El].Color, D = SmoothPos(O.Uid, O.X, O.Y, Dt);
  Context.globalAlpha = O.Al ? 1 : .3; Shape(D.x, D.y, PlayerRadius, 0, 0, C); if(O.Al){Shape(D.x, D.y, 7, 6, Time * 1.5, C, C); Context.strokeStyle = '#e8ecff'; Context.lineWidth = 3; Context.beginPath(); Context.moveTo(D.x + Math.cos(O.Aim) * 13, D.y + Math.sin(O.Aim) * 13); Context.lineTo(D.x + Math.cos(O.Aim) * 21, D.y + Math.sin(O.Aim) * 21); Context.stroke()}
  Context.globalAlpha = 1; Context.fillStyle = '#e8ecff'; Context.font = '700 11px "Chakra Petch",sans-serif'; Context.textAlign = 'center'; Context.fillText(O.N, D.x, D.y - 24);
  if(O.Al){Context.fillStyle = '#000a'; Context.fillRect(D.x - 14, D.y + 20, 28, 3); Context.fillStyle = C; Context.fillRect(D.x - 14, D.y + 20, 28 * Clamp(O.Hp / O.Mh, 0, 1), 3)}
 }
}
function DrawPartyHud(BarY){
 if(!Party.On || !Party.Ready) return;
 const Me = {N: PublicName(), Hp: Player.Hp, Mh: Stats.MaximumHealth, Al: !Player.Down, El: LastElem, Lv: Player.Level};
 const All = [Me, ...(Party.Host ? Party.Remotes.map(R => ({N: R.Name, Hp: R.P.Hp, Mh: R.S.MaximumHealth, Al: R.Alive, El: R.Last || 'Fire', Lv: R.P.Level})) : Party.Others.map(O => ({N: O.N, Hp: O.Hp, Mh: O.Mh, Al: O.Al, El: ElemNames[O.El] || 'Fire', Lv: O.Lv})))];
 const W = 98; let X = Width / 2 - All.length * W / 2; const Y = BarY + 26;
 Context.textAlign = 'left'; Context.font = '700 11px "Chakra Petch",sans-serif';
 for(const P of All){
  const C = Elems[P.El].Color; Context.globalAlpha = P.Al ? 1 : .45; Context.fillStyle = C; Context.beginPath(); Context.arc(X + 5, Y + 6, 4, 0, Tau); Context.fill();
  Context.fillStyle = '#e8ecff'; Context.fillText(P.N.slice(0, 7) + (P.Lv ? ' L' + P.Lv : ''), X + 13, Y + 10);
  Context.fillStyle = '#000a'; Context.fillRect(X, Y + 15, 88, 4); Context.fillStyle = P.Al ? C : '#8f98c8'; Context.fillRect(X, Y + 15, 88 * Clamp(P.Hp / Math.max(1, P.Mh), 0, 1), 4); Context.globalAlpha = 1; X += W;
 }
}

/* ----- screens: hub, host settings, browse, saves, lobby ----- */
const MPMuts = () => Object.keys(MutInfo).map(K => `<button class="Pick ${Party.Cfg.mut[K] ? 'Sel' : ''}" style="--Chip:#ff5d73" data-act="pmut" data-v="${K}"><span class="PName">${MutInfo[K][0]}</span><span class="PSub">${MutInfo[K][1]}</span></button>`).join('');
function RenderParty(){
 if(Mode !== 'menu' || !Party.View) return;
 Ui.className = 'On'; const V = Party.View, Msg = Party.Msg ? `<div class="Note" style="margin-top:10px">${HtmlEsc(Party.Msg)}</div>` : '';
 const Back = `<div class="SHead"><button class="Ghost" data-act="pback">← Back</button><h2>Multiplayer</h2></div>`;
 if(V === 'warn'){
  Ui.innerHTML = `<div class="Setup">${Back}<div class="Panel" style="border-color:#8a6a1f"><div class="PTitle" style="color:#ffc857">⚠ Multiplayer is not finished</div><p class="Lead" style="margin:0 0 10px">Online co-op is still in development. You may run into bugs, disconnects, balance problems or lost progress in saved parties. Co-op rewards are capped and nothing here counts for the ranking.</p><div class="Row"><button class="PlayBtn" style="font-size:20px;padding:10px 26px;min-height:48px;animation:none" data-act="pwarn">I understand, continue</button><button class="Btn Alt" data-act="pback">Go back</button></div></div></div>`;
 }else if(V === 'hub'){
  const NS = Object.keys(PartySaves()).length;
  Ui.innerHTML = `<div class="Setup">${Back}<div class="Warn">⚠ Beta: multiplayer is unfinished and may have bugs.</div>${Acct ? '' : '<div class="Panel"><p class="Lead" style="margin:0 0 8px">Sign in to host or join a party. Your progress and name come from your account.</p><button class="JoinBtn" data-act="signin">Sign in / Sign up</button></div>'}
  <div class="PGrid2 HubGrid"><button class="Pick HubCard" data-act="phost"><b>Host a party</b><span>Public or private, up to 4 players. Everyone plays a different element.</span></button>
  <button class="Pick HubCard" data-act="pbrowse"><b>Public parties</b><span>See open parties and jump into one.</span></button>
  <div class="Panel HubCard"><b>Join with a code</b><input id="PCode" class="TxtIn" maxlength="6" placeholder="ABC123" autocomplete="off" style="text-transform:uppercase"><button class="Btn" data-act="pjoin">Join</button></div>
  <button class="Pick HubCard" data-act="psaves"><b>My parties</b><span>Resume a saved party${NS ? ' (' + NS + ')' : ''}. Original members keep their slot.</span></button></div>${Msg}</div>`;
 }else if(V === 'host'){
  const C = Party.Cfg, Mc = Object.keys(Modes).map(K => `<button class="Pick ${K === C.mode ? 'Sel' : ''}" style="--Chip:#4ff0d6" data-act="pset" data-k="mode" data-v="${K}"><span class="PName">${K}</span></button>`).join('');
  const Dc = Object.keys(DiffTbl).map(K => `<button class="Pick ${K === C.diff ? 'Sel' : ''}" style="--Chip:${DiffTbl[K].Color}" data-act="pset" data-k="diff" data-v="${K}"><span class="PName">${K}</span></button>`).join('');
  const Xc = [2, 3, 4].map(N => `<button class="Pick ${N === C.max ? 'Sel' : ''}" style="--Chip:#9b7bff" data-act="pset" data-k="max" data-v="${N}"><span class="PName">${N} players</span></button>`).join('');
  const El = ElemNames.map(N => `<button class="Pick ElemCard ${N === SelElem ? 'Sel' : ''}" style="--Chip:${Elems[N].Color}" data-elem="${N}"><span class="EGlyph">${ElemIcon(N, 22)}</span><span class="EText"><b class="PName">${N}</b></span></button>`).join('');
  Ui.innerHTML = `<div class="Setup"><div class="SHead"><button class="Ghost" data-act="pback">← Back</button><h2>Host a party</h2></div>
  <div class="SGrid"><div class="Panel"><div class="PTitle">Party name</div><input id="PName" class="TxtIn" maxlength="24" value="${HtmlEsc(C.name)}"><div class="PTitle" style="margin-top:10px">Visibility</div><div class="PGrid2"><button class="Pick ${C.public ? 'Sel' : ''}" style="--Chip:#4ff0d6" data-act="pset" data-k="public" data-v="1"><span class="PName">Public</span><span class="PSub">Listed for everyone</span></button><button class="Pick ${C.public ? '' : 'Sel'}" style="--Chip:#9b7bff" data-act="pset" data-k="public" data-v="0"><span class="PName">Private</span><span class="PSub">Join with a code</span></button></div></div>
  <div class="Panel"><div class="PTitle">Max players</div><div class="PGrid3">${Xc}</div><div class="PTitle" style="margin-top:10px">Mode</div><div class="PGrid3">${Mc}</div></div>
  <div class="Panel"><div class="PTitle">Difficulty</div><div class="PGrid4">${Dc}</div></div><div class="Panel"><div class="PTitle">Your element</div><div class="PGrid4">${El}</div></div>
  <div class="Panel SWide"><div class="PTitle">Mutators</div><div class="PGrid5">${MPMuts()}</div></div></div>
  <div class="SFoot"><div class="SSum">${HtmlEsc(C.name)}<small>${C.public ? 'Public' : 'Private'} · ${C.mode} · ${C.diff} · up to ${C.max}</small></div><button class="PlayBtn" data-act="pcreate">Create party</button></div>${Msg}</div>`;
 }else if(V === 'browse'){
  const Rows = Party.List.length ? Party.List.map(P => `<div class="BRow PRow"><span class="BName">${HtmlEsc(P.name)}<small> · ${HtmlEsc(P.hostName)}</small></span><span class="BScore">${P.count}/${P.max}<small>${HtmlEsc(P.mode)} · ${HtmlEsc(P.diff)}${P.mutN ? ' · ' + P.mutN + ' mut' : ''}${P.resume ? ' · saved' : ''}</small></span><button class="JoinBtn" data-act="pjoincode" data-v="${HtmlEsc(P.code)}">Join</button></div>`).join('') : '<div class="Note">No open public parties right now. Host one!</div>';
  Ui.innerHTML = `<div class="Setup">${Back}<div class="Panel"><div class="PTitle">Public parties</div><div class="BList WsScroll">${Rows}</div></div>${Msg}</div>`;
 }else if(V === 'saves'){
  const S = Object.values(PartySaves()).sort((a, b) => b.Updated - a.Updated);
  const Rows = S.length ? S.map(P => `<div class="BRow PRow"><span class="BName">${HtmlEsc(P.Name)}<small> · ${P.Members.map(M => HtmlEsc(M.Name)).join(', ')}</small></span><span class="BScore">Round ${P.Round}<small>${HtmlEsc(P.Cfg.mode)} · ${HtmlEsc(P.Cfg.diff)} · ${P.Members.length}/${P.Max}</small></span><span><button class="JoinBtn" data-act="presume" data-v="${HtmlEsc(P.Id)}">Resume</button> <button class="Ghost" data-act="pdelsave" data-v="${HtmlEsc(P.Id)}">Delete</button></span></div>`).join('') : '<div class="Note">No saved parties yet. A party is saved automatically at the start of every round.</div>';
  Ui.innerHTML = `<div class="Setup">${Back}<div class="Panel"><div class="PTitle">My parties</div><div class="BList WsScroll">${Rows}</div><p class="PSub" style="margin-top:8px">Only the original members can rejoin a full party. If it had fewer than ${'its max'} players, new players can take the empty slots.</p></div>${Msg}</div>`;
 }else if(V === 'connecting'){
  Ui.innerHTML = `<div class="Setup">${Back}<div class="Panel" style="text-align:center"><div class="GSpin" style="margin:14px auto"></div><p class="Lead" style="margin:0 auto">${HtmlEsc(Party.Msg || 'Connecting…')}</p></div></div>`;
 }else if(V === 'lobby'){
  const Me = Acct ? Acct.uid : '', Mem = Party.Members, IsH = Party.Host, Cfg = Party.Cfg, Mine = Mem.find(x => x.Uid === Me);
  const Locked = new Set([...Mem.filter(x => x.Uid !== Me).map(x => x.Elem), ...(Party.Locks || [])]), Fixed = IsH ? !!(Party.Reserved && Party.Reserved.has(Me)) : false;
  const MR = Mem.map(x => `<div class="BRow PRow"><span class="BName">${x.Host ? '👑 ' : ''}${HtmlEsc(x.Name)}</span><span class="BScore" style="color:${Elems[x.Elem].Color}">${ElemIcon(x.Elem, 16)} ${x.Elem}</span><span>${x.Host ? '' : (x.Ready ? '✔ Ready' : '… not ready')}${IsH && !x.Host ? ' <button class="Ghost" data-act="pkick" data-v="' + HtmlEsc(x.Uid) + '">Kick</button>' : ''}</span></div>`).join('');
  const EC = ElemNames.map(N => `<button class="Pick ElemCard ${Mine && Mine.Elem === N ? 'Sel' : ''}" style="--Chip:${Elems[N].Color};${Locked.has(N) ? 'opacity:.35' : ''}" data-act="pelem" data-v="${N}" ${Locked.has(N) ? 'disabled' : ''}><span class="EGlyph">${ElemIcon(N, 22)}</span><span class="EText"><b class="PName">${N}</b></span></button>`).join('');
  const Ready = Mem.length >= 2 && Mem.every(x => x.Ready), Mc = Object.values(Cfg.mut || {}).filter(Boolean).length;
  Ui.innerHTML = `<div class="Setup"><div class="SHead"><button class="Ghost" data-act="pleave">← Leave</button><h2>${HtmlEsc(Cfg.name)}</h2></div>
  <div class="SGrid"><div class="Panel"><div class="PTitle">Party code</div><div class="PCode">${HtmlEsc(Party.Code)}</div><p class="PSub" style="margin:6px 0 0">${Cfg.pub || Cfg.public ? 'Public: listed in Public parties.' : 'Private: share this code.'}</p><div class="PGrid2" style="margin-top:10px"><div class="PSub">${Cfg.mode} · ${Cfg.diff}${Mc ? ' · ' + Mc + ' mutators' : ''}</div><div class="PSub">${Mem.length}/${Cfg.max} players${Party.Reserved || (Party.Lobby && Party.Lobby.res) ? ' · saved party' : ''}</div></div></div>
  <div class="Panel"><div class="PTitle">Players</div><div class="BList">${MR}</div></div>
  <div class="Panel SWide"><div class="PTitle">Your element ${Fixed ? '(locked: saved party)' : ''}</div><div class="PGrid4">${EC}</div></div></div>
  <div class="SFoot"><div class="SSum">${IsH ? (Ready ? 'Everyone is ready' : 'Waiting for players to get ready') : 'Waiting for the host to start'}<small>${Mem.length} / ${Cfg.max}</small></div>${IsH ? `<button class="PlayBtn" data-act="pstart" ${Ready ? '' : 'disabled'}><span>▶</span>Start</button>` : `<button class="PlayBtn" data-act="pready">${Mine && Mine.Ready ? 'Not ready' : 'Ready'}</button>`}</div>${Msg}</div>`;
 }
}
let PartyUnsubBrowse = null;
async function PartyBrowse(){
 if(!PartyReady()){Party.View = 'hub'; RenderParty(); return}
 Party.View = 'browse'; Party.List = []; Party.Msg = ''; RenderParty();
 try{
  const M = await FbLoad();
  if(PartyUnsubBrowse) PartyUnsubBrowse();
  PartyUnsubBrowse = M.F.onSnapshot(M.F.query(M.F.collection(M.db, 'parties'), M.F.where('public', '==', true), M.F.limit(30)), S => {
   Party.List = S.docs.map(D => D.data()).filter(P => P.state === 'lobby' && P.expiresAt > Date.now() && P.count < P.max && P.hostUid !== (Acct && Acct.uid)).sort((a, b) => b.createdAt - a.createdAt); if(Party.View === 'browse') RenderParty();
  });
 }catch(Err){Party.Msg = 'Could not load parties: ' + FbErr(Err); RenderParty()}
}
function PartyStopBrowse(){if(PartyUnsubBrowse){try{PartyUnsubBrowse()}catch(Err){} PartyUnsubBrowse = null}}
Ui.addEventListener('click', Ev => {
 const B = Ev.target.closest('button'); if(!B) return; const A = B.dataset.act, V = B.dataset.v, Stop = () => Ev.stopImmediatePropagation();
 if(Party.On && Party.Ready && B.dataset.pick !== undefined){PartyPick(+B.dataset.pick); Stop()}
 else if(Party.On && Party.Ready && A === 'reroll'){PartyReroll(); Stop()}
 else if(Party.On && Party.Ready && A === 'upclose'){PartyUpgradeClose(true); Stop()}
 else if(A === 'pwarn'){Party.Warned = true; Party.View = 'hub'; ShowMenu(); Stop()}
 else if(A === 'mp'){Party.View = Party.Warned ? 'hub' : 'warn'; Party.Msg = ''; ShowMenu(); Stop()}
 else if(A === 'pback'){PartyStopBrowse(); Party.Msg = ''; if(Party.View === 'hub' || Party.View === 'warn') Party.View = ''; else Party.View = 'hub'; ShowMenu(); Stop()}
 else if(A === 'phost'){Party.Cfg = FreshCfg(); Party.Msg = ''; Party.View = 'host'; ShowMenu(); Stop()}
 else if(A === 'pbrowse'){PartyBrowse(); Stop()}
 else if(A === 'psaves'){Party.View = 'saves'; Party.Msg = ''; ShowMenu(); Stop()}
 else if(A === 'pjoin'){GuestJoin((document.getElementById('PCode') || {}).value); Stop()}
 else if(A === 'pjoincode'){PartyStopBrowse(); GuestJoin(V); Stop()}
 else if(A === 'pset'){const K = B.dataset.k; Party.Cfg[K] = K === 'max' ? +V : K === 'public' ? V === '1' : V; const NI = document.getElementById('PName'); if(NI) Party.Cfg.name = SafeName(NI.value) || Party.Cfg.name; ShowMenu(); Stop()}
 else if(A === 'pmut'){Party.Cfg.mut[V] = !Party.Cfg.mut[V]; const NI = document.getElementById('PName'); if(NI) Party.Cfg.name = SafeName(NI.value) || Party.Cfg.name; ShowMenu(); Stop()}
 else if(A === 'pcreate'){const NI = document.getElementById('PName'); if(NI) Party.Cfg.name = (NI.value || '').replace(/[^A-Za-z0-9 _.\-!?]/g, '').trim().slice(0, 24) || 'Party'; PartyCreate(null); Stop()}
 else if(A === 'presume'){const S = PartySaves()[V]; if(S){Party.Cfg = {name: S.Name, public: false, max: S.Max, mode: S.Cfg.mode, diff: S.Cfg.diff, mut: S.Cfg.mut || {}}; PartyCreate(S)} Stop()}
 else if(A === 'pdelsave'){const All = PartySaves(); delete All[V]; StorageSet('GOParties', JSON.stringify(All)); ShowMenu(); Stop()}
 else if(A === 'pleave'){PartyLeave(); Party.View = 'hub'; ShowMenu(); Stop()}
 else if(A === 'pkick'){const C = Party.Conns[V]; if(C){C.Send({t: 'reject', why: 'The host removed you from the party.'}); setTimeout(() => HostDrop(V), 200)} Stop()}
 else if(A === 'pelem'){if(Party.Host){const Mm = Party.Members.find(x => x.Uid === Acct.uid); if(Mm && !(Party.Reserved && Party.Reserved.has(Acct.uid)) && !LockedElems(Acct.uid).has(V)){Mm.Elem = V; PartyLobbyChanged()}} else PartyGuestSend({t: 'elem', e: V}); Stop()}
 else if(A === 'pready'){const Mm = Party.Members.find(x => x.Uid === Acct.uid), Nv = !(Mm && Mm.Ready); PartyGuestSend({t: 'ready', v: Nv}); Stop()}
 else if(A === 'pstart'){PartyStart(); Stop()}
 else if(B.dataset.elem && Party.View === 'host'){SelElem = B.dataset.elem; const NI = document.getElementById('PName'); if(NI) Party.Cfg.name = SafeName(NI.value) || Party.Cfg.name; ShowMenu(); Stop()}
}, true);

/* ---------- attract mode: a live demo fights behind the menu ---------- */
const Demo = {T: 0, Foes: [], Shots: [], Fx: [], Cd: 0, Spawn: 0, Aim: 0, Shot: 0, Kills: 0};
const DemoBurst = (X, Y, Color, N, V) => {for(let I = 0; I < N && Demo.Fx.length < 220; I++){const A = RandRange(0, Tau), S = RandRange(.3, 1) * V; Demo.Fx.push({X, Y, Vx: Math.cos(A) * S, Vy: Math.sin(A) * S, L: .5, M: .5, C: Color, S: RandRange(1.5, 3)})}};
const DemoRing = (X, Y, Color, R) => {if(Demo.Fx.length < 220) Demo.Fx.push({X, Y, Vx: 0, Vy: 0, L: .4, M: .4, C: Color, S: R, Ring: true})};

function AttractUpdate(Dt){
 const D = Demo, Cx = Width / 2, Cy = Height / 2, Z = Zoom;
 D.T += Dt; D.Spawn -= Dt; D.Cd -= Dt;
 if(D.Spawn <= 0 && D.Foes.length < 28){
  D.Spawn = .3;
  const A = RandRange(0, Tau), R = Math.hypot(Width, Height) / 2 + 30, K = Math.random(), Ty = K < .55 ? EnemyTypes[0] : K < .85 ? EnemyTypes[1] : EnemyTypes[2];
  D.Foes.push({X: Cx + Math.cos(A) * R, Y: Cy + Math.sin(A) * R, Hp: Ty.Hp * .6, Sp: Ty.Speed * Z * 1.1, R: Ty.Radius * Z, Sides: Ty.Sides, Color: Ty.Color, Rot: RandRange(0, Tau), Spin: RandRange(-1, 1), Flash: 0});
 }
 let Near = null, ND = 1e9;
 for(const F of D.Foes){
  const Dx = Cx - F.X, Dy = Cy - F.Y, Len = Math.hypot(Dx, Dy) || 1;
  F.X += Dx / Len * F.Sp * Dt; F.Y += Dy / Len * F.Sp * Dt; F.Rot += F.Spin * Dt; F.Flash -= Dt;
  if(Len < ND){ND = Len; Near = F}
  if(Len < 22 * Z){F.Hp = 0; DemoBurst(F.X, F.Y, '#ff5d73', 10, 160); DemoRing(Cx, Cy, '#ff5d73', 60 * Z)}
 }
 if(Near){
  const Target = Math.atan2(Near.Y - Cy, Near.X - Cx), Diff2 = Math.atan2(Math.sin(Target - D.Aim), Math.cos(Target - D.Aim));
  D.Aim += Diff2 * Math.min(1, Dt * 14);
  if(D.Cd <= 0 && ND < Math.hypot(Width, Height) * .6){
   D.Cd = .17; const Name = ElemNames[D.Shot++ % 4], Sp = 640 * Z;
   if(D.Shots.length < 60) D.Shots.push({X: Cx, Y: Cy, Vx: Math.cos(D.Aim) * Sp, Vy: Math.sin(D.Aim) * Sp, Color: Elems[Name].Color, L: 1.6});
   DemoBurst(Cx + Math.cos(D.Aim) * 20 * Z, Cy + Math.sin(D.Aim) * 20 * Z, Elems[Name].Color, 2, 100);
  }
 }
 for(const B of D.Shots){
  B.X += B.Vx * Dt; B.Y += B.Vy * Dt; B.L -= Dt;
  for(const F of D.Foes){
   if(F.Hp > 0 && Math.hypot(F.X - B.X, F.Y - B.Y) < F.R + 5 * Z){
    F.Hp -= 14; F.Flash = .08; B.L = 0; DemoBurst(F.X, F.Y, B.Color, 3, 100);
    if(F.Hp <= 0){D.Kills++; DemoBurst(F.X, F.Y, F.Color, 14, 220); DemoRing(F.X, F.Y, F.Color, F.R * 2.4)}
    break;
   }
  }
 }
 D.Shots = D.Shots.filter(B => B.L > 0);
 D.Foes = D.Foes.filter(F => F.Hp > 0);
 for(const P of D.Fx){P.L -= Dt; P.X += P.Vx * Dt; P.Y += P.Vy * Dt; P.Vx *= 1 - 4 * Dt; P.Vy *= 1 - 4 * Dt}
 D.Fx = D.Fx.filter(P => P.L > 0);
}

function DrawAttract(){
 const D = Demo, Cx = Width / 2, Cy = Height / 2, Z = Zoom, Core = Elems[ElemNames[D.Shot % 4]].Color;
 Context.strokeStyle = '#1a2146'; Context.lineWidth = 1; Context.beginPath();
 const Off = (D.T * 12) % 40;
 for(let I = -Off; I < Width; I += 40){Context.moveTo(I, 0); Context.lineTo(I, Height)}
 for(let I = -Off; I < Height; I += 40){Context.moveTo(0, I); Context.lineTo(Width, I)}
 Context.stroke();
 for(const F of D.Foes) Shape(F.X, F.Y, F.R, F.Sides, F.Rot, F.Color, F.Flash > 0 ? '#ffffff' : null);
 for(const B of D.Shots){
  Context.globalAlpha = .5; Context.strokeStyle = B.Color; Context.lineWidth = 4 * Z; Context.beginPath(); Context.moveTo(B.X - B.Vx * .03, B.Y - B.Vy * .03); Context.lineTo(B.X, B.Y); Context.stroke();
  Context.globalAlpha = 1; Shape(B.X, B.Y, 4 * Z, 0, 0, B.Color, '#ffffff');
 }
 for(const P of D.Fx){
  const Fade = P.L / P.M; Context.globalAlpha = Fade;
  if(P.Ring){Context.strokeStyle = P.C; Context.lineWidth = 2; Poly(P.X, P.Y, P.S * (1 - Fade) + 3, 0); Context.stroke()}
  else{Context.fillStyle = P.C; Context.beginPath(); Context.arc(P.X, P.Y, P.S * (.4 + .6 * Fade), 0, Tau); Context.fill()}
 }
 Context.globalAlpha = .15 + .05 * Math.sin(D.T * 3); Context.strokeStyle = Core; Context.lineWidth = 1; Poly(Cx, Cy, 260 * Z, 0); Context.stroke(); Context.globalAlpha = 1;
 Shape(Cx, Cy, (PlayerRadius + Math.sin(D.T * 5) * .8) * Z, 0, 0, Core);
 Shape(Cx, Cy, 7 * Z, 6, D.T * 1.5, Core, Core);
 Context.strokeStyle = '#e8ecff'; Context.lineWidth = 3; Context.beginPath();
 Context.moveTo(Cx + Math.cos(D.Aim) * 13 * Z, Cy + Math.sin(D.Aim) * 13 * Z); Context.lineTo(Cx + Math.cos(D.Aim) * 21 * Z, Cy + Math.sin(D.Aim) * 21 * Z); Context.stroke();
}

/* menu gets a see-through layer so the demo shows behind it */
const ShowMenuLive = ShowMenu;
ShowMenu = function(){if(Party.View && Mode === 'menu'){RenderParty(); return} if(SetupOpen && Mode === 'menu'){RenderSetup(); return} ShowMenuLive(); Ui.classList.add('Menu'); if(MenuTab === 'rank') BoardEnsure()};

for(const K of Object.keys(Modes)) SaveStore.Get(K);
if(WasWiped) MenuNote = 'Fresh start: all previous data was reset. Sign in to keep your new progress online.';
if(Tampered) MenuNote = 'A modified save was detected and reset.';
ShowMenu(); requestAnimationFrame(Loop);
try{localStorage.setItem('ShapeSwarmSealed', '1')}catch(Err){}

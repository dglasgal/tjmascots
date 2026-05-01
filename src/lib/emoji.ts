const ANIMAL_EMOJI: Record<string, string> = {
  tiger: '🐅', octopus: '🐙', elephant: '🐘', bear: '🐻', 'polar bear': '🐻‍❄️',
  duck: '🦆', turtle: '🐢', seal: '🦭', cow: '🐄', horse: '🐴', pig: '🐷',
  monkey: '🐵', fox: '🦊', ram: '🐏', sheep: '🐑', flamingo: '🦩', pigeon: '🕊️',
  parrot: '🦜', dinosaur: '🦖', dino: '🦖', 't-rex': '🦖', lion: '🦁', wolf: '🐺',
  gorilla: '🦍', raccoon: '🦝', bee: '🐝', owl: '🦉', eagle: '🦅',
  seagull: '🐦', swan: '🦢', hummingbird: '🐦', peacock: '🦚', goose: '🪿',
  chicken: '🐔', dog: '🐶', cat: '🐱', mouse: '🐭', rabbit: '🐰',
  bat: '🦇', whale: '🐋', dolphin: '🐬', shark: '🦈', crab: '🦀',
  lobster: '🦞', scorpion: '🦂', hedgehog: '🦔', squirrel: '🐿️',
  snake: '🐍', lizard: '🦎', frog: '🐸', deer: '🦌', llama: '🦙',
  camel: '🐫', goat: '🐐', buffalo: '🦬', giraffe: '🦒', koala: '🐨',
  panda: '🐼', ringtail: '🦝', lemur: '🐒', moose: '🫎',
  dragon: '🐲', yeti: '❄️', viking: '🛡️', unicorn: '🦄',
  toucan: '🦜', hornet: '🐝', hippo: '🦛', wolverine: '🐺',
  porcupine: '🦔', narwhal: '🦄', walrus: '🦭', armadillo: '🦫',
  javelina: '🐗', axolotl: '🦎', chipmunk: '🐿️', gecko: '🦎',
  iguana: '🦎', alligator: '🐊', timberwolf: '🐺', catamount: '🐆',
  'sea lion': '🦭', 'sea otter': '🦦', 'sea turtle': '🐢',
  'sandhill crane': '🐦', sandpiper: '🐦', seahawk: '🦅', seahorse: '🐠',
  mammoth: '🦣', 'woolly mammoth': '🦣', pelican: '🐦', capybara: '🦫', mare: '🐴',
  groundhog: '🦫', 'sun devil': '🌞', 'rock dove': '🕊️', anteater: '🐜',
  otter: '🦦',
  // Dog breeds — without these, the substring fallback matches "beagle"
  // against "eagle" 🦅 and renders dogs as birds.
  beagle: '🐶', labrador: '🐶', retriever: '🐶', poodle: '🐶',
  bulldog: '🐶', terrier: '🐶', dachshund: '🐶', collie: '🐶',
  shepherd: '🐶', husky: '🐶', corgi: '🐶', spaniel: '🐶',
  pug: '🐶', chihuahua: '🐶', pomeranian: '🐶',
  // Also: scarecrow doesn't have an obvious emoji; use a friendly stand-in.
  scarecrow: '🌾',
  // Additional real-world animals that didn't have a dedicated emoji
  // before — most map to the closest taxonomic cousin (penguin emoji,
  // big-cat emoji for big cats, bird for birds without their own glyph).
  penguin: '🐧', sloth: '🦥', manatee: '🦭',
  coyote: '🐺',
  bull: '🐂', longhorn: '🐂', ox: '🐂',
  gopher: '🦫', mole: '🦫', beaver: '🦫',
  platypus: '🦫',
  kitten: '🐱', kitty: '🐱', cougar: '🐆', panther: '🐆',
  donkey: '🫏', mule: '🫏', burro: '🫏',
  pony: '🐴', bronco: '🐴', mustang: '🐴', stallion: '🐴',
  rooster: '🐓', hen: '🐔', chick: '🐤',
  hawk: '🦅', falcon: '🦅', osprey: '🦅', kestrel: '🦅',
  heron: '🐦', crane: '🐦', egret: '🐦', ibis: '🐦',
  bluebird: '🐦', cardinal: '🐦', robin: '🐦', sparrow: '🐦',
  finch: '🐦', warbler: '🐦', wren: '🐦', oriole: '🐦',
  jay: '🐦', magpie: '🐦', dove: '🕊️', albatross: '🐦',
  roadrunner: '🐦', kiwi: '🐦', emu: '🐦', cassowary: '🐦',
  ostrich: '🐦',
  sugar: '🐿️', glider: '🐿️',
  alpaca: '🦙', vicuna: '🦙', guanaco: '🦙',
  shrimp: '🦐', prawn: '🦐', krill: '🦐',
  quahog: '🦪', clam: '🦪', oyster: '🦪', mussel: '🦪',
  elk: '🦌', caribou: '🦌', reindeer: '🦌', antelope: '🦌', gazelle: '🦌',
  jackalope: '🐰', hare: '🐰',
  pterodactyl: '🦖', pteranodon: '🦖',
  brontosaurus: '🦕', sauropod: '🦕', diplodocus: '🦕',
  mastodon: '🦣',
  // Mythical / folklore — pick a thematically close glyph
  sasquatch: '🐾', bigfoot: '🐾',
  troll: '🧌', gnome: '🧝', elf: '🧝', fairy: '🧚',
  'loch ness monster': '🦕', nessie: '🦕', chessie: '🦕',
  // Non-animal mascots (food, objects, characters)
  toast: '🍞', bread: '🍞',
  avocado: '🥑', lemon: '🍋', lime: '🍋', orange: '🍊',
  apple: '🍎', banana: '🍌', strawberry: '🍓',
  onion: '🧅', pearl: '🧅',
  maple: '🍁', leaf: '🍁',
  rock: '🪨', stone: '🪨', boulder: '🪨',
  sponge: '🧽',
  pirate: '🏴‍☠️',
  colonial: '🎩', figure: '🎩',
  muppet: '🎭', animal: '🎭',
  sun: '☀️', star: '⭐',
  train: '🚂',
};

export function emojiForAnimal(animal: string | null | undefined, hasPhoto = false): string {
  // Two fallback modes:
  //   • If we have a photo of the mascot but no recognized animal type,
  //     show 📸 — communicates "we have something here, just don't know
  //     what species it is yet."
  //   • Otherwise (no animal AND no photo) ⭐ remains the "unknown" pin.
  const fallback = hasPhoto ? '📸' : '⭐';
  if (!animal) return fallback;
  const a = animal.toLowerCase();
  if (a === 'unknown') return fallback;
  if (ANIMAL_EMOJI[a]) return ANIMAL_EMOJI[a];
  for (const tok of a.split(/[\s/()]+/)) {
    if (tok && ANIMAL_EMOJI[tok]) return ANIMAL_EMOJI[tok];
  }
  for (const [phrase, e] of Object.entries(ANIMAL_EMOJI)) {
    if (a.includes(phrase)) return e;
  }
  return fallback;
}

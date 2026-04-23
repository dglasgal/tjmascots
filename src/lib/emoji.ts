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
};

export function emojiForAnimal(animal: string | null | undefined): string {
  if (!animal) return '⭐';
  const a = animal.toLowerCase();
  if (ANIMAL_EMOJI[a]) return ANIMAL_EMOJI[a];
  for (const tok of a.split(/[\s/()]+/)) {
    if (tok && ANIMAL_EMOJI[tok]) return ANIMAL_EMOJI[tok];
  }
  for (const [phrase, e] of Object.entries(ANIMAL_EMOJI)) {
    if (a.includes(phrase)) return e;
  }
  return '⭐';
}

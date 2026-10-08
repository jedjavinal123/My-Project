// Static game data. Ascendancies change between patches, so the build form
// also accepts free text — these lists are only suggestions.
window.POE2 = {
  classes: {
    Warrior: ['Titan', 'Warbringer', 'Smith of Kitava'],
    Ranger: ['Deadeye', 'Pathfinder'],
    Huntress: ['Amazon', 'Ritualist'],
    Mercenary: ['Witchhunter', 'Gemling Legionnaire', 'Tactician'],
    Monk: ['Invoker', 'Acolyte of Chayula'],
    Sorceress: ['Stormweaver', 'Chronomancer', 'Disciple of Varashta'],
    Witch: ['Infernalist', 'Blood Mage', 'Lich'],
    Druid: ['Oracle', 'Shaman'],
  },

  gearSlots: [
    'Weapon', 'Off-hand', 'Weapon swap', 'Off-hand swap',
    'Helmet', 'Body Armour', 'Gloves', 'Boots',
    'Amulet', 'Ring 1', 'Ring 2', 'Belt',
    'Life Flask', 'Mana Flask', 'Charm 1', 'Charm 2', 'Charm 3',
  ],

  statuses: ['Planning', 'Leveling', 'Mapping', 'Endgame', 'Retired'],

  // Fields recorded in each progress snapshot.
  snapshotFields: [
    { key: 'level', label: 'Level' },
    { key: 'life', label: 'Life' },
    { key: 'es', label: 'Energy Shield' },
    { key: 'mana', label: 'Mana' },
    { key: 'dps', label: 'DPS' },
    { key: 'fire', label: 'Fire res' },
    { key: 'cold', label: 'Cold res' },
    { key: 'lightning', label: 'Lightning res' },
    { key: 'chaos', label: 'Chaos res' },
  ],
};

// Shop registry: a level's door with kind:'shop' references one of these by
// shopId. Most shops offer exactly two items (plus the built-in Leave option
// the UI adds); a shop can list more (see `temple`'s 1-Up) - swap
// `items`/`theme` here to make a new shop type, nothing else needs to change.
//
// Item `kind` drives the effect (see Game#buyItem in game.js):
//   'potion'           -> heal `amount` HP (capped at max health)
//   'fullheal'         -> fully restore HP
//   'heart'            -> raise max health by a flat `amount` (heals by the same amount)
//   'maxHealthPercent' -> raise max health by `amount` fraction (e.g. 0.5 = +50%),
//                         permanently, and heal by the same increase
//   'weapon'           -> raise attack damage by a flat `amount`
//   'weaponMultiplier' -> multiply attack damage by `amount` (e.g. 2 = double)
//   'oneup'            -> +1 life
//   'floatBoots'       -> multiply gravity by `amount` (e.g. 0.5 = half), permanently -
//                         floatier jumps and slower falls
//   'attackSpeed'      -> multiply the whole attack swing timeline by `amount`
//                         (e.g. 0.5 = half the cooldown), permanently
//
// An item with `oneTime: true` can only ever be bought once per playthrough
// (tracked in Game#purchasedOneTimeItems) - the shop UI shows "Owned" once
// it's been bought.
export const SHOPS = {
  general_store: {
    name: 'General Store',
    theme: { from: '#2b1d10', to: '#6b4a2a', accent: '#ffce54' },
    items: [
      { id: 'potion', kind: 'potion', label: 'Health Potion', description: 'Restore 50 HP', cost: 5, amount: 50 },
      {
        id: 'vitality', kind: 'maxHealthPercent', label: 'Vitality Elixir',
        description: '+50% max HP, permanently', cost: 15, amount: 0.5,
      },
    ],
  },
  temple: {
    name: 'Temple of Vigor',
    theme: { from: '#0f1f2b', to: '#2a5a7a', accent: '#7fe0ff' },
    items: [
      {
        id: 'spear', kind: 'weaponMultiplier', label: 'Runic Spear',
        description: 'Doubles attack damage', cost: 30, amount: 2, oneTime: true,
      },
      { id: 'fullheal', kind: 'fullheal', label: 'Elixir of Renewal', description: 'Fully restore HP', cost: 8 },
      {
        id: 'oneup', kind: 'oneup', label: 'Spare Life Charm',
        description: '+1 life', cost: 50,
      },
    ],
  },
  blacksmith: {
    name: 'Blacksmith',
    theme: { from: '#1a1a1c', to: '#4a4440', accent: '#ff8a3d' },
    items: [
      { id: 'whetstone', kind: 'weapon', label: 'Whetstone', description: '+8 attack damage', cost: 18, amount: 8 },
      { id: 'ration', kind: 'potion', label: 'Field Ration', description: 'Restore 40 HP', cost: 4, amount: 40 },
      {
        id: 'swiftstrike', kind: 'attackSpeed', label: 'Swift Strike Training',
        description: 'Halves attack cooldown', cost: 25, amount: 0.5, oneTime: true,
      },
    ],
  },
  mystic: {
    name: "Mystic's Hut",
    theme: { from: '#1c1030', to: '#4a2a70', accent: '#c9a8ff' },
    items: [
      { id: 'charm', kind: 'heart', label: 'Warding Charm', description: '+30 max HP', cost: 12, amount: 30 },
      { id: 'tonic', kind: 'fullheal', label: 'Mystic Tonic', description: 'Fully restore HP', cost: 8 },
      {
        id: 'boots', kind: 'floatBoots', label: 'Boots of Floatiness',
        description: 'Floatier jumps, slower falls', cost: 8, amount: 0.5, oneTime: true,
      },
    ],
  },
};

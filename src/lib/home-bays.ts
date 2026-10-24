export interface BayDetails {
  tag: string;
  name: string;
  type: 'pc' | 'ps5';
  desc: string;
  specs: string[];
  games: string[];
  status: 'live' | 'soon';
}

export const BAYS_DATA: BayDetails[] = [
  {
    tag: 'CABIN 01',
    name: 'Esports PC Cabin 01',
    type: 'pc',
    desc: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors.',
    specs: [
      '240Hz MSI Rapid IPS Monitors',
      'NVIDIA GeForce GTX 1080 Ti',
      'Japanese Aqua Ergonomic Chairs',
      'Chilled Sub-Zero Air Conditioning',
      'Mechanical Keyboards & High-DPI Mice',
    ],
    games: [
      'Counter-Strike 2',
      'Valorant',
      'Apex Legends',
      'GTA V / FiveM',
      'Call of Duty: Warzone',
    ],
    status: 'live',
  },
  {
    tag: 'CABIN 02',
    name: 'Esports PC Cabin 02',
    type: 'pc',
    desc: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors.',
    specs: [
      '240Hz MSI Rapid IPS Monitors',
      'NVIDIA GeForce GTX 1080 Ti',
      'Japanese Aqua Ergonomic Chairs',
      'Chilled Sub-Zero Air Conditioning',
      'Mechanical Keyboards & High-DPI Mice',
    ],
    games: ['Counter-Strike 2', 'Valorant', 'Apex Legends', 'GTA V / FiveM', 'Dota 2'],
    status: 'live',
  },
  {
    tag: 'CABIN 03',
    name: 'Esports PC Cabin 03',
    type: 'pc',
    desc: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors.',
    specs: [
      '240Hz MSI Rapid IPS Monitors',
      'NVIDIA GeForce GTX 1080 Ti',
      'Japanese Aqua Ergonomic Chairs',
      'Chilled Sub-Zero Air Conditioning',
      'Mechanical Keyboards & High-DPI Mice',
    ],
    games: ['Counter-Strike 2', 'Valorant', 'Apex Legends', 'Fortnite', 'Overwatch 2'],
    status: 'live',
  },
  {
    tag: 'CABIN 04',
    name: 'Esports PC Cabin 04',
    type: 'pc',
    desc: 'A fourth 5-seat PC cabin, currently being built out.',
    specs: [
      '240Hz Ultra-fast Displays',
      'Next-Gen Battle Station Rigs',
      'Private Team Sound Dampening',
      'Dedicated Coach & Analyst Screen',
    ],
    games: ['CS2 Premier Ready', 'Bootcamp Optimized'],
    status: 'soon',
  },
  {
    tag: 'LOUNGE',
    name: 'VIP PS5 Slim Lounge',
    type: 'ps5',
    desc: '4 PS5 Slim Digital Edition consoles, bean bags, chilled AC.',
    specs: [
      '4 × Sony PS5 Slim Digital Edition',
      '4K 120Hz Ultra HD HDR Gaming Displays',
      'DualSense Wireless Controllers',
      'Plush Ultra-Comfort Bean Bags',
      'Chilled High-Output AC',
    ],
    games: ['EA Sports FC 25 / FIFA', 'Tekken 8', 'Mortal Kombat 1', 'NBA 2K25', 'Spider-Man 2'],
    status: 'live',
  },
];

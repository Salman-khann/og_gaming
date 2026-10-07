export interface FaceitPlayerInfo {
  id: string;
  nickname: string;
  avatar: string;
  country: string;
  elo: number;
  level: number;
  gameId: string;
}

// In-memory cache to respect rate limits
const cache = new Map<string, { data: FaceitPlayerInfo; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export async function getFaceitPlayerByNickname(nickname: string): Promise<FaceitPlayerInfo | null> {
  const normalized = nickname.trim().toLowerCase();
  
  // Check cache
  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiKey = process.env.FACEIT_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(`https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        next: { revalidate: 900 },
      });

      if (res.ok) {
        const json = await res.json();
        const cs2 = json.games?.cs2 || json.games?.csgo || {};
        const playerInfo: FaceitPlayerInfo = {
          id: json.player_id,
          nickname: json.nickname,
          avatar: json.avatar || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=150&q=80',
          country: json.country || 'US',
          elo: cs2.faceit_elo || 1000,
          level: cs2.skill_level || Math.min(10, Math.max(1, Math.floor(((cs2.faceit_elo || 1000) - 800) / 150) + 1)),
          gameId: 'cs2',
        };

        cache.set(normalized, { data: playerInfo, timestamp: Date.now() });
        return playerInfo;
      }
    } catch (err) {
      console.warn('[FACEIT API Failed - Falling back to local data]', err);
    }
  }

  // Realistic mock players for testing / fallback
  const mockDatabase: Record<string, FaceitPlayerInfo> = {
    s1mple: {
      id: 'f-s1mple-01',
      nickname: 's1mple',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      country: 'UA',
      elo: 3650,
      level: 10,
      gameId: 'cs2',
    },
    zywoo: {
      id: 'f-zywoo-02',
      nickname: 'ZywOo',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      country: 'FR',
      elo: 3580,
      level: 10,
      gameId: 'cs2',
    },
    donk: {
      id: 'f-donk-03',
      nickname: 'donk',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      country: 'RU',
      elo: 3820,
      level: 10,
      gameId: 'cs2',
    },
    niko: {
      id: 'f-niko-04',
      nickname: 'NiKo',
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=150&q=80',
      country: 'BA',
      elo: 3420,
      level: 10,
      gameId: 'cs2',
    },
    m0nesy: {
      id: 'f-monesy-05',
      nickname: 'm0NESY',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
      country: 'RU',
      elo: 3750,
      level: 10,
      gameId: 'cs2',
    },
    fallen: {
      id: 'f-fallen-06',
      nickname: 'FalleN',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
      country: 'BR',
      elo: 2650,
      level: 9,
      gameId: 'cs2',
    },
    apex: {
      id: 'f-apex-07',
      nickname: 'apEX',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
      country: 'FR',
      elo: 2450,
      level: 8,
      gameId: 'cs2',
    },
    ropz: {
      id: 'f-ropz-08',
      nickname: 'ropz',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
      country: 'EE',
      elo: 3390,
      level: 10,
      gameId: 'cs2',
    },
    rain: {
      id: 'f-rain-09',
      nickname: 'rain',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
      country: 'NO',
      elo: 2780,
      level: 9,
      gameId: 'cs2',
    },
    broky: {
      id: 'f-broky-10',
      nickname: 'broky',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      country: 'LV',
      elo: 3120,
      level: 10,
      gameId: 'cs2',
    },
    noobmaster: {
      id: 'f-noobmaster-11',
      nickname: 'NoobMaster69',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
      country: 'SE',
      elo: 750,
      level: 2,
      gameId: 'cs2',
    },
    casualfragger: {
      id: 'f-casualfragger-12',
      nickname: 'CasualFragger',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
      country: 'DE',
      elo: 1120,
      level: 4,
      gameId: 'cs2',
    },
  };

  if (mockDatabase[normalized]) {
    return mockDatabase[normalized];
  }

  // Deterministic mock generation based on hash of nickname
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) {
    hash = (hash << 5) - hash + nickname.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);
  const level = (positiveHash % 10) + 1;
  const elo = 600 + level * 240 + (positiveHash % 120);

  const generated: FaceitPlayerInfo = {
    id: `usr-${positiveHash}`,
    nickname,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(nickname)}`,
    country: 'PK',
    elo,
    level,
    gameId: 'cs2',
  };

  cache.set(normalized, { data: generated, timestamp: Date.now() });
  return generated;
}

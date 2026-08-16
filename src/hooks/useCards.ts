/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { generateId, shuffle } from "../utils/math";
import { Card } from "../types/canvas";

export const MAX_DECK_SIZE = 200;
const SCRYFALL_BATCH_SIZE = 75;

const describeScryfallFailure = async (response: Response) => {
  const body = await response.text().catch(() => "");
  let details = body;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object" && "details" in parsed) {
      const parsedDetails = (parsed as { details: unknown }).details;
      if (typeof parsedDetails === "string") {
        details = parsedDetails;
      }
    }
  } catch {
    // Scryfall returned a non-JSON body, fall back to the raw text.
  }

  const suffix = details.trim() ? `: ${details.trim()}` : "";
  return `Scryfall request failed (${response.status} ${response.statusText})${suffix}`;
};

const fetchCards = async (names: string[]): Promise<CardCollection> => {
  const response = await fetch("https://api.scryfall.com/cards/collection", {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifiers: names.map((name) => ({ name })),
    }),
  });
  if (!response.ok) {
    throw new Error(await describeScryfallFailure(response));
  }

  try {
    return (await response.json()) as CardCollection;
  } catch (error) {
    throw new Error(
      `Scryfall returned a response that could not be parsed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

const getCards = async (names: string[]) => {
  names = [...names];
  if (names.length <= SCRYFALL_BATCH_SIZE) {
    return [await fetchCards(names)];
  }
  if (names.length > MAX_DECK_SIZE) {
    throw new Error(
      `Too many cards: ${names.length} requested, the limit is ${MAX_DECK_SIZE}.`
    );
  }

  const cardPromises = [];
  while (names.length) {
    const chunk = names.splice(0, SCRYFALL_BATCH_SIZE).filter(Boolean);
    cardPromises.push(fetchCards(chunk));
  }

  const cardArrays = await Promise.all(cardPromises);
  return cardArrays.flat();
};

export function collectNotFoundNames(collections?: CardCollection[]): string[] {
  if (!collections) return [];
  const names = collections.flatMap((collection) =>
    (collection.not_found ?? [])
      .map((entry) => (typeof entry?.name === "string" ? entry.name : null))
      .filter((name): name is string => Boolean(name))
  );
  return Array.from(new Set(names));
}

function useCards(names: string[]) {
  const query = useQuery<CardCollection[], Error>({
    queryKey: ["decks", names],
    queryFn: () => getCards(names),
    enabled: names.length > 0,
    structuralSharing: false,
    refetchOnWindowFocus: false,
  });

  const { data: collections } = query;
  const data = useMemo(
    () =>
      collections
        ? shuffle(collections.flatMap((collection) => collection.data ?? []))
        : undefined,
    [collections]
  );
  const notFoundNames = useMemo(
    () => collectNotFoundNames(collections),
    [collections]
  );

  return { ...query, data, notFoundNames };
}
export default useCards;

export interface CardCollection {
  object: string;
  not_found: any[];
  data: Datum[];
}

export interface Datum {
  object: string;
  id: string;
  oracle_id: string;
  card_faces?: Datum[];
  all_parts: {
    object: string;
    id: string;
    component: string;
    name: string;
    type_line: string;
    uri: string;
  }[];
  multiverse_ids: number[];
  mtgo_id: number;
  mtgo_foil_id: number;
  tcgplayer_id: number;
  cardmarket_id: number;
  name: string;
  lang: string;
  released_at: Date;
  uri: string;
  scryfall_uri: string;
  layout: string;
  highres_image: boolean;
  image_status: string;
  image_uris: ImageUris;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  power?: string;
  toughness?: string;
  colors: any[];
  color_identity: any[];
  keywords: any[];
  legalities: Legalities;
  games: string[];
  reserved: boolean;
  foil: boolean;
  nonfoil: boolean;
  finishes: string[];
  oversized: boolean;
  promo: boolean;
  reprint: boolean;
  variation: boolean;
  set_id: string;
  set: string;
  set_name: string;
  set_type: string;
  set_uri: string;
  set_search_uri: string;
  scryfall_set_uri: string;
  rulings_uri: string;
  prints_search_uri: string;
  collector_number: string;
  digital: boolean;
  rarity: string;
  flavor_text?: string;
  card_back_id: string;
  artist: string;
  artist_ids: string[];
  illustration_id: string;
  border_color: string;
  frame: string;
  security_stamp?: string;
  full_art: boolean;
  textless: boolean;
  booster: boolean;
  story_spotlight: boolean;
  edhrec_rank: number;
  penny_rank?: number;
  prices: Prices;
  related_uris: RelatedUris;
  purchase_uris: PurchaseUris;
  produced_mana?: string[];
}

export interface ImageUris {
  small: string;
  normal: string;
  large: string;
  png: string;
  art_crop: string;
  border_crop: string;
}

export interface Legalities {
  standard: string;
  future: string;
  historic: string;
  gladiator: string;
  pioneer: string;
  explorer: string;
  modern: string;
  legacy: string;
  pauper: string;
  vintage: string;
  penny: string;
  commander: string;
  oathbreaker: string;
  brawl: string;
  historicbrawl: string;
  alchemy: string;
  paupercommander: string;
  duel: string;
  oldschool: string;
  premodern: string;
  predh: string;
}

export interface Prices {
  usd: string;
  usd_foil: string;
  usd_etched: null;
  eur: string;
  eur_foil: string;
  tix: string;
}

export interface PurchaseUris {
  tcgplayer: string;
  cardmarket: string;
  cardhoarder: string;
}

export interface RelatedUris {
  gatherer: string;
  tcgplayer_infinite_articles: string;
  tcgplayer_infinite_decks: string;
  edhrec: string;
}
export function processRawText(fromArena: string) {
  if (fromArena.trim() === "") return [];
  return fromArena.split("\n").flatMap((s) => {
    const match = s.match(/^(\d+)\s+(.*?)(?:\s*\/\/.*)?$/);
    if (match) {
      const [, count, name] = match;
      return Array(Number(count)).fill(name.trim());
    }
    return [];
  });
}
export function mapDataToCards(data?: Datum[]): Card[] {
  if (!data) return [];
  const cards: Card[] = [];
  for (const datum of data) {
    const card = mapDataToCard(datum);
    if (!card) {
      console.warn(`Skipping "${datum?.name ?? "unknown card"}": no card image`);
      continue;
    }
    cards.push(card);
  }
  return cards;
}

/** Returns null when the card has no usable image, so callers can skip it. */
export function mapDataToCard(data: Datum): Card | null {
  if (data?.image_uris?.normal) {
    return {
      id: generateId(),
      src: [data.image_uris.normal],
    };
  }

  const faceSrcs =
    data?.card_faces
      ?.map((face) => face.image_uris?.normal)
      .filter((src): src is string => Boolean(src)) ?? [];
  if (faceSrcs.length > 0) {
    return {
      id: generateId(),
      src: faceSrcs,
    };
  }

  return null;
}

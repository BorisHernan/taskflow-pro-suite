export interface BlobView {
  /** Id de la célula. */
  id: string;
  /** Id del jugador: un jugador dividido tiene varias células con el mismo ownerId. */
  ownerId: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  skin: string;
  bot: boolean;
  velocidad: boolean;
  escudo: boolean;
  iman: boolean;
}

export type TipoPellet = 'normal' | 'grande' | 'masa' | 'velocidad' | 'escudo' | 'iman';

export interface Pellet {
  id: string;
  x: number;
  y: number;
  tipo: TipoPellet;
}

export interface ArenaEvent {
  tipo: 'comio' | 'powerup';
  quien: string;
  aQuien: string;
  x: number;
  y: number;
  color: string;
}

export interface ArenaSnapshot {
  blobs: BlobView[];
  pellets: Pellet[];
  worldSize: number;
  eventos: ArenaEvent[];
}

export interface WelcomeMessage {
  type: 'welcome';
  id: string;
}
